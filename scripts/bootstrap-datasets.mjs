import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const queries = ["instruction dataset", "japanese dataset", "coding dataset", "image dataset", "video dataset", "audio dataset", "qwen dataset"];
const apiHeaders = { Accept: "application/json", ...(process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {}) };
const concurrency = 4;
const maxPerQuery = 4;
const text = (value, fallback = "") => String(value ?? fallback).replace(/\u0000/g, "").trim();
const sqlText = (value) => `'${text(value).replaceAll("'", "''")}'`;

async function getJSON(url) {
  const response = await fetch(url, { headers: apiHeaders });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function license(dataset) {
  const tag = (dataset.tags || []).find((value) => /^license:/i.test(value));
  return text(dataset.cardData?.license || tag?.replace(/^license:/i, "") || "Unknown");
}

function task(dataset) {
  const value = `${text(dataset.id)} ${(dataset.tags || []).join(" ")} ${text(dataset.pipeline_tag)}`.toLowerCase();
  if (/code|program|sft|instruction|chat/.test(value)) return "Text · instruction / coding";
  if (/video|motion/.test(value)) return "Video · caption / motion";
  if (/audio|music|speech/.test(value)) return "Audio · speech / music";
  if (/image|vision|caption|multimodal/.test(value)) return "Image · caption / vision";
  return "Text · pretraining / fine-tuning";
}

function docsQuality(readme) {
  if (!readme) return 1;
  const sections = ["dataset card", "usage", "load_dataset", "features", "license", "citation", "format", "languages"];
  const score = sections.reduce((count, term) => count + (new RegExp(term, "i").test(readme) ? 1 : 0), 0);
  return Math.max(1, Math.min(5, 1 + Math.round(score / 2)));
}

function description(readme, id) {
  const cleanReadme = text(readme).replace(/^---[\s\S]*?---\s*/m, "");
  const paragraphs = cleanReadme.split(/\n\s*\n/).filter((part) => !/shields\.io|img\.shields|badge/i.test(part)).map((part) => part.replace(/^#+\s*/, "").replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[`*_>#]/g, "").replace(/\s+/g, " ").trim()).filter((part) => part.length > 40 && !/^tags?$/i.test(part));
  return (paragraphs[0] || `Hugging Face Hubで公開されている ${id} のデータセット。用途・ライセンス・更新日を確認してから利用できます。`).slice(0, 360);
}

async function collect() {
  const seen = new Set();
  const candidates = [];
  for (const query of queries) {
    const list = await getJSON(`https://huggingface.co/api/datasets?search=${encodeURIComponent(query)}&limit=30&sort=downloads&direction=-1&full=true`);
    let count = 0;
    for (const dataset of list) {
      const id = text(dataset.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      candidates.push({ ...dataset, sourceQuery: query });
      count += 1;
      if (count >= maxPerQuery) break;
    }
  }
  return candidates;
}

async function enrich(dataset) {
  const id = text(dataset.id);
  const tree = await getJSON(`https://huggingface.co/api/datasets/${id}/tree/main?recursive=true&expand=true`);
  const files = Array.isArray(tree) ? tree.filter((item) => item.type === "file") : [];
  let readme = "";
  if (files.some((item) => /^README\.md$/i.test(text(item.path)))) {
    try {
      const response = await fetch(`https://huggingface.co/datasets/${id}/raw/main/README.md`, { headers: apiHeaders });
      if (response.ok) readme = (await response.text()).slice(0, 24000);
    } catch { /* Optional enrichment. */ }
  }
  const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const downloads = Number(dataset.downloads || 0);
  const likes = Number(dataset.likes || 0);
  const docs = docsQuality(readme);
  const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const licenseValue = license(dataset);
  return {
    id,
    slug,
    name: text(id.split("/").pop(), id),
    author: text(id.split("/")[0], "unknown"),
    hfUrl: `https://huggingface.co/datasets/${id}`,
    task: task(dataset),
    description: description(readme, id),
    tags: JSON.stringify((dataset.tags || []).filter((value) => !/^base_model:/i.test(value)).slice(0, 12)),
    license: licenseValue,
    downloads,
    likes,
    fileSizeMb: totalBytes ? Math.round(totalBytes / 1024 / 1024) : null,
    filesCount: files.length,
    docs,
    gated: dataset.gated ? 1 : 0,
    updated: text(dataset.lastModified, new Date().toISOString()),
    quality: Math.min(100, Math.round((Math.log10(downloads + 1) * 5 + likes / 100 + docs * 2) * 10) / 10)
  };
}

function statement(dataset) {
  const values = [dataset.id, dataset.slug, dataset.name, dataset.author, dataset.hfUrl, dataset.task, dataset.description, dataset.tags, dataset.license, dataset.downloads, dataset.likes, dataset.fileSizeMb, dataset.filesCount, dataset.docs, dataset.gated, dataset.updated, dataset.quality];
  const escaped = values.map((value) => typeof value === "number" ? String(value) : value == null ? "NULL" : sqlText(value));
  return `INSERT INTO datasets (id, slug, name, author, hf_url, task, description, tags, license, downloads, likes, file_size_mb, files_count, docs_quality, gated, updated_at, quality_score) VALUES (${escaped.join(", ")}) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, author=excluded.author, hf_url=excluded.hf_url, task=excluded.task, description=excluded.description, tags=excluded.tags, license=excluded.license, downloads=excluded.downloads, likes=excluded.likes, file_size_mb=excluded.file_size_mb, files_count=excluded.files_count, docs_quality=excluded.docs_quality, gated=excluded.gated, updated_at=excluded.updated_at, quality_score=excluded.quality_score;`;
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

const candidates = await collect();
const datasets = [];
for (let index = 0; index < candidates.length; index += concurrency) {
  const batch = await Promise.all(candidates.slice(index, index + concurrency).map((candidate) => enrich(candidate).catch((error) => {
    console.warn(`Skipping ${candidate.id}: ${error.message}`);
    return null;
  })));
  datasets.push(...batch.filter(Boolean));
  console.log(`Enriched ${Math.min(index + concurrency, candidates.length)}/${candidates.length}`);
}
for (let index = 0; index < datasets.length; index += 8) runD1(datasets.slice(index, index + 8).map(statement).join("\n"));
console.log(JSON.stringify({ candidates: candidates.length, imported: datasets.length, ids: datasets.map((dataset) => dataset.id) }, null, 2));
