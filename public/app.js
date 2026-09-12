const seedModels = [
  { id: "demo/qwen3-japanese-coding", slug: "qwen3-japanese-coding", name: "Qwen3 Japanese Coding", author: "demo-lab", hf_url: "https://huggingface.co/models?search=Qwen3%20Japanese%20Coding", type: "LLM", base_family: "Qwen", base_model: "Qwen3-8B", purpose: "Coding, Japanese", description: "日本語でのコード説明と実装相談に寄せた、軽量な開発者向けアダプター。", best_for: "日本語で仕様を詰めながら実装する", license: "Apache-2.0", commercial_use: 1, lora_rank: 16, file_size_mb: 168, downloads: 18200, likes: 360, rating: 4.7, review_count: 12, docs_quality: 3, safetensors: 1, compatibility: [{ target: "Qwen3-8B", works: 48, doesnt_work: 0 }, { target: "Qwen3-8B-Q4_K_M", works: 21, doesnt_work: 0 }, { target: "llama.cpp", works: 35, doesnt_work: 1 }, { target: "Transformers", works: 42, doesnt_work: 0 }], updated_at: "2026-09-06" },
  { id: "demo/llama3-jp-reasoning", slug: "llama3-jp-reasoning", name: "Llama 3 Japanese Reasoning", author: "community-research", hf_url: "https://huggingface.co/models?search=Llama%203%20Japanese%20Reasoning", type: "LLM", base_family: "Llama", base_model: "Llama-3.1-8B", purpose: "Japanese, Reasoning", description: "日本語の推論タスクで、回答の段階分けを安定させるためのアダプター。", best_for: "日本語の分析メモと長めの回答", license: "CC-BY-4.0", commercial_use: 0, lora_rank: 32, file_size_mb: 96, downloads: 9400, likes: 188, rating: 4.4, review_count: 8, docs_quality: 4, safetensors: 1, compatibility: [{ target: "Llama-3.1-8B", works: 33, doesnt_work: 2 }, { target: "Transformers", works: 28, doesnt_work: 0 }, { target: "Ollama", works: 14, doesnt_work: 1 }], updated_at: "2026-08-31" },
  { id: "demo/gemma-roleplay-ja", slug: "gemma-roleplay-ja", name: "Gemma Japanese Character", author: "paper-crane", hf_url: "https://huggingface.co/models?search=Gemma%20Japanese%20Character", type: "LLM", base_family: "Gemma", base_model: "Gemma-3-12B", purpose: "Japanese, Roleplay, Character", description: "会話の口調とキャラクター設定を、プロンプトだけより一貫させる実験用モデル。", best_for: "キャラクター会話の試作", license: "MIT", commercial_use: 1, lora_rank: 32, file_size_mb: 112, downloads: 6300, likes: 204, rating: 4.3, review_count: 17, docs_quality: 3, safetensors: 1, compatibility: [{ target: "Gemma-3-12B", works: 29, doesnt_work: 3 }, { target: "Transformers", works: 31, doesnt_work: 0 }], updated_at: "2026-09-03" },
  { id: "demo/flux-ink-line", slug: "flux-ink-line", name: "FLUX Ink Line", author: "studio-kumo", hf_url: "https://huggingface.co/models?search=FLUX%20Ink%20Line", type: "Image", base_family: "FLUX", base_model: "FLUX.1-dev", purpose: "Style, Character", description: "インクの線と余白の出方を寄せる画像向け LoRA。作例とトリガー語を README に整理。", best_for: "線画寄りのキャラクター作例", license: "OpenRAIL++", commercial_use: 0, lora_rank: 16, file_size_mb: 144, downloads: 22100, likes: 512, rating: 4.8, review_count: 26, docs_quality: 5, safetensors: 1, compatibility: [{ target: "FLUX.1-dev", works: 55, doesnt_work: 2 }, { target: "ComfyUI", works: 48, doesnt_work: 1 }, { target: "Diffusers", works: 36, doesnt_work: 0 }], updated_at: "2026-09-08" },
  { id: "demo/wan-motion-soft", slug: "wan-motion-soft", name: "Wan Motion Soft", author: "motion-field", hf_url: "https://huggingface.co/models?search=Wan%20Motion%20Soft", type: "Video", base_family: "Wan", base_model: "Wan2.1-T2V-14B", purpose: "Motion, Style", description: "動きの強さを抑えた短い動画向けアダプター。低強度から試すと表情とカメラの破綻を確認しやすい。", best_for: "穏やかなカメラワークの動画", license: "Apache-2.0", commercial_use: 1, lora_rank: 64, file_size_mb: 768, downloads: 11700, likes: 244, rating: 4.2, review_count: 9, docs_quality: 2, safetensors: 1, compatibility: [{ target: "Wan2.1-T2V-14B", works: 18, doesnt_work: 4 }, { target: "ComfyUI", works: 16, doesnt_work: 2 }], updated_at: "2026-08-29" },
  { id: "demo/ltx-motion-detail", slug: "ltx-motion-detail", name: "LTX Motion Detail", author: "frame-lab", hf_url: "https://huggingface.co/models?search=LTX%20Motion%20Detail", type: "Video", base_family: "LTX", base_model: "LTX-Video", purpose: "Motion, Character", description: "動きの細部と衣服の揺れを補う動画用 LoRA。強度を上げすぎると背景にも影響する。", best_for: "人物中心の短尺モーション", license: "Apache-2.0", commercial_use: 1, lora_rank: 48, file_size_mb: 512, downloads: 4900, likes: 118, rating: 4.1, review_count: 6, docs_quality: 3, safetensors: 1, compatibility: [{ target: "LTX-Video", works: 14, doesnt_work: 3 }, { target: "Diffusers", works: 9, doesnt_work: 2 }], updated_at: "2026-09-01" },
  { id: "demo/sdxl-anime-character", slug: "sdxl-anime-character", name: "SDXL Anime Character", author: "night-atelier", hf_url: "https://huggingface.co/models?search=SDXL%20Anime%20Character", type: "Image", base_family: "Other", base_model: "SDXL 1.0", purpose: "Character, Style", description: "キャラクターの輪郭と目の表現を調整する定番寄りの画像 LoRA。", best_for: "アニメ調キャラクターの安定化", license: "CreativeML Open RAIL++", commercial_use: 0, lora_rank: 32, file_size_mb: 224, downloads: 39100, likes: 890, rating: 4.6, review_count: 44, docs_quality: 4, safetensors: 1, compatibility: [{ target: "SDXL 1.0", works: 64, doesnt_work: 3 }, { target: "ComfyUI", works: 58, doesnt_work: 2 }, { target: "A1111", works: 51, doesnt_work: 1 }], updated_at: "2026-09-07" },
  { id: "demo/music-texture-v1", slug: "music-texture-v1", name: "Music Texture v1", author: "audio-notebook", hf_url: "https://huggingface.co/models?search=Music%20Texture%20LoRA", type: "Audio", base_family: "Other", base_model: "Stable Audio Open", purpose: "Style, Motion", description: "音の質感とループの雰囲気を変えるオーディオ向けアダプター。", best_for: "短いループの方向性を探す", license: "MIT", commercial_use: 1, lora_rank: 24, file_size_mb: 88, downloads: 2600, likes: 72, rating: 4.0, review_count: 5, docs_quality: 2, safetensors: 1, compatibility: [{ target: "Stable Audio Open", works: 7, doesnt_work: 2 }, { target: "Diffusers", works: 6, doesnt_work: 1 }], updated_at: "2026-08-26" }
];

const state = { models: seedModels, query: "", clerk: null, clerkConfigured: false, activeCommandIndex: 0, route: window.location.pathname };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const formatNumber = (value) => new Intl.NumberFormat("en-US", { notation: value > 99999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value || 0));

function parseCompatibility(model) {
  if (Array.isArray(model.compatibility)) return model.compatibility;
  try { return JSON.parse(model.compatibility_summary || "[]"); } catch { return []; }
}

function getFilters() {
  const form = $("#filter-form");
  const data = new FormData(form);
  return {
    base: data.get("base") || "",
    type: data.get("type") || "",
    purpose: data.getAll("purpose"),
    minRating: data.get("minRating") || "",
    maxSize: data.get("maxSize") || "",
    license: data.get("license") || "",
    compatible: data.get("compatible") || "",
    safetensors: data.get("safetensors") || "",
    docs: data.get("docs") || "",
    sort: $("#sort").value || "fit"
  };
}

function clientFilter(models) {
  const filters = getFilters();
  const query = state.query.trim().toLowerCase();
  let result = models.filter((model) => {
    const purpose = String(model.purpose || "").toLowerCase();
    const haystack = [model.name, model.author, model.base_model, model.base_family, model.type, model.purpose, model.description].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) &&
      (!filters.base || model.base_family === filters.base) &&
      (!filters.type || model.type === filters.type) &&
      (!filters.purpose.length || filters.purpose.every((tag) => purpose.includes(tag.toLowerCase()))) &&
      (!filters.minRating || Number(model.rating || 0) >= Number(filters.minRating)) &&
      (!filters.maxSize || Number(model.file_size_mb || 0) <= Number(filters.maxSize)) &&
      (!filters.license || (filters.license === "commercial" ? Boolean(model.commercial_use) : !String(model.license || "").toLowerCase().includes("openrail") || Boolean(model.commercial_use))) &&
      (!filters.compatible || `${model.base_model} ${JSON.stringify(parseCompatibility(model))}`.includes(filters.compatible)) &&
      (!filters.safetensors || Boolean(model.safetensors)) &&
      (!filters.docs || Number(model.docs_quality || 0) >= Number(filters.docs));
  });
  result.sort((a, b) => {
    if (filters.sort === "rating") return Number(b.rating || 0) - Number(a.rating || 0);
    if (filters.sort === "downloads") return Number(b.downloads || 0) - Number(a.downloads || 0);
    if (filters.sort === "updated") return String(b.updated_at).localeCompare(String(a.updated_at));
    return (Number(b.quality_score || b.rating || 0) - Number(a.quality_score || a.rating || 0)) || (Number(b.downloads || 0) - Number(a.downloads || 0));
  });
  return result;
}

function renderModel(model) {
  const compatibility = parseCompatibility(model);
  const positive = compatibility.reduce((sum, item) => sum + Number(item.works || 0), 0);
  const negative = compatibility.reduce((sum, item) => sum + Number(item.doesnt_work || 0), 0);
  const rating = model.rating == null ? "—" : Number(model.rating).toFixed(1);
  const docs = Math.max(0, Math.min(5, Number(model.docs_quality || 0)));
  return `<article class="model-card" data-model-id="${escapeHTML(model.id)}">
    <div class="model-main">
      <div class="card-topline"><span class="type-badge">${escapeHTML(model.type)}</span><span class="fit-badge">${positive} works reports</span><span class="license-badge">${escapeHTML(model.license)}</span></div>
      <h3 class="model-title"><a href="${escapeHTML(model.hf_url)}" target="_blank" rel="noreferrer">${escapeHTML(model.name)}</a></h3>
      <p class="model-author">by ${escapeHTML(model.author)} · updated ${escapeHTML(model.updated_at)}</p>
      <p class="model-description">${escapeHTML(model.description)}</p>
      <div class="model-meta"><span><strong>Base</strong> ${escapeHTML(model.base_model)}</span><span><strong>Best for</strong> ${escapeHTML(model.best_for)}</span><span><strong>Files</strong> ${formatNumber(model.file_size_mb)} MB · ${model.safetensors ? "safetensors" : "other"}</span></div>
      <div class="card-actions"><a class="outline-button" href="${escapeHTML(model.hf_url)}" target="_blank" rel="noreferrer">Open on HF ↗</a><button class="primary-button review-trigger" type="button" data-review="${escapeHTML(model.id)}">Write a review</button></div>
      <p class="data-line">${formatNumber(model.downloads)} downloads · ${formatNumber(model.likes)} likes · <a href="#review" class="review-trigger" data-review="${escapeHTML(model.id)}">${formatNumber(model.review_count)} reviews</a></p>
    </div>
    <aside class="evidence-column" aria-label="Evidence for ${escapeHTML(model.name)}">
      <div class="evidence-score"><span class="score-number">${rating}</span><span class="score-copy"><strong>Overall</strong>${docs}/5 docs quality</span></div>
      <div class="evidence-section"><h3>Works with</h3><div class="compatibility-list">${compatibility.slice(0, 4).map((item) => `<div class="compatibility-row"><span title="${escapeHTML(item.target)}">${escapeHTML(item.target)}</span><b>✓ ${Number(item.works || 0)}</b><b class="is-negative">× ${Number(item.doesnt_work || 0)}</b></div>`).join("")}</div>
        <div class="vote-row"><button class="vote-button" type="button" data-vote="works" data-model="${escapeHTML(model.id)}" data-target="${escapeHTML(model.base_model)}">Works</button><button class="vote-button" type="button" data-vote="doesnt_work" data-model="${escapeHTML(model.id)}" data-target="${escapeHTML(model.base_model)}">Doesn’t work</button></div>
      </div>
    </aside>
  </article>`;
}

function renderActiveFilters() {
  const filters = getFilters();
  const labels = [];
  if (state.query) labels.push(`Search: ${state.query}`);
  if (filters.base) labels.push(`Base: ${filters.base}`);
  if (filters.type) labels.push(`Type: ${filters.type}`);
  filters.purpose.forEach((value) => labels.push(value));
  if (filters.minRating) labels.push(`Rating ≥ ${filters.minRating}`);
  if (filters.maxSize) labels.push(`Size ≤ ${filters.maxSize} MB`);
  if (filters.license === "commercial") labels.push("Commercial-friendly");
  if (filters.compatible) labels.push(`Works with ${filters.compatible}`);
  if (filters.safetensors) labels.push("Safetensors");
  if (filters.docs) labels.push(`Docs ≥ ${filters.docs}`);
  $("#active-filters").innerHTML = labels.map((label) => `<span class="active-filter">${escapeHTML(label)}</span>`).join("");
}

function render() {
  const models = clientFilter(state.models);
  $("#result-count").textContent = formatNumber(models.length);
  $("#model-list").setAttribute("aria-busy", "false");
  $("#model-list").innerHTML = models.map(renderModel).join("");
  $("#empty-state").hidden = models.length !== 0;
  renderActiveFilters();
  wireResultActions();
  updateCommandResults();
}

function apiParams() {
  const filters = getFilters();
  const params = new URLSearchParams({ limit: "40", sort: filters.sort });
  if (state.query) params.set("q", state.query);
  Object.entries(filters).forEach(([key, value]) => {
    if (key === "purpose") value.forEach((item) => params.append("purpose", item));
    else if (!["sort"].includes(key) && value) params.set(key, value);
  });
  return params;
}

let refreshTimer;
async function refreshModels({ immediate = false } = {}) {
  clearTimeout(refreshTimer);
  const run = async () => {
    try {
      const response = await fetch(`/api/models?${apiParams().toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("model index unavailable");
      const payload = await response.json();
      state.models = Array.isArray(payload.models) ? payload.models : seedModels;
      render();
    } catch {
      render();
    }
  };
  if (immediate) await run();
  else refreshTimer = setTimeout(run, 180);
}

function resetFilters() {
  $("#filter-form").reset();
  $("#sort").value = "fit";
  state.query = "";
  render();
  refreshModels({ immediate: true });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("is-visible"), 4200);
}

function openDialog(dialog) { if (dialog && typeof dialog.showModal === "function") dialog.showModal(); }
function closeDialog(dialog) { if (dialog?.open) dialog.close(); }

function openReview(modelId) {
  const model = state.models.find((item) => item.id === modelId) || seedModels.find((item) => item.id === modelId);
  if (!state.clerk?.isSignedIn) {
    if (state.clerkConfigured) state.clerk.openSignIn();
    else openDialog($("#setup-dialog"));
    showToast("レビュー投稿にはサインインが必要です。");
    return;
  }
  $("#review-model-id").value = modelId;
  $("#review-model-name").textContent = `${model?.name || "This adapter"} · Base ${model?.base_model || "—"}. Add the conditions you actually used.`;
  $("#review-status").textContent = "";
  $("#review-form").reset();
  $("#review-model-id").value = modelId;
  openDialog($("#review-dialog"));
}

async function authHeaders() {
  const token = await state.clerk?.session?.getToken?.();
  if (!token) throw new Error("signed out");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function submitReview(event) {
  event.preventDefault();
  const button = event.submitter;
  const status = $("#review-status");
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  button.disabled = true; button.dataset.state = "loading"; status.textContent = "";
  try {
    const response = await fetch("/api/reviews", { method: "POST", headers: await authHeaders(), body: JSON.stringify(data) });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "review failed");
    closeDialog($("#review-dialog"));
    showToast("Review saved to the index.");
    await refreshModels({ immediate: true });
  } catch (error) {
    status.textContent = error.message.includes("signed") ? "Session expired. Sign in again, then publish." : "Review could not be saved. Check the fields and try again.";
  } finally { button.disabled = false; delete button.dataset.state; }
}

async function castVote(button) {
  button.disabled = true;
  try {
    const response = await fetch("/api/compatibility", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ modelId: button.dataset.model, target: button.dataset.target, status: button.dataset.vote }) });
    if (!response.ok) throw new Error("vote failed");
    button.dataset.state = "success";
    showToast("Compatibility report saved.");
    await refreshModels({ immediate: true });
  } catch {
    showToast(state.clerkConfigured ? "Sign in again before reporting compatibility." : "Configure Clerk to report compatibility.");
  } finally { button.disabled = false; delete button.dataset.state; }
}

function wireResultActions() {
  $$("[data-review]").forEach((element) => element.addEventListener("click", (event) => { event.preventDefault(); openReview(element.dataset.review); }));
  $$("[data-vote]").forEach((element) => element.addEventListener("click", () => castVote(element)));
}

function commandMatches(query) {
  const normalized = query.trim().toLowerCase();
  return state.models.filter((model) => !normalized || [model.name, model.base_model, model.purpose, model.author].join(" ").toLowerCase().includes(normalized)).slice(0, 6);
}

function updateCommandResults() {
  const query = $("#command-input")?.value || "";
  const matches = commandMatches(query);
  $("#command-results").innerHTML = `<p class="command-group">${query ? "Matches" : "Suggested"}</p>${matches.length ? matches.map((model, index) => `<button class="command-item ${index === state.activeCommandIndex ? "is-active" : ""}" type="button" data-command-id="${escapeHTML(model.id)}"><span class="type-badge">${escapeHTML(model.type)}</span><span>${escapeHTML(model.name)}</span><small>${escapeHTML(model.base_model)}</small></button>`).join("") : `<p class="dialog-lede">No indexed adapter matches that phrase.</p>`}`;
  $$("[data-command-id]").forEach((item) => item.addEventListener("click", () => { const selected = state.models.find((model) => model.id === item.dataset.commandId); state.query = selected?.name || ""; $("#command-input").value = state.query; closeDialog($("#command-dialog")); render(); refreshModels({ immediate: true }); }));
}

async function loadScript(source) { return new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = source; script.async = true; script.crossOrigin = "anonymous"; script.onload = resolve; script.onerror = reject; document.head.appendChild(script); }); }

function renderAuth() {
  const trigger = $("#auth-trigger");
  if (state.clerk?.isSignedIn) {
    trigger.textContent = "Account";
    trigger.onclick = () => state.clerk.openUserProfile?.();
    const mount = $("#user-button");
    if (!mount.dataset.mounted && state.clerk.mountUserButton) { state.clerk.mountUserButton(mount); mount.dataset.mounted = "true"; }
  } else {
    trigger.textContent = "Sign in";
    trigger.onclick = () => state.clerkConfigured ? state.clerk.openSignIn() : openDialog($("#setup-dialog"));
  }
}

async function initClerk() {
  try {
    const response = await fetch("/api/config", { headers: { Accept: "application/json" } });
    const config = await response.json();
    const key = config.clerkPublishableKey;
    if (!key) return;
    const encodedDomain = key.split("_")[2];
    const domain = encodedDomain ? atob(encodedDomain).slice(0, -1) : "";
    if (!domain) return;
    await loadScript(`https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`);
    await loadScript(`https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`);
    const globalClerk = window.Clerk;
    state.clerk = typeof globalClerk === "function" ? new globalClerk(key) : globalClerk;
    if (!state.clerk) return;
    await state.clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
    state.clerkConfigured = true;
    state.clerk.addListener?.(renderAuth);
    $("#setup-state").textContent = "Clerk is configured. Sign in to publish reviews and compatibility reports.";
    renderAuth();
  } catch { state.clerkConfigured = false; }
}

function initRoute() {
  const path = state.route.toLowerCase();
  if (path.includes("qwen3")) { $("#base-family").value = "Qwen"; $("#compatible-only").checked = true; }
  if (path.includes("japanese")) { $("input[name=purpose][value=Japanese]").checked = true; }
  if (path.includes("video")) { $("#model-type").value = "Video"; }
  const baseMatch = path.match(/\/base\/([^/]+)/);
  if (baseMatch) state.query = decodeURIComponent(baseMatch[1]).replaceAll("-", " ");
}

function init() {
  initRoute();
  render();
  refreshModels({ immediate: true });
  initClerk();
  $("#open-search").addEventListener("click", () => { openDialog($("#command-dialog")); $("#command-input").value = state.query; updateCommandResults(); setTimeout(() => $("#command-input").focus(), 0); });
  $("#command-input").addEventListener("input", () => { state.activeCommandIndex = 0; updateCommandResults(); });
  $("#command-input").addEventListener("keydown", (event) => {
    const items = $$("[data-command-id]");
    if (event.key === "ArrowDown") { event.preventDefault(); state.activeCommandIndex = Math.min(state.activeCommandIndex + 1, Math.max(0, items.length - 1)); updateCommandResults(); }
    if (event.key === "ArrowUp") { event.preventDefault(); state.activeCommandIndex = Math.max(0, state.activeCommandIndex - 1); updateCommandResults(); }
    if (event.key === "Enter" && items[state.activeCommandIndex]) { event.preventDefault(); items[state.activeCommandIndex].click(); }
  });
  $("#filter-form").addEventListener("change", () => { render(); refreshModels(); });
  $("#sort").addEventListener("change", () => { render(); refreshModels(); });
  $("#reset-filters").addEventListener("click", resetFilters);
  $("#empty-reset").addEventListener("click", resetFilters);
  $("#review-form").addEventListener("submit", submitReview);
  $("#setup-trigger").addEventListener("click", () => openDialog($("#setup-dialog")));
  $$('[data-close-dialog]').forEach((button) => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));
  $$('dialog').forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); }));
  document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#open-search").click(); } });
}

document.addEventListener("DOMContentLoaded", init);
