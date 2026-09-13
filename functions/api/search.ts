import { json, type Env } from "../_auth";

const SORTS: Record<string, string> = {
  fit: "search_score DESC, quality_score DESC, downloads DESC, likes DESC",
  rating: "rating DESC, review_count DESC, search_score DESC, downloads DESC",
  downloads: "downloads DESC, likes DESC, search_score DESC",
  likes: "likes DESC, downloads DESC, search_score DESC",
  reviews: "review_count DESC, rating DESC, search_score DESC, downloads DESC",
  smallest: "CASE WHEN file_size_mb IS NULL THEN 1 ELSE 0 END, file_size_mb ASC, search_score DESC, downloads DESC",
  rank: "CASE WHEN lora_rank IS NULL THEN 1 ELSE 0 END, lora_rank ASC, search_score DESC, downloads DESC",
  updated: "updated_at DESC, search_score DESC"
};

const MODEL_FIELDS = "m.id, m.slug, m.name, m.author, m.hf_url, m.type, m.base_family, m.base_model, m.purpose, m.description, m.best_for, m.license, m.commercial_use, m.lora_rank, m.file_size_mb, m.downloads, m.likes, m.rating, m.review_count, m.docs_quality, m.safetensors, m.compatibility_summary, m.content_warning, m.content_flags, m.updated_at, m.quality_score";

const positiveNumber = (value: string | null) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase();
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (character) => `\\${character}`);
const loosePattern = (value: string) => `%${escapeLike(normalize(value)).replace(/[\s._/-]+/g, "%")}%`;
const prefixPattern = (value: string) => `${escapeLike(normalize(value)).replace(/[\s._/-]+/g, "%")}%`;

const familyFrom = (value: string) => {
  const text = normalize(value);
  if (/qwen/.test(text)) return "Qwen";
  if (/llama/.test(text)) return "Llama";
  if (/gemma/.test(text)) return "Gemma";
  if (/flux/.test(text)) return "FLUX";
  if (/wan/.test(text)) return "Wan";
  if (/ltx/.test(text)) return "LTX";
  if (/illustrious/.test(text)) return "Illustrious";
  if (/pony/.test(text)) return "Pony";
  if (/sdxl|stable.?diffusion.?xl/.test(text)) return "SDXL";
  if (/sd3(?:\.5)?|stable.?diffusion.?3/.test(text)) return "SD3";
  if (/sd.?1\.5|stable.?diffusion.?1\.5/.test(text)) return "SD 1.5";
  return "Other";
};

const typeFrom = (value: string) => {
  const text = normalize(value);
  if (/video|wan|ltx|animatediff|cogvideo|hunyuan.?video/.test(text)) return "Video";
  if (/audio|music|voice|speech|tts/.test(text)) return "Audio";
  if (/image|diffusers|flux|stable.?diffusion|sdxl|sd3|pony|illustrious/.test(text)) return "Image";
  return "LLM";
};

type FieldFilter = { field: string; value: string };
type SearchIntent = {
  purposes: string[];
  types: string[];
  bases: string[];
  freeTerms: string[];
  fieldFilters: FieldFilter[];
  hubTerms: string[];
  normalizedQuery: string;
};

function splitQuery(input: string) {
  const tokens: string[] = [];
  const matcher = /"([^"]+)"|'([^']+)'|(\S+)/g;
  for (const match of input.matchAll(matcher)) tokens.push(match[1] || match[2] || match[3]);
  return tokens;
}

function naturalIntent(input: string): SearchIntent {
  const normalizedQuery = normalize(input);
  const purposes: string[] = [];
  const types: string[] = [];
  const bases: string[] = [];
  const hubTerms: string[] = [];
  const fieldFilters: FieldFilter[] = [];
  const freeTerms: string[] = [];

  const add = (list: string[], value: string) => { if (!list.includes(value)) list.push(value); };
  const addPurpose = (value: string, hub: string) => { add(purposes, value); add(hubTerms, hub); };
  const addType = (value: string, hub: string) => { add(types, value); add(hubTerms, hub); };
  const addBase = (value: string, hub: string) => { add(bases, value); add(hubTerms, hub); };

  for (const rawToken of splitQuery(normalizedQuery)) {
    const operator = rawToken.match(/^(author|base|trigger|file|repo|hash|type|purpose):(.+)$/i);
    if (operator) {
      fieldFilters.push({ field: operator[1].toLowerCase(), value: operator[2] });
      if (operator[1].toLowerCase() === "base") add(hubTerms, operator[2]);
      continue;
    }

    const token = rawToken.replace(/^[,;]+|[,;]+$/g, "");
    if (!token || /^(lora|loras|adapter|adapters|peft|モデル|ファイル)$/.test(token)) continue;

    if (/^(日本語|japanese|和文|日本向け|ja)$/.test(token)) { addPurpose("Japanese", "japanese"); continue; }
    if (/^(character|characters|キャラ|キャラクター|人物|なりきり|role-?play|roleplay|persona)$/.test(token)) { addPurpose("Character", "character"); continue; }
    if (/^(coding|code|programming|program|コーディング|プログラミング|コード生成)$/.test(token)) { addPurpose("Coding", "coding"); continue; }
    if (/^(reasoning|reason|math|数学|推論|cot)$/.test(token)) { addPurpose("Reasoning", "reasoning"); continue; }
    if (/^(style|スタイル|画風|絵柄|作風|anime|アニメ|toon|texture)$/.test(token)) { addPurpose("Style", token === "アニメ" ? "anime" : token); continue; }
    if (/^(photo|photorealistic|photoreal|写真|実写|portrait|ポートレート)$/.test(token)) { addPurpose("Style", "photorealistic"); add(hubTerms, token); continue; }
    if (/^(motion|animation|video-motion|動き|transition|camera|pose|ポーズ)$/.test(token)) { addPurpose("Motion", "motion"); add(hubTerms, token); continue; }

    if (/^(image|画像|画像生成|イラスト|diffusion)$/.test(token)) { addType("Image", "image"); continue; }
    if (/^(video|動画|映像)$/.test(token)) { addType("Video", "video"); continue; }
    if (/^(audio|音声|voice|music|音楽|tts)$/.test(token)) { addType("Audio", "audio"); continue; }
    if (/^(llm|言語モデル|text|テキスト|文章)$/.test(token)) { addType("LLM", "llm"); continue; }

    if (/^qwen/i.test(token)) { addBase("Qwen", token); continue; }
    if (/^llama/i.test(token)) { addBase("Llama", token); continue; }
    if (/^gemma/i.test(token)) { addBase("Gemma", token); continue; }
    if (/^flux/i.test(token)) { addBase("FLUX", token); addType("Image", "image"); continue; }
    if (/^wan(?:\d|$)/i.test(token)) { addBase("Wan", token); addType("Video", "video"); continue; }
    if (/^ltx/i.test(token)) { addBase("LTX", token); addType("Video", "video"); continue; }
    if (/^(sdxl|stable-diffusion-xl|stable_diffusion_xl)$/i.test(token)) { addBase("SDXL", "sdxl"); addType("Image", "image"); continue; }
    if (/^(sd3|sd3\.5|stable-diffusion-3(?:\.5)?)$/i.test(token)) { addBase("SD3", token); addType("Image", "image"); continue; }
    if (/^(sd1\.5|sd15|stable-diffusion-1\.5)$/i.test(token)) { addBase("SD 1.5", "stable diffusion 1.5"); addType("Image", "image"); continue; }
    if (/^pony/i.test(token)) { addBase("Pony", token); addType("Image", "image"); continue; }
    if (/^illustrious/i.test(token)) { addBase("Illustrious", token); addType("Image", "image"); continue; }

    if (token.length > 1) {
      add(freeTerms, token);
      add(hubTerms, token);
    }
  }

  if (/日本語|和文/.test(normalizedQuery)) addPurpose("Japanese", "japanese");
  if (/キャラ|キャラクター|人物|なりきり|ロールプレイ/.test(normalizedQuery)) addPurpose("Character", "character");
  if (/画像|イラスト|画像生成/.test(normalizedQuery)) addType("Image", "image");
  if (/動画|映像/.test(normalizedQuery)) addType("Video", "video");
  if (/音声|音楽/.test(normalizedQuery)) addType("Audio", "audio");

  return {
    purposes,
    types,
    bases,
    freeTerms: freeTerms.slice(0, 6),
    fieldFilters: fieldFilters.slice(0, 8),
    hubTerms: hubTerms.slice(0, 10),
    normalizedQuery
  };
}

function addFieldFilter(conditions: string[], values: Array<string | number>, filter: FieldFilter) {
  const pattern = loosePattern(filter.value);
  switch (filter.field) {
    case "author":
      conditions.push("LOWER(m.author) LIKE ? ESCAPE '\\'"); values.push(pattern); break;
    case "base":
      conditions.push("(LOWER(m.base_model) LIKE ? ESCAPE '\\' OR LOWER(m.base_family) LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM lora_resources rf WHERE rf.model_id=m.id AND (LOWER(rf.base_model) LIKE ? ESCAPE '\\' OR LOWER(rf.base_family) LIKE ? ESCAPE '\\')))" );
      values.push(pattern, pattern, pattern, pattern); break;
    case "trigger":
      conditions.push("EXISTS (SELECT 1 FROM lora_resources rf WHERE rf.model_id=m.id AND LOWER(rf.trigger_words) LIKE ? ESCAPE '\\')"); values.push(pattern); break;
    case "file":
      conditions.push("EXISTS (SELECT 1 FROM lora_resources rf WHERE rf.model_id=m.id AND (LOWER(rf.filename) LIKE ? ESCAPE '\\' OR LOWER(rf.path) LIKE ? ESCAPE '\\'))"); values.push(pattern, pattern); break;
    case "repo":
      conditions.push("(LOWER(m.id) LIKE ? ESCAPE '\\' OR LOWER(m.name) LIKE ? ESCAPE '\\')"); values.push(pattern, pattern); break;
    case "hash":
      conditions.push("EXISTS (SELECT 1 FROM lora_resources rf WHERE rf.model_id=m.id AND LOWER(rf.sha256) LIKE ? ESCAPE '\\')"); values.push(pattern); break;
    case "type":
      conditions.push("LOWER(m.type)=?"); values.push(normalize(filter.value)); break;
    case "purpose":
      conditions.push("LOWER(m.purpose) LIKE ? ESCAPE '\\'"); values.push(pattern); break;
  }
}

function termMatchClause(term: string, values: Array<string | number>) {
  const pattern = loosePattern(term);
  values.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  return `(LOWER(m.name) LIKE ? ESCAPE '\\' OR LOWER(m.id) LIKE ? ESCAPE '\\' OR LOWER(m.author) LIKE ? ESCAPE '\\' OR LOWER(m.base_model) LIKE ? ESCAPE '\\' OR LOWER(m.base_family) LIKE ? ESCAPE '\\' OR LOWER(m.purpose) LIKE ? ESCAPE '\\' OR LOWER(m.best_for) LIKE ? ESCAPE '\\' OR LOWER(m.description) LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM lora_resources rt WHERE rt.model_id=m.id AND (LOWER(rt.filename) LIKE ? ESCAPE '\\' OR LOWER(rt.path) LIKE ? ESCAPE '\\' OR LOWER(rt.trigger_words) LIKE ? ESCAPE '\\' OR LOWER(rt.base_model) LIKE ? ESCAPE '\\')))`;
}

function buildSearchScore(intent: SearchIntent, values: Array<string | number>) {
  if (!intent.normalizedQuery) return "0";
  const parts: string[] = [];
  const exact = intent.normalizedQuery;
  const phrasePattern = loosePattern(exact);
  const phrasePrefix = prefixPattern(exact);
  parts.push("CASE WHEN LOWER(m.name)=? OR LOWER(m.id)=? THEN 220 ELSE 0 END"); values.push(exact, exact);
  parts.push("CASE WHEN LOWER(m.name) LIKE ? ESCAPE '\\' OR LOWER(m.id) LIKE ? ESCAPE '\\' THEN 140 ELSE 0 END"); values.push(phrasePrefix, phrasePrefix);
  parts.push("CASE WHEN LOWER(m.name) LIKE ? ESCAPE '\\' OR LOWER(m.id) LIKE ? ESCAPE '\\' OR LOWER(m.description) LIKE ? ESCAPE '\\' THEN 85 ELSE 0 END"); values.push(phrasePattern, phrasePattern, phrasePattern);

  for (const term of intent.freeTerms.slice(0, 5)) {
    const pattern = loosePattern(term);
    parts.push("CASE WHEN LOWER(m.name) LIKE ? ESCAPE '\\' OR LOWER(m.id) LIKE ? ESCAPE '\\' THEN 48 ELSE 0 END"); values.push(pattern, pattern);
    parts.push("CASE WHEN LOWER(m.base_model) LIKE ? ESCAPE '\\' OR LOWER(m.purpose) LIKE ? ESCAPE '\\' OR LOWER(m.best_for) LIKE ? ESCAPE '\\' THEN 34 ELSE 0 END"); values.push(pattern, pattern, pattern);
    parts.push("CASE WHEN EXISTS (SELECT 1 FROM lora_resources rs WHERE rs.model_id=m.id AND (LOWER(rs.filename) LIKE ? ESCAPE '\\' OR LOWER(rs.trigger_words) LIKE ? ESCAPE '\\' OR LOWER(rs.base_model) LIKE ? ESCAPE '\\')) THEN 58 ELSE 0 END"); values.push(pattern, pattern, pattern);
    parts.push("CASE WHEN LOWER(m.description) LIKE ? ESCAPE '\\' OR LOWER(m.author) LIKE ? ESCAPE '\\' THEN 14 ELSE 0 END"); values.push(pattern, pattern);
  }

  for (const base of intent.bases) {
    parts.push("CASE WHEN m.base_family=? OR LOWER(m.base_model) LIKE ? ESCAPE '\\' THEN 52 ELSE 0 END"); values.push(base, loosePattern(base));
  }
  for (const type of intent.types) {
    parts.push("CASE WHEN m.type=? THEN 24 ELSE 0 END"); values.push(type);
  }
  for (const purpose of intent.purposes) {
    parts.push("CASE WHEN m.purpose LIKE ? ESCAPE '\\' THEN 28 ELSE 0 END"); values.push(`%${escapeLike(purpose)}%`);
  }

  return parts.length ? parts.join(" + ") : "0";
}

function hubPurpose(value: string) {
  const lower = normalize(value);
  const purposes: string[] = [];
  if (/japanese|日本語|ja[-_ ]/.test(lower)) purposes.push("Japanese");
  if (/role\s*-?play|character|persona|chat/.test(lower)) purposes.push("Character");
  if (/coding|code|program|developer/.test(lower)) purposes.push("Coding");
  if (/reason|math|cot/.test(lower)) purposes.push("Reasoning");
  if (/style|toon|texture|art|illustration|anime|photo|portrait/.test(lower)) purposes.push("Style");
  if (/motion|video|transition|camera|animation/.test(lower)) purposes.push("Motion");
  return [...new Set(purposes)].join(", ") || "General";
}

function scoreLive(searchable: string, intent: SearchIntent, downloads: number, likes: number) {
  const text = normalize(searchable);
  let score = 0;
  if (text.includes(intent.normalizedQuery)) score += 90;
  for (const term of intent.freeTerms) if (text.includes(normalize(term))) score += 40;
  for (const base of intent.bases) if (familyFrom(text) === base || text.includes(normalize(base))) score += 50;
  for (const type of intent.types) if (typeFrom(text) === type) score += 22;
  for (const purpose of intent.purposes) if (hubPurpose(text).includes(purpose)) score += 28;
  score += Math.min(22, Math.log10(Math.max(1, downloads)) * 4 + Math.log10(Math.max(1, likes + 1)) * 3);
  return score;
}

async function fetchLiveHub(env: Env, intent: SearchIntent, q: string, limit: number) {
  if (!q) return [] as Array<Record<string, unknown>>;
  const hubQuery = [...new Set([...intent.hubTerms, ...intent.freeTerms])].join(" ") || q;
  const queries = [...new Set([hubQuery, intent.normalizedQuery].filter(Boolean))].slice(0, 2);
  const responses = await Promise.all(queries.map(async (query) => {
    try {
      const response = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(`${query} lora`)}&limit=${Math.min(50, Math.max(20, limit))}&sort=downloads&direction=-1&full=true`, {
        headers: { Accept: "application/json", ...(env.HF_TOKEN ? { Authorization: `Bearer ${env.HF_TOKEN}` } : {}) }
      });
      if (!response.ok) return [] as Array<Record<string, unknown>>;
      return await response.json() as Array<Record<string, unknown>>;
    } catch {
      return [] as Array<Record<string, unknown>>;
    }
  }));

  const deduped = new Map<string, Record<string, unknown>>();
  for (const payload of responses) {
    for (const model of payload) {
      const id = String(model.id || "");
      if (!id || deduped.has(id)) continue;
      const tags = Array.isArray(model.tags) ? model.tags.map(String) : [];
      const cardData = (model.cardData || {}) as Record<string, unknown>;
      const searchable = `${id} ${tags.join(" ")} ${String(model.pipeline_tag || "")} ${String(model.library_name || "")} ${JSON.stringify(cardData)}`;
      if (!/lora|adapter|peft/i.test(searchable)) continue;
      const baseModelTag = tags.find((tag) => /^base_model:(adapter:)?/i.test(tag));
      const baseModel = String(cardData.base_model || baseModelTag?.replace(/^base_model:(adapter:)?/i, "") || "Unknown base");
      const family = familyFrom(`${baseModel} ${id}`);
      const modelType = typeFrom(searchable);
      const purpose = hubPurpose(searchable);
      const downloads = Number(model.downloads || 0);
      const likes = Number(model.likes || 0);
      deduped.set(id, {
        id,
        slug: id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name: id.split("/").pop() || id,
        author: id.split("/")[0] || "unknown",
        hf_url: `https://huggingface.co/${id}`,
        type: modelType,
        base_family: family,
        base_model: baseModel,
        purpose,
        description: "Hugging Face のライブ検索で見つかったLoRAです。詳細メタデータは元のモデルカードで確認できます。",
        best_for: purpose === "General" ? "モデルカードで用途を確認" : `${purpose.split(", ")[0]}向け`,
        license: String(cardData.license || "Unknown"),
        commercial_use: 0,
        lora_rank: null,
        file_size_mb: null,
        downloads,
        likes,
        rating: null,
        review_count: 0,
        docs_quality: 0,
        safetensors: tags.some((tag) => /safetensors/i.test(tag)) ? 1 : 0,
        compatibility_summary: "[]",
        compatibility: [],
        content_warning: tags.some((tag) => /nsfw|adult|explicit/i.test(tag)) ? 1 : 0,
        content_flags: "[]",
        updated_at: String(model.lastModified || ""),
        quality_score: downloads / 1000 + likes,
        search_score: scoreLive(searchable, intent, downloads, likes),
        source: "hub-live"
      });
    }
  }
  return [...deduped.values()];
}

function passesLiveFilters(model: Record<string, unknown>, url: URL, intent: SearchIntent) {
  const base = (url.searchParams.get("base") || "").trim();
  const type = (url.searchParams.get("type") || "").trim();
  const author = normalize(url.searchParams.get("author") || "");
  const minDownloads = positiveNumber(url.searchParams.get("minDownloads"));
  const minLikes = positiveNumber(url.searchParams.get("minLikes"));
  const safetensors = Boolean(url.searchParams.get("safetensors"));
  const purposes = url.searchParams.getAll("purpose").filter(Boolean).map((purpose) => purpose === "Roleplay" ? "Character" : purpose);
  if (base && model.base_family !== base) return false;
  if (type && model.type !== type) return false;
  if (author && !normalize(String(model.author || "")).includes(author)) return false;
  if (minDownloads && Number(model.downloads || 0) < minDownloads) return false;
  if (minLikes && Number(model.likes || 0) < minLikes) return false;
  if (safetensors && !model.safetensors) return false;
  if (purposes.some((purpose) => !String(model.purpose || "").includes(purpose))) return false;
  if (intent.types.length && !intent.types.includes(String(model.type || ""))) return false;
  if (intent.bases.length && !intent.bases.includes(String(model.base_family || ""))) return false;
  return true;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const intent = naturalIntent(q);
  const conditions = ["1=1"];
  const whereValues: Array<string | number> = [];

  for (const filter of intent.fieldFilters) addFieldFilter(conditions, whereValues, filter);

  if (intent.freeTerms.length) {
    const termClauses = intent.freeTerms.map((term) => termMatchClause(term, whereValues));
    conditions.push(`(${termClauses.join(" OR ")})`);
  } else if (q && (intent.purposes.length || intent.types.length || intent.bases.length)) {
    const intentClauses: string[] = [];
    for (const purpose of intent.purposes) { intentClauses.push("m.purpose LIKE ? ESCAPE '\\'"); whereValues.push(`%${escapeLike(purpose)}%`); }
    for (const type of intent.types) { intentClauses.push("m.type=?"); whereValues.push(type); }
    for (const base of intent.bases) { intentClauses.push("(m.base_family=? OR LOWER(m.base_model) LIKE ? ESCAPE '\\')"); whereValues.push(base, loosePattern(base)); }
    if (intentClauses.length) conditions.push(`(${intentClauses.join(" OR ")})`);
  }

  const base = (url.searchParams.get("base") || "").trim();
  const type = (url.searchParams.get("type") || "").trim();
  const author = (url.searchParams.get("author") || "").trim();
  if (base) { conditions.push("m.base_family=?"); whereValues.push(base); }
  if (type) { conditions.push("m.type=?"); whereValues.push(type); }
  if (author) { conditions.push("LOWER(m.author) LIKE ? ESCAPE '\\'"); whereValues.push(loosePattern(author)); }

  const license = url.searchParams.get("license") || "";
  if (license === "commercial") conditions.push("m.commercial_use=1");
  if (license === "open") conditions.push("(m.license NOT LIKE '%OpenRAIL%' OR m.commercial_use=1)");
  const compatible = (url.searchParams.get("compatible") || "").trim();
  if (compatible) {
    const pattern = loosePattern(compatible);
    conditions.push("(LOWER(m.base_model) LIKE ? ESCAPE '\\' OR LOWER(m.compatibility_summary) LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM lora_resources rc WHERE rc.model_id=m.id AND LOWER(rc.base_model) LIKE ? ESCAPE '\\'))");
    whereValues.push(pattern, pattern, pattern);
  }

  const minRating = positiveNumber(url.searchParams.get("minRating"));
  const maxSize = positiveNumber(url.searchParams.get("maxSize"));
  const docs = positiveNumber(url.searchParams.get("docs"));
  const minDownloads = positiveNumber(url.searchParams.get("minDownloads"));
  const minLikes = positiveNumber(url.searchParams.get("minLikes"));
  const maxRank = positiveNumber(url.searchParams.get("maxRank"));
  if (minRating) { conditions.push("m.rating>=?"); whereValues.push(minRating); }
  if (maxSize) { conditions.push("m.file_size_mb<=?"); whereValues.push(maxSize); }
  if (docs) { conditions.push("m.docs_quality>=?"); whereValues.push(docs); }
  if (minDownloads) { conditions.push("m.downloads>=?"); whereValues.push(minDownloads); }
  if (minLikes) { conditions.push("m.likes>=?"); whereValues.push(minLikes); }
  if (maxRank) { conditions.push("m.lora_rank IS NOT NULL AND m.lora_rank<=?"); whereValues.push(maxRank); }

  const updatedDays = Math.min(3650, positiveNumber(url.searchParams.get("updatedDays")));
  if (updatedDays) { conditions.push("m.updated_at>=datetime('now', ?)"); whereValues.push(`-${updatedDays} days`); }
  if (url.searchParams.get("safetensors")) conditions.push("m.safetensors=1");
  for (const purpose of url.searchParams.getAll("purpose").filter(Boolean)) {
    const normalizedPurpose = purpose === "Roleplay" ? "Character" : purpose;
    conditions.push("m.purpose LIKE ? ESCAPE '\\'"); whereValues.push(`%${escapeLike(normalizedPurpose)}%`);
  }

  const scoreValues: Array<string | number> = [];
  const searchScore = buildSearchScore(intent, scoreValues);
  const where = `WHERE ${conditions.join(" AND ")}`;
  const sortKey = url.searchParams.get("sort") || "fit";
  const order = SORTS[sortKey] || SORTS.fit;
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 40)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const candidateLimit = q && offset === 0 && sortKey === "fit" ? Math.min(100, Math.max(limit * 2, 60)) : limit;

  const [countResult, modelResult] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM models m ${where}`).bind(...whereValues),
    env.DB.prepare(`SELECT ${MODEL_FIELDS}, (${searchScore}) AS search_score FROM models m ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...scoreValues, ...whereValues, candidateLimit, offset)
  ]);

  const indexedRows = modelResult.results as Array<Record<string, unknown>>;
  const votes = new Map<string, Array<{ target: string; works: number; doesnt_work: number }>>();
  if (indexedRows.length) {
    const ids = indexedRows.map((row) => String(row.id));
    const placeholders = ids.map(() => "?").join(",");
    const voteResult = await env.DB.prepare(`SELECT model_id,target,status,COUNT(*) AS reports FROM compatibility_votes WHERE model_id IN (${placeholders}) GROUP BY model_id,target,status ORDER BY reports DESC`).bind(...ids).all();
    for (const row of voteResult.results as Array<Record<string, unknown>>) {
      const modelId = String(row.model_id);
      const items = votes.get(modelId) || [];
      let item = items.find((candidate) => candidate.target === String(row.target));
      if (!item) { item = { target: String(row.target), works: 0, doesnt_work: 0 }; items.push(item); }
      if (row.status === "works") item.works = Number(row.reports || 0);
      else item.doesnt_work = Number(row.reports || 0);
      votes.set(modelId, items);
    }
  }

  const indexed: Array<Record<string, unknown>> = indexedRows.map((model) => {
    let seededCompatibility: unknown[] = [];
    try { seededCompatibility = JSON.parse(String(model.compatibility_summary || "[]")) as unknown[]; } catch { seededCompatibility = []; }
    return { ...model, compatibility: votes.get(String(model.id)) || seededCompatibility, source: "index" };
  });

  const liveAllowed = Boolean(q) && offset === 0 && !minRating && !maxSize && !docs && !maxRank && !compatible && !intent.fieldFilters.some((filter) => ["trigger", "file", "hash"].includes(filter.field));
  const liveCandidates = liveAllowed ? (await fetchLiveHub(env, intent, q, Math.max(30, limit))).filter((model) => passesLiveFilters(model, url, intent)) : [];
  const indexedIds = new Set(indexed.map((model) => String(model.id)));
  const live = liveCandidates.filter((model) => !indexedIds.has(String(model.id)));

  let models: Array<Record<string, unknown>> = [...indexed, ...live];
  if (q && sortKey === "fit" && offset === 0) {
    models.sort((a, b) => Number(b.search_score || 0) - Number(a.search_score || 0) || Number(b.quality_score || 0) - Number(a.quality_score || 0) || Number(b.downloads || 0) - Number(a.downloads || 0));
  }
  models = models.slice(0, limit);

  const localTotal = Number((countResult.results[0] as Record<string, unknown>)?.total || 0);
  return json({
    models,
    total: localTotal + live.length,
    indexedTotal: localTotal,
    liveCount: live.length,
    limit,
    offset,
    sort: sortKey,
    interpreted: intent
  });
};
