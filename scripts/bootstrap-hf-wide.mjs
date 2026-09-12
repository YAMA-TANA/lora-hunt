import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const headers = { Accept: "application/json", ...(process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {}) };
const catalogFilters = (process.env.HF_CATALOG_FILTERS || "lora").split(",").map((value) => value.trim()).filter(Boolean);
const maxCandidates = Math.max(0, Number(process.env.HF_CATALOG_MAX || 0)); // 0 = no artificial cap
const pageSize = 500;
const importBatchSize = 100;
const text = (value, fallback = "") => String(value ?? fallback).replace(/\u0000/g, "").trim();
const sqlText = (value) => `'${text(value).replaceAll("'", "''")}'`;

function parseNextLink(header) {
  if (!header) return null;
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="?next"?/i);
    if (match) return match[1];
  }
  return null;
}

function familyFrom(base, id) {
  const value = `${base} ${id}`.toLowerCase();
  if (value.includes("qwen")) return "Qwen";
  if (value.includes("llama")) return "Llama";
  if (value.includes("gemma")) return "Gemma";
  if (value.includes("mistral")) return "Mistral";
  if (value.includes("flux")) return "FLUX";
  if (value.includes("wan")) return "Wan";
  if (value.includes("ltx")) return "LTX";
  if (value.includes("stable-diffusion-xl") || /\bsdxl\b/i.test(value)) return "SDXL";
  if (value.includes("illustrious")) return "Illustrious";
  if (value.includes("pony")) return "Pony";
  return "Other";
}

function typeFrom(model) {
  const value = `${model.pipeline_tag || ""} ${(model.tags || []).join(" ")} ${model.library_name || ""} ${model.id || ""}`.toLowerCase();
  if (/video|wan|ltx|hunyuanvideo|cogvideo/.test(value)) return "Video";
  if (/audio|music|voice|speech|tts/.test(value)) return "Audio";
  if (/image|diffusers|flux|stable-diffusion|sdxl|sd3|illustrious|pony|qwen-image/.test(value)) return "Image";
  return "LLM";
}

function purposeFrom(model) {
  const value = `${model.id || ""} ${(model.tags || []).join(" ")} ${JSON.stringify(model.cardData || {})}`.toLowerCase();
  const hits = [];
  if (/japanese|日本語|language:ja|\bja[-_ ]/.test(value)) hits.push("Japanese");
  if (/role.?play|character|persona|chat/.test(value)) hits.push("Character");
  if (/coding|code|program|developer/.test(value)) hits.push("Coding");
  if (/reason|math|cot/.test(value)) hits.push("Reasoning");
  if (/style|anime|realistic|photo|portrait|concept|illustration|texture|artist/.test(value)) hits.push("Style");
  if (/motion|video|camera|animation|transition/.test(value)) hits.push("Motion");
  return [...new Set(hits)].slice(0, 4).join(", ") || (typeFrom(model) === "Video" ? "Motion" : typeFrom(model) === "Image" ? "Style" : "General");
}

function baseFrom(model) {
  const tags = model.tags || [];
  const tagged = tags.find((tag) => /^base_model:(adapter:)?/i.test(tag));
  const cardBase = model.cardData?.base_model;
  const normalizedCardBase = Array.isArray(cardBase) ? cardBase[0] : cardBase;
  return text(normalizedCardBase || tagged?.replace(/^base_model:(adapter:)?/i, "") || "Unknown base");
}

function licenseFrom(model) {
  const tagged = (model.tags || []).find((tag) => /^license:/i.test(tag));
  return text(model.cardData?.license || tagged?.replace(/^license:/i, "") || "Unknown");
}

function commercialUse(license) {
  const value = license.toLowerCase();
  if (!value || value === "unknown" || /openrail|non.?commercial|cc-by-nc|research-only/.test(value)) return 0;
  return /apache|mit|bsd|cc-by|gpl|lgpl|mpl|public.?domain/.test(value) ? 1 : 0;
}

function filePaths(model) {
  return (model.siblings || []).map((file) => text(file.rfilename || file.path)).filter(Boolean);
}

function looksLikeLoRA(model) {
  const tags = (model.tags || []).join(" ");
  const files = filePaths(model);
  const hasLoraTag = /(^|\s|,)lora(\s|,|$)/i.test(tags);
  const hasConfig = files.some((path) => /(^|\/)adapter_config\.json$/i.test(path));
  const hasSafeWeights = files.some((path) => /\.safetensors$/i.test(path));
  const hasNamedWeights = files.some((path) => /(?:lora|adapter|diffusion_pytorch_model|pytorch_lora_weights).*\.(?:safetensors|bin|pt)$/i.test(path));
  const hasLoraNamedSafeTensor = files.some((path) => /lora/i.test(path) && /\.safetensors$/i.test(path));
  return (hasLoraTag && hasSafeWeights) || (hasConfig && hasNamedWeights) || hasLoraNamedSafeTensor;
}

function statement(model) {
  const id = text(model.id);
  const base = baseFrom(model);
  const type = typeFrom(model);
  const purpose = purposeFrom(model);
  const license = licenseFrom(model);
  const downloads = Number(model.downloads || 0);
  const likes = Number(model.likes || 0);
  const updated = text(model.lastModified, new Date().toISOString());
  const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const files = filePaths(model);
  const safetensors = files.some((path) => /\.safetensors$/i.test(path)) || (model.tags || []).some((tag) => /safetensors/i.test(tag)) ? 1 : 0;
  const quality = Math.min(100, Math.round((Math.log10(downloads + 1) * 6 + Math.log10(likes + 1) * 7) * 10) / 10);
  const description = `LoRA or adapter hosted on Hugging Face. LoRA Hunt normalizes its base model, purpose, files, popularity, and compatibility metadata for search.`;
  const bestFor = purpose === "General" ? "Check the model card for intended use" : `${purpose.split(", ")[0]} workflows`;
  const columns = [sqlText(id), sqlText(slug), sqlText(id.split("/").pop() || id), sqlText(id.split("/")[0] || "unknown"), sqlText(`https://huggingface.co/${id}`), sqlText(type), sqlText(familyFrom(base, id)), sqlText(base), sqlText(purpose), sqlText(description), sqlText(bestFor), sqlText(license), String(commercialUse(license)), "NULL", "NULL", String(downloads), String(likes), "NULL", "0", "1", String(safetensors), "0", sqlText("[]"), sqlText("[]"), sqlText(updated), String(quality)];
  return `INSERT OR IGNORE INTO models (id, slug, name, author, hf_url, type, base_family, base_model, purpose, description, best_for, license, commercial_use, lora_rank, file_size_mb, downloads, likes, rating, review_count, docs_quality, safetensors, content_warning, content_flags, compatibility_summary, updated_at, quality_score) VALUES (${columns.join(", ")});`;
}

function runD1(sql) {
  if (!sql.trim()) return;
  const directory = mkdtempSync(join(tmpdir(), "lora-hunt-catalog-"));
  const file = join(directory, "import.sql");
  writeFileSync(file, sql, "utf8");
  try {
    const result = spawnSync("npx", ["wrangler", "d1", "execute", "lora-hunt-db", "--remote", "--file", file], { stdio: "inherit", windowsHide: true, shell: true });
    if (result.status !== 0) throw new Error(`D1 import failed with status ${result.status}`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

async function* listCatalog(filter) {
  const params = new URLSearchParams({ limit: String(pageSize), filter, sort: "downloads", direction: "-1" });
  for (const field of ["tags", "cardData", "siblings", "pipeline_tag", "library_name", "downloads", "likes", "lastModified"]) params.append("expand", field);
  let url = `https://huggingface.co/api/models?${params.toString()}`;
  while (url) {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${response.status} while listing ${filter}`);
    const items = await response.json();
    for (const item of items) yield item;
    url = parseNextLink(response.headers.get("Link"));
  }
}

const seen = new Set();
let accepted = 0;
let scanned = 0;
let batch = [];

for (const filter of catalogFilters) {
  console.log(`Catalog pass: filter=${filter}`);
  try {
    for await (const model of listCatalog(filter)) {
      scanned += 1;
      const id = text(model.id);
      if (!id || seen.has(id) || !looksLikeLoRA(model)) continue;
      seen.add(id);
      batch.push(statement(model));
      accepted += 1;
      if (batch.length >= importBatchSize) {
        runD1(batch.join("\n"));
        batch = [];
        console.log(`Processed ${accepted.toLocaleString()} unique LoRA candidates (${scanned.toLocaleString()} scanned). Existing rows are skipped without rewriting them.`);
      }
      if (maxCandidates && accepted >= maxCandidates) break;
    }
  } catch (error) {
    console.warn(`Catalog pass stopped for ${filter}: ${error.message}`);
  }
  if (maxCandidates && accepted >= maxCandidates) break;
}

runD1(batch.join("\n"));
console.log(JSON.stringify({ filters: catalogFilters, scanned, accepted, maxCandidates: maxCandidates || "unlimited", mode: "insert-new-only" }, null, 2));
