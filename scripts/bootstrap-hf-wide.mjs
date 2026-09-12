import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const queryGroups = [
  ["lora", "adapter", "peft", "diffusers lora"],
  ["qwen lora", "qwen2 lora", "qwen2.5 lora", "qwen3 lora", "qwen image lora", "qwen image edit lora"],
  ["llama lora", "llama 3 lora", "llama 3.1 lora", "llama 3.2 lora", "gemma lora", "gemma 2 lora", "gemma 3 lora", "mistral lora"],
  ["japanese lora", "日本語 lora", "japanese roleplay lora", "japanese character lora", "roleplay lora", "character lora", "persona lora", "chat lora"],
  ["coding lora", "code lora", "reasoning lora", "math lora", "instruction lora", "translation lora", "creative writing lora"],
  ["flux lora", "flux.1 lora", "flux.2 lora", "sdxl lora", "stable diffusion lora", "sd3 lora", "illustrious lora", "pony lora"],
  ["style lora", "anime lora", "realistic lora", "photo lora", "portrait lora", "character image lora", "concept lora", "control lora"],
  ["wan lora", "wan 2.1 lora", "wan 2.2 lora", "ltx lora", "video lora", "motion lora", "camera lora", "animation lora"],
  ["audio lora", "music lora", "voice lora", "speech lora", "tts lora"],
  ["nsfw lora", "uncensored lora"]
];

const queries = [...new Set(queryGroups.flat())];
const headers = { Accept: "application/json", ...(process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {}) };
const maxPerQuery = Number(process.env.HF_WIDE_PER_QUERY || 80);
const maxCandidates = Number(process.env.HF_WIDE_MAX || 4000);
const adapterPattern = /lora|adapter|peft/i;
const text = (value, fallback = "") => String(value ?? fallback).replace(/\u0000/g, "").trim();
const sqlText = (value) => `'${text(value).replaceAll("'", "''")}'`;

function familyFrom(base, id) {
  const value = `${base} ${id}`.toLowerCase();
  if (value.includes("qwen")) return "Qwen";
  if (value.includes("llama")) return "Llama";
  if (value.includes("gemma")) return "Gemma";
  if (value.includes("flux")) return "FLUX";
  if (value.includes("wan")) return "Wan";
  if (value.includes("ltx")) return "LTX";
  return "Other";
}

function typeFrom(model) {
  const value = `${model.pipeline_tag || ""} ${(model.tags || []).join(" ")} ${model.library_name || ""} ${model.id || ""}`.toLowerCase();
  if (/video|wan|ltx/.test(value)) return "Video";
  if (/audio|music|voice|speech|tts/.test(value)) return "Audio";
  if (/image|diffusers|flux|stable-diffusion|sdxl|sd3|illustrious|pony/.test(value)) return "Image";
  return "LLM";
}

function purposeFrom(model, sourceQuery) {
  const value = `${model.id || ""} ${(model.tags || []).join(" ")} ${sourceQuery}`.toLowerCase();
  const hits = [];
  if (/japanese|日本語|ja[-_ ]/.test(value)) hits.push("Japanese");
  if (/role.?play|character|persona|chat/.test(value)) hits.push("Character");
  if (/coding|code|program|developer/.test(value)) hits.push("Coding");
  if (/reason|math|cot/.test(value)) hits.push("Reasoning");
  if (/style|anime|realistic|photo|portrait|concept|illustration|texture/.test(value)) hits.push("Style");
  if (/motion|video|camera|animation|transition/.test(value)) hits.push("Motion");
  return [...new Set(hits)].slice(0, 4).join(", ") || (typeFrom(model) === "Video" ? "Motion" : typeFrom(model) === "Image" ? "Style" : "General");
}

function baseFrom(model) {
  const tagged = (model.tags || []).find((tag) => /^base_model:(adapter:)?/i.test(tag));
  return text(model.cardData?.base_model || tagged?.replace(/^base_model:(adapter:)?/i, "") || "Unknown base");
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

async function fetchList(query, sort) {
  const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&limit=100&sort=${sort}&direction=-1&full=true`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${query} ${sort}`);
  return response.json();
}

async function collect() {
  const seen = new Map();
  for (const query of queries) {
    for (const sort of ["downloads", "lastModified"]) {
      let list = [];
      try { list = await fetchList(query, sort); }
      catch (error) { console.warn(`Search failed: ${error.message}`); continue; }
      let accepted = 0;
      for (const model of list) {
        const id = text(model.id);
        const tags = (model.tags || []).join(" ");
        if (!id || !adapterPattern.test(`${id} ${tags}`)) continue;
        if (!seen.has(id)) seen.set(id, { ...model, sourceQuery: query });
        accepted += 1;
        if (accepted >= maxPerQuery || seen.size >= maxCandidates) break;
      }
      if (seen.size >= maxCandidates) return [...seen.values()];
    }
  }
  return [...seen.values()];
}

function statement(model) {
  const id = text(model.id);
  const base = baseFrom(model);
  const type = typeFrom(model);
  const purpose = purposeFrom(model, model.sourceQuery || "");
  const license = licenseFrom(model);
  const downloads = Number(model.downloads || 0);
  const likes = Number(model.likes || 0);
  const updated = text(model.lastModified, new Date().toISOString());
  const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const safetensors = (model.siblings || []).some((file) => /\.safetensors$/i.test(file.rfilename || "")) || (model.tags || []).some((tag) => /safetensors/i.test(tag)) ? 1 : 0;
  const quality = Math.min(100, Math.round((Math.log10(downloads + 1) * 6 + Math.log10(likes + 1) * 7) * 10) / 10);
  const description = `Hugging Faceで公開されている ${id} のLoRA/adapter。詳細な使い方と条件は元のモデルカードで確認できます。`;
  const bestFor = purpose === "General" ? "モデルカードで用途を確認" : `${purpose.split(", ")[0]}向け`;
  const columns = [sqlText(id), sqlText(slug), sqlText(id.split("/").pop() || id), sqlText(id.split("/")[0] || "unknown"), sqlText(`https://huggingface.co/${id}`), sqlText(type), sqlText(familyFrom(base, id)), sqlText(base), sqlText(purpose), sqlText(description), sqlText(bestFor), sqlText(license), String(commercialUse(license)), "NULL", "NULL", String(downloads), String(likes), "NULL", "0", "1", String(safetensors), "0", sqlText("[]"), sqlText("[]"), sqlText(updated), String(quality)];
  return `INSERT INTO models (id, slug, name, author, hf_url, type, base_family, base_model, purpose, description, best_for, license, commercial_use, lora_rank, file_size_mb, downloads, likes, rating, review_count, docs_quality, safetensors, content_warning, content_flags, compatibility_summary, updated_at, quality_score) VALUES (${columns.join(", ")}) ON CONFLICT(id) DO UPDATE SET downloads=excluded.downloads, likes=excluded.likes, updated_at=excluded.updated_at, base_family=CASE WHEN models.base_family='Other' THEN excluded.base_family ELSE models.base_family END, base_model=CASE WHEN models.base_model='Unknown base' THEN excluded.base_model ELSE models.base_model END, purpose=CASE WHEN models.purpose='General' THEN excluded.purpose ELSE models.purpose END, license=CASE WHEN models.license='Unknown' THEN excluded.license ELSE models.license END, safetensors=MAX(models.safetensors, excluded.safetensors), quality_score=MAX(models.quality_score, excluded.quality_score);`;
}

function runD1(sql) {
  const directory = mkdtempSync(join(tmpdir(), "lora-hunt-wide-"));
  const file = join(directory, "import.sql");
  writeFileSync(file, sql, "utf8");
  try {
    const result = spawnSync("npx", ["wrangler", "d1", "execute", "lora-hunt-db", "--remote", "--file", file], { stdio: "inherit", windowsHide: true, shell: true });
    if (result.status !== 0) throw new Error(`D1 import failed with status ${result.status}`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

const candidates = await collect();
console.log(`Collected ${candidates.length} unique LoRA/adapter candidates from ${queries.length} search phrases.`);
for (let index = 0; index < candidates.length; index += 75) {
  runD1(candidates.slice(index, index + 75).map(statement).join("\n"));
  console.log(`Imported ${Math.min(index + 75, candidates.length)}/${candidates.length}`);
}
console.log(JSON.stringify({ queries: queries.length, imported: candidates.length, maxPerQuery, maxCandidates }, null, 2));
