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

function parseNextLink(header) {
  if (!header) return null;
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="?next"?/i);
    if (match) return match[1];
  }
  return null;
}

function familyFrom(base) {
  const value = text(base).toLowerCase();
  if (value.includes("qwen")) return "Qwen";
  if (value.includes("llama")) return "Llama";
  if (value.includes("gemma")) return "Gemma";
  if (value.includes("mistral")) return "Mistral";
  if (value.includes("flux")) return "FLUX";
  if (value.includes("wan")) return "Wan";
  if (value.includes("ltx")) return "LTX";
  if (value.includes("stable-diffusion-xl") || /\bsdxl\b/.test(value)) return "SDXL";
  if (value.includes("illustrious")) return "Illustrious";
  if (value.includes("pony")) return "Pony";
  return "Other";
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

async function getTree(repo) {
  const items = [];
  let url = `https://huggingface.co/api/models/${repo}/tree/main?recursive=true&expand=true&limit=1000`;
  while (url) {
    const response = await fetch(url, { headers: { Accept: "application/json", ...headers } });
    if (!response.ok) throw new Error(`${response.status} while reading tree`);
    const page = await response.json();
    if (Array.isArray(page)) items.push(...page);
    url = parseNextLink(response.headers.get("Link"));
  }
  return items;
}

function extractTriggerWords(source) {
  const found = new Set();
  const patterns = [
    /(?:trigger(?:\s+words?)?|trained\s+words?)\s*[:：]\s*([^\n]{1,240})/gi,
    /(?:use|prompt)\s+(?:the\s+)?(?:trigger|token)\s*[`"']([^`"']{1,80})[`"']/gi
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      String(match[1] || "").replace(/[`*_#]/g, "").split(/[,|/;]/).map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 80).forEach((x) => found.add(x));
    }
  }
  return [...found].slice(0, 20);
}

function extractWeight(source) {
  const range = source.match(/(?:recommended\s+)?(?:weight|strength|scale)\s*(?:range)?\s*[:：]?\s*([0-2](?:\.\d+)?)\s*(?:-|–|—|~|to)\s*([0-2](?:\.\d+)?)/i);
  if (range) return [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
  const single = source.match(/(?:recommended\s+)?(?:weight|strength|scale)\s*[:：]\s*([0-2](?:\.\d+)?)/i);
  return single ? [Number(single[1]), Number(single[1])] : [null, null];
}

function nearestPath(resourcePath, candidates) {
  const dir = posix.dirname(resourcePath);
  return candidates.map((path) => {
    const candidateDir = posix.dirname(path);
    let score = candidateDir === dir ? 1000 : candidateDir === "." ? 10 : dir.startsWith(`${candidateDir}/`) ? 500 + candidateDir.length : 0;
    return { path, score };
  }).sort((a, b) => b.score - a.score)[0]?.score > 0 ? candidates.map((path) => {
    const candidateDir = posix.dirname(path);
    return { path, score: candidateDir === dir ? 1000 : candidateDir === "." ? 10 : dir.startsWith(`${candidateDir}/`) ? 500 + candidateDir.length : 0 };
  }).sort((a, b) => b.score - a.score)[0].path : null;
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

function sidecarMetadata(value) {
  if (!value || typeof value !== "object") return {};
  const words = value.trainedWords || value.trigger_words || value.triggerWords || value.activation_text || value.activationText || [];
  const triggerWords = (Array.isArray(words) ? words : [words]).map(String).map((x) => x.trim()).filter(Boolean).slice(0, 20);
  const weight = Number(value.preferredWeight ?? value.weight ?? value.strength ?? NaN);
  return { triggerWords, weight: Number.isFinite(weight) ? weight : null };
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
  const tree = await getTree(repo);
  const files = tree.filter((item) => item.type === "file");
  const paths = files.map((item) => text(item.path)).filter(Boolean);
  const resources = paths.filter((path) => /\.safetensors$/i.test(path) || /(?:lora|adapter|pytorch_lora_weights).*\.(?:bin|pt)$/i.test(path));
  if (!resources.length) return [];
  const readmes = paths.filter((path) => /(^|\/)README\.md$/i.test(path));
  const configs = paths.filter((path) => /(^|\/)adapter_config\.json$/i.test(path));
  const sidecars = paths.filter((path) => /(?:\.civitai\.info|\.metadata)?\.json$/i.test(path));
  const textCache = new Map();
  const jsonCache = new Map();
  const hasExamples = paths.some((path) => /\.(?:png|jpe?g|webp|gif)$/i.test(path)) ? 1 : 0;
  const updates = [];

  const cachedText = async (path) => {
    if (!path) return "";
    if (!textCache.has(path)) textCache.set(path, await getText(rawUrl(repo, path)));
    return textCache.get(path);
  };
  const cachedJSON = async (path) => {
    if (!path) return null;
    if (!jsonCache.has(path)) jsonCache.set(path, await getJSON(rawUrl(repo, path)));
    return jsonCache.get(path);
  };

  for (const resourcePath of resources) {
    const treeFile = files.find((item) => text(item.path) === resourcePath);
    const configPath = nearestPath(resourcePath, configs);
    const readmePath = nearestPath(resourcePath, readmes) || readmes.find((path) => /^README\.md$/i.test(path));
    const stem = resourcePath.replace(/\.[^.]+$/, "");
    const sidecarPath = sidecars.find((path) => path.replace(/(?:\.civitai\.info|\.metadata)?\.json$/i, "") === stem) || nearestPath(resourcePath, sidecars);
    const readme = await cachedText(readmePath);
    const fromConfig = configMetadata(await cachedJSON(configPath));
    const fromSidecar = sidecarMetadata(await cachedJSON(sidecarPath));
    const fromHeader = await safetensorsHeader(repo, resourcePath).catch(() => null) || {};
    const readmeTriggers = extractTriggerWords(readme);
    const triggers = [...new Set([...(fromSidecar.triggerWords || []), ...readmeTriggers])].slice(0, 20);
    const readmeWeight = extractWeight(readme);
    const weightMin = fromSidecar.weight ?? readmeWeight[0];
    const weightMax = fromSidecar.weight ?? readmeWeight[1];
    const rank = fromConfig.rank ?? fromHeader.rank ?? null;
    const alpha = fromConfig.alpha ?? fromHeader.alpha ?? null;
    const targetModules = fromConfig.targetModules?.length ? fromConfig.targetModules : (fromHeader.targetModules || []);
    const networkType = fromConfig.networkType || fromHeader.networkType || null;
    const baseModel = fromConfig.baseModel || fromHeader.baseModel || text(row.base_model || "Unknown base");
    const baseFamily = familyFrom(baseModel);
    let confidence = 0.45;
    if (configPath) confidence += 0.2;
    if (fromHeader.rank || fromHeader.alpha || fromHeader.networkType) confidence += 0.15;
    if (triggers.length) confidence += 0.1;
    if (weightMin != null) confidence += 0.05;
    if (treeSha(treeFile)) confidence += 0.05;
    confidence = Math.min(1, Math.round(confidence * 100) / 100);
    const id = `${repo}:${resourcePath}`;
    const hash = treeSha(treeFile);
    updates.push(`UPDATE lora_resources SET size_mb=${sqlNum(treeSize(treeFile))}, sha256=${hash ? sqlText(hash) : "sha256"}, base_model=${sqlText(baseModel)}, base_family=${sqlText(baseFamily)}, trigger_words=${sqlText(JSON.stringify(triggers))}, recommended_weight_min=${sqlNum(weightMin)}, recommended_weight_max=${sqlNum(weightMax)}, lora_rank=${sqlNum(rank)}, alpha=${sqlNum(alpha)}, target_modules=${sqlText(JSON.stringify(targetModules))}, network_type=${networkType ? sqlText(networkType) : "network_type"}, has_examples=${hasExamples}, metadata_confidence=${confidence}, enriched_at=datetime('now') WHERE id=${sqlText(id)};`);
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
