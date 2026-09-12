import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const queries = ["qwen lora", "llama lora", "gemma lora", "flux lora", "wan lora", "ltx lora", "japanese lora", "coding lora"];
const apiHeaders = { Accept: "application/json", ...(process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {}) };
const contentPattern = /nsfw|porn|sex|uncensored|explicit|nudity|18\+|adult/i;
const adapterPattern = /lora|adapter|peft/i;
const concurrency = 4;
const maxPerQuery = 5;

const text = (value, fallback = "") => String(value ?? fallback).replace(/\u0000/g, "").trim();
const sqlText = (value) => `'${text(value).replaceAll("'", "''")}'`;
const sqlNumber = (value) => Number.isFinite(Number(value)) ? String(Number(value)) : "NULL";

async function getJSON(url) {
  const response = await fetch(url, { headers: apiHeaders });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function modelType(model) {
  const pipeline = text(model.pipeline_tag).toLowerCase();
  if (pipeline.includes("video")) return "Video";
  if (pipeline.includes("audio")) return "Audio";
  if (pipeline.includes("image")) return "Image";
  const value = `${pipeline} ${(model.tags || []).join(" ")} ${text(model.library_name)} ${text(model.id)}`.toLowerCase();
  if (value.includes("video") || value.includes("wan") || value.includes("ltx")) return "Video";
  if (value.includes("audio") || value.includes("music")) return "Audio";
  if (value.includes("diffusers") || value.includes("image") || value.includes("flux")) return "Image";
  return "LLM";
}

function baseModel(model, config) {
  const tagged = (model.tags || []).find((tag) => /^base_model:(adapter:)?/i.test(tag));
  const tagBase = tagged?.replace(/^base_model:adapter:/i, "").replace(/^base_model:/i, "");
  return text(model.cardData?.base_model || tagBase || config?.base_model_name_or_path || "Unknown base");
}

function baseFamily(base, id) {
  const value = `${base} ${id}`.toLowerCase();
  if (value.includes("qwen")) return "Qwen";
  if (value.includes("llama")) return "Llama";
  if (value.includes("gemma")) return "Gemma";
  if (value.includes("flux")) return "FLUX";
  if (value.includes("wan")) return "Wan";
  if (value.includes("ltx")) return "LTX";
  return "Other";
}

function purpose(model, type, readme) {
  const value = `${text(model.id)} ${(model.tags || []).join(" ")} ${readme}`.toLowerCase();
  const hits = [];
  if (/coding|code|program|developer/.test(value)) hits.push("Coding");
  if (/japanese|日本語|rinna|ja[-_ ]/.test(value)) hits.push("Japanese");
  if (/reason|math|cot|guardrail/.test(value)) hits.push("Reasoning");
  if (/roleplay|character|persona/.test(value)) hits.push("Character");
  if (/style|toon|ink|film|canny|depth|poster|texture/.test(value)) hits.push("Style");
  if (/motion|video|transition|orbit|upscal|reactive/.test(value)) hits.push("Motion");
  if (!hits.length) hits.push(type === "LLM" ? "Reasoning" : type === "Video" ? "Motion" : "Style");
  return [...new Set(hits)].slice(0, 3).join(", ");
}

function license(model) {
  const tagged = (model.tags || []).find((tag) => /^license:/i.test(tag));
  return text(model.cardData?.license || tagged?.replace(/^license:/i, "") || "Unknown");
}

function commercialUse(value) {
  const normalized = value.toLowerCase();
  if (!normalized || normalized === "unknown" || /openrail|non.?commercial|cc-by-nc|research-only/.test(normalized)) return 0;
  return /apache|mit|bsd|cc-by|gpl|lgpl|mpl|artistic|public.?domain/.test(normalized) ? 1 : 0;
}

function docsQuality(readme) {
  if (!readme) return 1;
  const sections = ["usage", "install", "inference", "trigger", "config", "weight", "license", "model card"];
  const score = sections.reduce((count, term) => count + (new RegExp(term, "i").test(readme) ? 1 : 0), 0);
  return Math.max(1, Math.min(5, 1 + Math.round(score / 2)));
}

function description(readme, id) {
  const cleanReadme = text(readme).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const modelName = text(id.split("/").pop());
  const paragraphs = cleanReadme.split(/\n\s*\n/).filter((part) => !/shields\.io|img\.shields|badge/i.test(part)).map((part) => part.replace(/^#+\s*/, "").replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[`*_>#]/g, "").replace(/\s+/g, " ").trim()).filter((part) => part.length > 40 && part !== modelName && !/^tags?$/i.test(part));
  return (paragraphs[0] || `Hugging Face Hubで公開されている ${id} のLoRA/adapter。READMEと実使用レポートで内容を補完できます。`).slice(0, 360);
}

async function collectCandidates() {
  const seen = new Set();
  const candidates = [];
  for (const query of queries) {
    const list = await getJSON(`https://huggingface.co/api/models?search=${encodeURIComponent(query)}&limit=30&sort=downloads&direction=-1&full=true`);
    let count = 0;
    for (const model of list) {
      const id = text(model.id);
      const tags = (model.tags || []).join(" ");
      if (!id || seen.has(id) || !adapterPattern.test(`${id} ${tags}`)) continue;
      seen.add(id);
      candidates.push({ ...model, sourceQuery: query });
      count += 1;
      if (count >= maxPerQuery) break;
    }
  }
  return candidates;
}

async function enrich(model) {
  const id = text(model.id);
  const tree = await getJSON(`https://huggingface.co/api/models/${id}/tree/main?recursive=true&expand=true`);
  const files = Array.isArray(tree) ? tree.filter((item) => item.type === "file") : [];
  const paths = files.map((item) => text(item.path));
  const weightFiles = files.filter((item) => /(?:adapter_model|lora|pytorch_model|diffusion_pytorch_model).*\.(safetensors|bin|pt)$/i.test(text(item.path)) || /\.safetensors$/i.test(text(item.path)));
  const hasSafeTensors = files.some((item) => /\.safetensors$/i.test(text(item.path)));
  const hasAdapterConfig = paths.some((path) => /(^|\/)adapter_config\.json$/i.test(path));
  if (!hasSafeTensors && !hasAdapterConfig) return null;

  let config = null;
  const configPath = paths.find((path) => /(^|\/)adapter_config\.json$/i.test(path));
  if (configPath) {
    try { config = await getJSON(`https://huggingface.co/${id}/raw/main/${configPath}`); } catch { /* README and model metadata are still useful. */ }
  }

  let readme = "";
  if (paths.some((path) => /^README\.md$/i.test(path))) {
    try {
      const response = await fetch(`https://huggingface.co/${id}/raw/main/README.md`, { headers: apiHeaders });
      if (response.ok) readme = (await response.text()).slice(0, 24000);
    } catch { /* Optional enrichment. */ }
  }

  const base = baseModel(model, config);
  const type = modelType(model);
  const purposeValue = purpose(model, type, readme);
  const licenseValue = license(model);
  const totalBytes = weightFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const fileSizeMb = totalBytes ? Math.round(totalBytes / 1024 / 1024) : null;
  const rank = Number(config?.r ?? config?.lora_rank ?? NaN);
  const docs = docsQuality(readme);
  const downloads = Number(model.downloads || 0);
  const likes = Number(model.likes || 0);
  const updated = text(model.lastModified, new Date().toISOString());
  const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const baseTarget = base === "Unknown base" ? [] : [{ target: base, works: 0, doesnt_work: 0 }];
  const quality = Math.min(100, Math.round((Math.log10(downloads + 1) * 5 + likes / 100 + docs * 2) * 10) / 10);
  const contentFlags = [...new Set((`${id} ${(model.tags || []).join(" ")} ${readme}`.match(new RegExp(contentPattern.source, "gi")) || []).map((flag) => flag.toLowerCase()))];

  return {
    id,
    slug,
    name: text(id.split("/").pop(), id),
    author: text(id.split("/")[0], "unknown"),
    hfUrl: `https://huggingface.co/${id}`,
    type,
    baseFamily: baseFamily(base, id),
    base,
    purpose: purposeValue,
    description: description(readme, id),
    bestFor: `${purposeValue.split(", ")[0]} の試用と比較`,
    license: licenseValue,
    commercialUse: commercialUse(licenseValue),
    rank: Number.isFinite(rank) && rank > 0 ? rank : null,
    fileSizeMb,
    downloads,
    likes,
    docs,
    safeTensors: hasSafeTensors ? 1 : 0,
    contentWarning: contentFlags.length ? 1 : 0,
    contentFlags: JSON.stringify(contentFlags),
    compatibility: JSON.stringify(baseTarget),
    updated,
    quality,
    sourceQuery: model.sourceQuery,
  };
}

function statement(model) {
  const columns = [
    sqlText(model.id), sqlText(model.slug), sqlText(model.name), sqlText(model.author), sqlText(model.hfUrl), sqlText(model.type),
    sqlText(model.baseFamily), sqlText(model.base), sqlText(model.purpose), sqlText(model.description), sqlText(model.bestFor), sqlText(model.license),
    String(model.commercialUse), model.rank == null ? "NULL" : String(model.rank), model.fileSizeMb == null ? "NULL" : String(model.fileSizeMb),
    String(model.downloads), String(model.likes), "NULL", "0", String(model.docs), String(model.safeTensors), String(model.contentWarning), sqlText(model.contentFlags), sqlText(model.compatibility), sqlText(model.updated), String(model.quality)
  ];
  return `INSERT INTO models (id, slug, name, author, hf_url, type, base_family, base_model, purpose, description, best_for, license, commercial_use, lora_rank, file_size_mb, downloads, likes, rating, review_count, docs_quality, safetensors, content_warning, content_flags, compatibility_summary, updated_at, quality_score) VALUES (${columns.join(", ")}) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, author=excluded.author, hf_url=excluded.hf_url, type=excluded.type, base_family=excluded.base_family, base_model=excluded.base_model, purpose=excluded.purpose, description=excluded.description, best_for=excluded.best_for, license=excluded.license, commercial_use=excluded.commercial_use, lora_rank=excluded.lora_rank, file_size_mb=excluded.file_size_mb, downloads=excluded.downloads, likes=excluded.likes, docs_quality=excluded.docs_quality, safetensors=excluded.safetensors, content_warning=excluded.content_warning, content_flags=excluded.content_flags, compatibility_summary=excluded.compatibility_summary, updated_at=excluded.updated_at, quality_score=excluded.quality_score;`;
}

function runD1(sql) {
  const directory = mkdtempSync(join(tmpdir(), "lora-hunt-d1-"));
  const file = join(directory, "import.sql");
  writeFileSync(file, sql, "utf8");
  try {
    const result = spawnSync("npx", ["wrangler", "d1", "execute", "lora-hunt-db", "--remote", "--file", file], { stdio: "inherit", windowsHide: true, shell: true });
    if (result.status !== 0) throw new Error(`Wrangler D1 import failed with status ${result.status}: ${result.error?.message || result.signal || "unknown error"}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const candidates = await collectCandidates();
const enriched = [];
for (let index = 0; index < candidates.length; index += concurrency) {
  const batch = await Promise.all(candidates.slice(index, index + concurrency).map((candidate) => enrich(candidate).catch((error) => {
    console.warn(`Skipping ${candidate.id}: ${error.message}`);
    return null;
  })));
  enriched.push(...batch.filter(Boolean));
  console.log(`Enriched ${Math.min(index + concurrency, candidates.length)}/${candidates.length}`);
}

for (let index = 0; index < enriched.length; index += 8) {
  runD1(enriched.slice(index, index + 8).map(statement).join("\n"));
}

console.log(JSON.stringify({ candidates: candidates.length, imported: enriched.length, ids: enriched.map((model) => model.id) }, null, 2));
