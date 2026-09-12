import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const site = "https://lora-hunt.pages.dev";
const output = join(process.cwd(), "public");
const cssVersion = "20260912.6";

const html = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const number = (value) => new Intl.NumberFormat("en-US", { notation: Number(value) > 99999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value || 0));
const date = (value) => String(value || "").slice(0, 10);
const safeSlug = (value) => String(value || "").replace(/[^a-z0-9-]/gi, "-");

function queryD1(sql) {
  const command = `npx wrangler d1 execute lora-hunt-db --remote --command ${JSON.stringify(sql)} --json`;
  const result = spawnSync(command, { shell: true, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || `D1 query failed with status ${result.status}`);
  const payload = JSON.parse(result.stdout.trim());
  return payload[0]?.results || [];
}

function writePage(path, content) {
  const file = join(output, path, "index.html");
  mkdirSync(join(output, path), { recursive: true });
  writeFileSync(file, content, "utf8");
}

function head(title, description, canonical, schema) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#f5f7fa" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/site.webmanifest" />
    <link rel="canonical" href="${html(canonical)}" />
    <link rel="stylesheet" href="/tokens.css?v=${cssVersion}" />
    <link rel="stylesheet" href="/styles.css?v=${cssVersion}" />
    <meta name="description" content="${html(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="LoRA Hunt" />
    <meta property="og:title" content="${html(title)}" />
    <meta property="og:description" content="${html(description)}" />
    <meta property="og:url" content="${html(canonical)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${html(title)}" />
    <meta name="twitter:description" content="${html(description)}" />
    <title>${html(title)}</title>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-YZ8R7GTWQR"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-YZ8R7GTWQR');
    </script>
    <script type="application/ld+json">${json(schema)}</script>
  </head>`;
}

function header() {
  return `<header class="site-header"><div class="header-inner"><a class="wordmark" href="/" aria-label="LoRA Hunt home"><span class="wordmark-mark">LH</span><span>LoRA Hunt</span></a><a class="search-pill legal-backlink" href="/"><span class="search-icon" aria-hidden="true">⌕</span><span class="search-pill-label">Search the adapter index</span></a><nav class="header-nav" aria-label="Primary navigation"><a href="/#explore">Explore</a><a href="/datasets/">Datasets</a><a href="/#lists">Best lists</a></nav></div></header>`;
}

function footer() {
  return `<footer class="site-footer"><p>© 2026 LoRA Hunt · metadata synced from Hugging Face.</p><div><a href="/privacy/">Privacy</a><span>·</span><a href="/terms/">Terms</a><span>·</span><a href="https://huggingface.co/models" target="_blank" rel="noreferrer">Hugging Face ↗</a></div></footer>`;
}

function parseCompatibility(value) {
  try { return JSON.parse(value || "[]"); } catch { return []; }
}

function modelLink(model) {
  return `/lora/${safeSlug(model.slug)}/`;
}

function modelDirectoryItem(model) {
  const rating = model.rating == null ? "No rating" : `${Number(model.rating).toFixed(1)} / 5`;
  return `<a class="seo-list-item" href="${html(modelLink(model))}"><span class="type-badge">${html(model.type)}</span><div><strong>${html(model.name)}</strong><small>${html(model.author)} · Base ${html(model.base_model)} · ${number(model.downloads)} downloads</small></div><em>${html(rating)}</em></a>`;
}

function datasetDirectoryItem(dataset) {
  return `<a class="seo-list-item" href="/dataset/${html(safeSlug(dataset.slug))}/"><span class="type-badge">Dataset</span><div><strong>${html(dataset.name)}</strong><small>${html(dataset.author)} · ${html(dataset.task)} · ${number(dataset.downloads)} downloads</small></div><em>${html(dataset.license || "Unknown")}</em></a>`;
}

function modelPage(model) {
  const compatibility = parseCompatibility(model.compatibility_summary);
  const rating = model.rating == null ? "No rating yet" : `${Number(model.rating).toFixed(1)} / 5`;
  const description = `${model.name} — ${model.purpose} LoRA for ${model.base_model}. Compare compatibility, file metadata, community evidence, and the original Hugging Face model card.`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: model.name,
    description: model.description,
    url: `${site}${modelLink(model)}`,
    codeRepository: model.hf_url,
    dateModified: model.updated_at,
    author: { "@type": "Person", name: model.author },
    isPartOf: { "@type": "WebSite", name: "LoRA Hunt", url: `${site}/` },
    keywords: `${model.base_family}, ${model.base_model}, ${model.purpose}, LoRA, Hugging Face`
  };
  const warning = Number(model.content_warning) ? `<aside class="content-warning-panel"><strong>Content warning</strong><span>This Hub item is labeled with ${html(model.content_flags || "adult or explicit content")}. Review the original card and license before use.</span></aside>` : "";
  const compatibilityRows = compatibility.length ? compatibility.map((item) => `<li><span>${html(item.target)}</span><b>✓ ${number(item.works)}</b><b class="is-negative">× ${number(item.doesnt_work)}</b></li>`).join("") : `<li><span>No community reports yet</span></li>`;
  return `${head(`${model.name} — LoRA Hunt`, description, `${site}${modelLink(model)}`, schema)}
  <body>${header()}<main class="detail-page">
    <a class="detail-back" href="/">← Back to adapter index</a>
    <p class="mono-kicker">ADAPTER / ${html(model.type)} / ${html(model.base_family)}</p>
    <div class="detail-hero"><div><div class="card-topline"><span class="type-badge">${html(model.type)}</span>${model.commercial_use ? `<span class="license-badge">Commercial</span>` : ""}<span class="license-badge">${html(model.license)}</span></div><h1>${html(model.name)}</h1><p class="detail-author">by ${html(model.author)} · updated ${html(date(model.updated_at))}</p><p class="detail-lede">${html(model.description)}</p><div class="detail-actions"><a class="primary-button" href="${html(model.hf_url)}" target="_blank" rel="noreferrer">Open on Hugging Face ↗</a><a class="outline-button" href="/#explore?q=${encodeURIComponent(model.name)}">Find similar adapters</a></div></div><aside class="detail-score"><span class="panel-label">COMMUNITY SIGNAL</span><strong>${html(rating)}</strong><span>${number(model.review_count)} reviews · Docs ${number(model.docs_quality)}/5</span></aside></div>
    ${warning}
    <section class="detail-facts" aria-label="Adapter facts"><div><span>Base model</span><strong>${html(model.base_model)}</strong></div><div><span>Best for</span><strong>${html(model.best_for)}</strong></div><div><span>LoRA rank</span><strong>${model.lora_rank ? `r${html(model.lora_rank)}` : "Not listed"}</strong></div><div><span>File</span><strong>${model.file_size_mb ? `${number(model.file_size_mb)} MB` : "Size n/a"} · ${model.safetensors ? "safetensors" : "other"}</strong></div><div><span>Downloads</span><strong>${number(model.downloads)}</strong></div><div><span>Likes</span><strong>${number(model.likes)}</strong></div></section>
    <div class="detail-columns"><section class="detail-section"><p class="panel-label">COMPATIBILITY</p><h2>Where it has been tried.</h2><p>Community reports are attached to a target and runtime, so a green result has context.</p><ul class="detail-compatibility">${compatibilityRows}</ul></section><section class="detail-section"><p class="panel-label">USE IT WELL</p><h2>What to check next.</h2><ul class="detail-checklist"><li>Confirm the base model and adapter format before loading.</li><li>Start with a conservative LoRA scale, then record the setting in a review.</li><li>Read the license and original model card before commercial use.</li></ul><a class="section-link" href="${html(model.hf_url)}" target="_blank" rel="noreferrer">Read the original Hub card ↗</a></section></div>
    <section class="detail-source"><span class="panel-label">INDEX NOTE</span><p>LoRA Hunt stores searchable Hugging Face metadata and community evidence. The model files remain at the linked source.</p><a href="/privacy/">Privacy</a><span>·</span><a href="/terms/">Terms</a></section>
  </main>${footer()}</body></html>`;
}

function datasetPage(dataset) {
  let tags = [];
  try { tags = JSON.parse(dataset.tags || "[]"); } catch { tags = []; }
  const description = `${dataset.name} — ${dataset.task} dataset on Hugging Face. Check license, size, documentation, and source files before training or evaluation.`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: dataset.name,
    description: dataset.description,
    url: `${site}/dataset/${safeSlug(dataset.slug)}/`,
    sameAs: dataset.hf_url,
    license: dataset.license,
    dateModified: dataset.updated_at,
    creator: { "@type": "Person", name: dataset.author },
    keywords: `${dataset.task}, ${(tags || []).join(", ")}`
  };
  return `${head(`${dataset.name} — Dataset | LoRA Hunt`, description, `${site}/dataset/${safeSlug(dataset.slug)}/`, schema)}
  <body>${header()}<main class="detail-page"><a class="detail-back" href="/datasets/">← Back to datasets</a><p class="mono-kicker">DATASET / ${html(dataset.task)}</p><div class="detail-hero"><div><div class="card-topline"><span class="type-badge">Dataset</span><span class="license-badge">${html(dataset.license)}</span>${dataset.gated ? `<span class="license-badge">Gated</span>` : ""}</div><h1>${html(dataset.name)}</h1><p class="detail-author">by ${html(dataset.author)} · updated ${html(date(dataset.updated_at))}</p><p class="detail-lede">${html(dataset.description)}</p><div class="detail-actions"><a class="primary-button" href="${html(dataset.hf_url)}" target="_blank" rel="noreferrer">Open dataset on HF ↗</a><a class="outline-button" href="/datasets/">Browse more datasets</a></div></div><aside class="detail-score"><span class="panel-label">DATA SIGNAL</span><strong>${number(dataset.downloads)}</strong><span>downloads · ${number(dataset.likes)} likes</span></aside></div><section class="detail-facts" aria-label="Dataset facts"><div><span>Task</span><strong>${html(dataset.task)}</strong></div><div><span>Files</span><strong>${number(dataset.files_count)}</strong></div><div><span>Size</span><strong>${dataset.file_size_mb ? `${number(dataset.file_size_mb)} MB` : "Size n/a"}</strong></div><div><span>Documentation</span><strong>${number(dataset.docs_quality)}/5</strong></div><div><span>License</span><strong>${html(dataset.license)}</strong></div><div><span>Updated</span><strong>${html(date(dataset.updated_at))}</strong></div></section><div class="detail-columns"><section class="detail-section"><p class="panel-label">TAGS</p><h2>How it is described.</h2><div class="dataset-tags">${tags.slice(0, 16).map((tag) => `<span>${html(tag)}</span>`).join("") || "<span>No tags listed</span>"}</div></section><section class="detail-section"><p class="panel-label">CHECK BEFORE USE</p><h2>Make the source verifiable.</h2><ul class="detail-checklist"><li>Read the dataset card and license at the source.</li><li>Check splits, features, language, and data provenance.</li><li>Record the dataset revision when sharing an experiment.</li></ul></section></div><section class="detail-source"><span class="panel-label">INDEX NOTE</span><p>Dataset metadata is indexed separately from adapters. LoRA Hunt does not mirror the dataset files.</p><a href="/privacy/">Privacy</a><span>·</span><a href="/terms/">Terms</a></section></main>${footer()}</body></html>`;
}

function directoryPage(title, description, canonical, items, label = "STARTING POINT") {
  const schema = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, description, url: canonical, isPartOf: { "@type": "WebSite", name: "LoRA Hunt", url: `${site}/` } };
  return `${head(`${title} — LoRA Hunt`, description, canonical, schema)}<body>${header()}<main class="directory-page"><a class="detail-back" href="/">← Back to adapter index</a><p class="mono-kicker">${html(label)}</p><h1>${html(title)}</h1><p class="directory-lede">${html(description)}</p><div class="seo-directory">${items.length ? items.map(modelDirectoryItem).join("") : `<div class="dataset-empty"><p class="empty-title">No indexed entries yet.</p></div>`}</div></main>${footer()}</body></html>`;
}

function datasetDirectoryPage(datasets) {
  const title = "Datasets for training and evaluation";
  const description = "Hugging Face datasets organized by task, license, size, documentation, and usage signals.";
  const schema = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, description, url: `${site}/datasets/`, isPartOf: { "@type": "WebSite", name: "LoRA Hunt", url: `${site}/` } };
  return `${head(`${title} — LoRA Hunt`, description, `${site}/datasets/`, schema)}<body>${header()}<main class="directory-page"><a class="detail-back" href="/">← Back to adapter index</a><p class="mono-kicker">TRAINING DATA / ${number(datasets.length)} INDEXED</p><h1>${html(title)}</h1><p class="directory-lede">Datasets are kept separate from LoRAs, so task, license, documentation, and source provenance stay visible.</p><div class="seo-directory">${datasets.map(datasetDirectoryItem).join("")}</div></main>${footer()}</body></html>`;
}

const models = queryD1("SELECT id, slug, name, author, hf_url, type, base_family, base_model, purpose, description, best_for, license, commercial_use, lora_rank, file_size_mb, downloads, likes, rating, review_count, docs_quality, safetensors, compatibility_summary, content_warning, content_flags, updated_at FROM models ORDER BY downloads DESC");
const datasets = queryD1("SELECT id, slug, name, author, hf_url, task, description, tags, license, downloads, likes, file_size_mb, files_count, docs_quality, gated, updated_at FROM datasets ORDER BY downloads DESC");

for (const model of models) writePage(`lora/${safeSlug(model.slug)}`, modelPage(model));
for (const dataset of datasets) writePage(`dataset/${safeSlug(dataset.slug)}`, datasetPage(dataset));
writePage("datasets", datasetDirectoryPage(datasets));

const presets = {
  "qwen3-loras": ["Best Qwen3 LoRAs", "Qwen3 and Qwen-family adapters sorted from the live index.", (model) => /qwen/i.test(`${model.base_family} ${model.base_model} ${model.name}`)],
  "coding-loras": ["Best coding LoRAs", "Adapters tagged or described for coding, programming, and developer workflows.", (model) => /coding/i.test(model.purpose)],
  "japanese-loras": ["Best Japanese LoRAs", "Japanese-language adapters and models with Japanese usage signals.", (model) => /japanese|日本語/i.test(`${model.purpose} ${model.name} ${model.description}`)],
  "flux-loras": ["Best FLUX LoRAs", "FLUX adapters for image editing, control, style, and character work.", (model) => model.base_family === "FLUX"],
  "wan-loras": ["Best Wan LoRAs", "Wan adapters for image-to-video, text-to-video, and motion workflows.", (model) => model.base_family === "Wan"],
  "video-loras": ["Best video LoRAs", "Video adapters across Wan and LTX, with motion and runtime signals.", (model) => model.type === "Video"]
};
for (const [slug, [title, description, matches]] of Object.entries(presets)) {
  writePage(`best/${slug}`, directoryPage(title, description, `${site}/best/${slug}/`, models.filter(matches).slice(0, 24), "BEST LIST"));
}

const basePages = {
  "qwen3-8b": ["LoRAs for Qwen3-8B", "Adapters compatible with Qwen3-8B or its indexed variants.", (model) => /qwen3-?8b/i.test(`${model.base_model} ${model.compatibility_summary}`)],
  "gemma-4": ["LoRAs for Gemma 4", "Gemma 4 adapters and fine-tuning checkpoints in the live index.", (model) => /gemma-4/i.test(`${model.base_model} ${model.name}`)],
  "flux-2": ["LoRAs for FLUX.2", "FLUX.2 adapters for reference, pose, and image editing workflows.", (model) => /flux[./ -]?2/i.test(`${model.base_model} ${model.name}`)]
};
for (const [slug, [title, description, matches]] of Object.entries(basePages)) writePage(`base/${slug}`, directoryPage(title, description, `${site}/base/${slug}/`, models.filter(matches).slice(0, 24), "BASE MODEL"));

const sitemapUrls = [
  ["/", "2026-09-12"], ["/datasets/", "2026-09-12"], ["/privacy/", "2026-09-12"], ["/terms/", "2026-09-12"],
  ...Object.keys(presets).map((slug) => [`/best/${slug}/`, "2026-09-12"]),
  ...Object.keys(basePages).map((slug) => [`/base/${slug}/`, "2026-09-12"]),
  ...models.map((model) => [`${modelLink(model)}`, date(model.updated_at)]),
  ...datasets.map((dataset) => [`/dataset/${safeSlug(dataset.slug)}/`, date(dataset.updated_at)])
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls.map(([path, lastmod]) => `<url><loc>${site}${html(path)}</loc><lastmod>${html(lastmod || "2026-09-12")}</lastmod></url>`).join("")}</urlset>\n`;
writeFileSync(join(output, "sitemap.xml"), sitemap, "utf8");
console.log(JSON.stringify({ models: models.length, datasets: datasets.length, pages: models.length + datasets.length + Object.keys(presets).length + Object.keys(basePages).length + 1 }));
