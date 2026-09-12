import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";

const headers = { ...(process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {}) };
const maxRepos = Math.max(0, Number(process.env.HF_RESOURCE_ENRICH_MAX || 500));
const concurrency = Math.max(1, Math.min(12, Number(process.env.HF_RESOURCE_ENRICH_CONCURRENCY || 5)));
const text = (value, fallback = "") => String(value ?? fallback).replace(/\u0000/g, "").trim();
const sqlText = (value) => `'${text(value).replaceAll("'", "''")}'`;
const sqlNum = (value) => Number.isFinite(Number(value)) ? String(Number(value)) : "NULL";

function queryD1(sql) {
  const command = `npx wrangler d1 execute lora-hunt-db --remote --command ${JSON.stringify(sql)} --json`;
  const result = spawnSync(command, { shell: true, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || "D1 query failed");
  const payload = JSON.parse(result.stdout.trim());
  return payload[0]?.results || [];
}

function runD1(sql) {
  if (!sql.trim()) return;
  const dir = mkdtempSync(join(tmpdir(), "lora-hunt-resource-enrich-"));
  const file = join(dir, "update.sql");
  writeFileSync(file, sql, "utf8");
  try {
    const result = spawnSync("npx", ["wrangler", "d1", "execute", "lora-hunt-db", "--remote", "--file", file], { stdio: "inherit", windowsHide: true, shell: true });
    if (result.status !== 0) throw new Error(`D1 update failed: ${result.status}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const rawUrl = (repo, path) => `https://huggingface.co/${repo}/raw/main/${path.split("/").map(encodeURIComponent).join("/")}`;
const resolveUrl = (repo, path) => `https://huggingface.co/${repo}/resolve/main/${path.split("/").map(encodeURIComponent).join("/")}`;

async function getText(url, limit = 120000) {
  const response = await fetch(url, { headers });
  if (!response.ok) return "";
  return (await response.text()).slice(0, limit);
}

async function getJSON(url) {
  const response = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!response.ok) return null;
  return response.json();
}

function extractTriggerWords(readme) {
  const found = new Set();
  const patterns = [
    /(?:trigger(?:\s+words?)?|trained\s+words?)\s*[:：]\s*([^\n]{1,240})/gi,
    /(?:use|prompt)\s+(?:the\s+)?(?:trigger|token)\s*[`"']([^`"']{1,80})[`"']/gi
  ];
  for (const pattern of patterns) {
    for (const match of readme.matchAll(pattern)) {
      String(match[1] || "").replace(/[`*_#]/g, "").split(/[,|/;]/).map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 80).forEach((x) => found.add(x));
    }
  }
  return [...found].slice(0, 20);
}

function extractWeight(readme) {
  const range = readme.match(/(?:recommended\s+)?(?:weight|strength|scale)\s*(?:range)?\s*[:：]?\s*([0-2](?:\.\d+)?)\s*(?:-|–|—|~|to)\s*([0-2](?:\.\d+)?)/i);
  if (range) return [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
  const single = readme.match(/(?:recommended\s+)?(?:weight|strength|scale)\s*[:：]\s*([0-2](?:\.\d+)?)/i);
  return single ? [Number(single[1]), Number(single[1])] : [null, null];
}

function nearestConfig(resourcePath, configs) {
  const dir = posix.dirname(resourcePath);
  const scored = configs.map((path) => {
    const configDir = posix.dirname(path);
    let score = 0;
    if (configDir === dir) score = 1000;
    else if (dir.startsWith(`${configDir}/`)) score = 500 + configDir.length;
    else if (configDir === ".") score = 10;
    return { path, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].path : null;
}

function configMetadata(config) {
  if (!config || typeof config !== "object") return {};
  const rank = Number(config.r ?? config.lora_rank ?? config.rank ?? NaN);
  const alpha = Number(config.lora_alpha ?? config.alpha ?? NaN);
  const targets = Array.isArray(config.target_modules) ? config.target_modules.map(String) : config.target_modules ? [String(config.target_modules)] : [];
  return {
    rank: Number.isFinite(rank) && rank > 0 ? rank : null,
    alpha: Number.isFinite(alpha) && alpha > 0 ? alpha : null,
    targetModules: [...new Set(targets)].slice(0, 64),
    networkType: text(config.peft_type || config.network_type || config.task_type || "") || null,
    baseModel: text(config.base_model_name_or_path || "") || null
  };
}

function inferTargetsFromTensorKeys(keys) {
  const targets = new Set();
  for (const key of keys.slice(0, 10000)) {
    const lower = key.toLowerCase();
    if (lower.includes("text_encoder")) targets.add("text_encoder");
    if (lower.includes("unet")) targets.add("unet");
    if (lower.includes("transformer")) targets.add("transformer");
    for (const token of ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj", "to_q", "to_k", "to_v", "to_out"]) if (lower.includes(token)) targets.add(token);
  }
  return [...targets].slice(0, 64);
}

async function safetensorsHeader(repo, path) {
  if (!/\.safetensors$/i.test(path)) return null;
  const url = resolveUrl(repo, path);
  const first = await fetch(url, { headers: { ...headers, Range: "bytes=0-7" }, redirect: "follow" });
  if (!first.ok || first.status !== 206) return null;
  const prefix = new Uint8Array(await first.arrayBuffer());
  if (prefix.length !== 8) return null;
  const view = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength);
  const length = Number(view.getBigUint64(0, true));
  if (!Number.isFinite(length) || length <= 2 || length > 8 * 1024 * 1024) return null;
  const second = await fetch(url, { headers: { ...headers, Range: `bytes=8-${7 + length}` }, redirect: "follow" });
  if (!second.ok || second.status !== 206) return null;
  const parsed = JSON.parse(new TextDecoder().decode(await second.arrayBuffer()));
  const metadata = parsed.__metadata__ || {};
  const rank = Number(metadata.ss_network_dim ?? metadata.network_dim ?? metadata.lora_rank ?? NaN);
  const alpha = Number(metadata.ss_network_alpha ?? metadata.network_alpha ?? metadata.lora_alpha ?? NaN);
  const baseModel = text(metadata.ss_sd_model_name || metadata.modelspec_architecture || metadata.base_model || "") || null;
  return {
    rank: Number.isFinite(rank) && rank > 0 ? rank : null,
    alpha: Number.isFinite(alpha) && alpha > 0 ? alpha : null,
    baseModel,
    networkType: text(metadata.ss_network_module || metadata.network_type || "") || null,
    targetModules: inferTargetsFromTensorKeys(Object.keys(parsed).filter((key) => key !== "__metadata__"))
  };
}

function treeSha(file) {
  const oid = text(file?.lfs?.oid || file?.oid || file?.blob_id || "");
  return oid.replace(/^sha256:/i, "") || null;
}

function treeSize(file) {
  const bytes = Number(file?.size || file?.lfs?.size || 0);
  return bytes > 0 ? Math.round((bytes / 1024 / 1024) * 100) / 100 : null;
}

async function enrichRepo(row) {
  const repo = text(row.id);
  const tree = await getJSON(`https://huggingface.co/api/models/${repo}/tree/main?recursive=true&expand=true`);
  if (!Array.isArray(tree)) return [];
  const files = tree.filter((item) => item.type === "file");
  const paths = files.map((item) => text(item.path)).filter(Boolean);
  const resources = paths.filter((path) => /\.safetensors$/i.test(path) || /(?:lora|adapter|pytorch_lora_weights).*\.(?:bin|pt)$/i.test(path));
  if (!resources.length) return [];
  const readmePath = paths.find((path) => /^README\.md$/i.test(path));
  const readme = readmePath ? await getText(rawUrl(repo, readmePath)) : "";
  const triggers = extractTriggerWords(readme);
  const [weightMin, weightMax] = extractWeight(readme);
  const configs = paths.filter((path) => /(^|\/)adapter_config\.json$/i.test(path));
  const configCache = new Map();
  const hasExamples = paths.some((path) => /\.(?:png|jpe?g|webp|gif)$/i.test(path)) ? 1 : 0;
  const updates = [];

  for (const resourcePath of resources) {
    const treeFile = files.find((item) => text(item.path) === resourcePath);
    const configPath = nearestConfig(resourcePath, configs);
    let fromConfig = {};
    if (configPath) {
      if (!configCache.has(configPath)) configCache.set(configPath, await getJSON(rawUrl(repo, configPath)));
      fromConfig = configMetadata(configCache.get(configPath));
    }
    const fromHeader = await safetensorsHeader(repo, resourcePath).catch(() => null) || {};
    const rank = fromConfig.rank ?? fromHeader.rank ?? null;
    const alpha = fromConfig.alpha ?? fromHeader.alpha ?? null;
    const targetModules = fromConfig.targetModules?.length ? fromConfig.targetModules : (fromHeader.targetModules || []);
    const networkType = fromConfig.networkType || fromHeader.networkType || null;
    const baseModel = fromConfig.baseModel || fromHeader.baseModel || text(row.base_model || "Unknown base");
    let confidence = 0.45;
    if (configPath) confidence += 0.2;
    if (fromHeader.rank || fromHeader.alpha || fromHeader.networkType) confidence += 0.15;
    if (triggers.length) confidence += 0.1;
    if (weightMin != null) confidence += 0.05;
    if (treeSha(treeFile)) confidence += 0.05;
    confidence = Math.min(1, Math.round(confidence * 100) / 100);
    const id = `${repo}:${resourcePath}`;
    updates.push(`UPDATE lora_resources SET size_mb=${sqlNum(treeSize(treeFile))}, sha256=${treeSha(treeFile) ? sqlText(treeSha(treeFile)) : "sha256"}, base_model=${sqlText(baseModel)}, trigger_words=${sqlText(JSON.stringify(triggers))}, recommended_weight_min=${sqlNum(weightMin)}, recommended_weight_max=${sqlNum(weightMax)}, lora_rank=${sqlNum(rank)}, alpha=${sqlNum(alpha)}, target_modules=${sqlText(JSON.stringify(targetModules))}, network_type=${networkType ? sqlText(networkType) : "network_type"}, has_examples=${hasExamples}, metadata_confidence=${confidence}, enriched_at=datetime('now') WHERE id=${sqlText(id)};`);
  }
  return updates;
}

const limitClause = maxRepos ? `LIMIT ${maxRepos}` : "";
const repos = queryD1(`SELECT m.id, m.base_model, m.downloads FROM models m WHERE EXISTS (SELECT 1 FROM lora_resources r WHERE r.model_id=m.id AND r.enriched_at IS NULL) ORDER BY m.downloads DESC ${limitClause};`);
console.log(`Deep-enriching ${repos.length.toLocaleString()} repositories, popular first.`);

let completed = 0;
for (let index = 0; index < repos.length; index += concurrency) {
  const batch = repos.slice(index, index + concurrency);
  const statements = (await Promise.all(batch.map((repo) => enrichRepo(repo).catch((error) => {
    console.warn(`Skipping ${repo.id}: ${error.message}`);
    return [];
  })))).flat();
  runD1(statements.join("\n"));
  completed += batch.length;
  console.log(`Enriched ${completed}/${repos.length} repositories.`);
}
