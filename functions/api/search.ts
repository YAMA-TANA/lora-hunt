import { json, type Env } from "../_auth";

const SORTS: Record<string, string> = {
  fit: "quality_score DESC, downloads DESC",
  rating: "rating DESC, review_count DESC",
  downloads: "downloads DESC, likes DESC",
  likes: "likes DESC, downloads DESC",
  reviews: "review_count DESC, rating DESC, downloads DESC",
  smallest: "CASE WHEN file_size_mb IS NULL THEN 1 ELSE 0 END, file_size_mb ASC, downloads DESC",
  rank: "CASE WHEN lora_rank IS NULL THEN 1 ELSE 0 END, lora_rank ASC, downloads DESC",
  updated: "updated_at DESC"
};

const positiveNumber = (value: string | null) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const familyFrom = (value: string) => {
  const text = value.toLowerCase();
  if (text.includes("qwen")) return "Qwen";
  if (text.includes("llama")) return "Llama";
  if (text.includes("gemma")) return "Gemma";
  if (text.includes("flux")) return "FLUX";
  if (text.includes("wan")) return "Wan";
  if (text.includes("ltx")) return "LTX";
  return "Other";
};

const typeFrom = (value: string) => {
  const text = value.toLowerCase();
  if (/video|wan|ltx/.test(text)) return "Video";
  if (/audio|music|voice|speech/.test(text)) return "Audio";
  if (/image|diffusers|flux|stable-diffusion|sdxl/.test(text)) return "Image";
  return "LLM";
};

function naturalIntent(input: string) {
  const text = input.trim();
  const lower = text.toLowerCase();
  const purposes: string[] = [];
  const types: string[] = [];
  const bases: string[] = [];
  const hub: string[] = [];

  const addPurpose = (label: string, word: string, pattern: RegExp) => {
    if (pattern.test(lower)) { purposes.push(label); hub.push(word); }
  };
  addPurpose("Japanese", "japanese", /日本語|japanese|和文|日本向け/);
  addPurpose("Character", "roleplay", /role\s*-?play|ロールプレイ|なりきり|キャラ(?:クター)?|persona|会話向け/);
  addPurpose("Coding", "coding", /coding|code|program|コーディング|プログラミング|コード生成/);
  addPurpose("Reasoning", "reasoning", /reasoning|reason|推論|数学|math|cot/);
  addPurpose("Style", "style", /style|スタイル|画風|絵柄|作風|texture|toon/);
  addPurpose("Motion", "motion", /motion|動き|動画|transition|camera|orbit/);

  const addType = (label: string, word: string, pattern: RegExp) => {
    if (pattern.test(lower)) { types.push(label); hub.push(word); }
  };
  addType("Image", "image", /画像|image|イラスト|画像生成|diffusion/);
  addType("Video", "video", /動画|video|映像/);
  addType("Audio", "audio", /音声|audio|voice|music|音楽/);
  if (/llm|言語モデル|テキスト|文章/.test(lower)) types.push("LLM");

  for (const base of ["qwen", "llama", "gemma", "flux", "wan", "ltx", "sdxl", "sd3"]) {
    if (lower.includes(base)) { bases.push(base); hub.push(base); }
  }

  let residual = lower
    .replace(/日本語|japanese|和文|日本向け/g, " ")
    .replace(/role\s*-?play|ロールプレイ|なりきり|キャラ(?:クター)?|persona|会話向け/g, " ")
    .replace(/coding|code|program|コーディング|プログラミング|コード生成/g, " ")
    .replace(/reasoning|reason|推論|数学|math|cot/g, " ")
    .replace(/style|スタイル|画風|絵柄|作風|texture|toon/g, " ")
    .replace(/motion|動き|動画|transition|camera|orbit/g, " ")
    .replace(/画像生成|画像|image|イラスト|diffusion|video|映像|音声|audio|voice|music|音楽|llm|言語モデル|テキスト|文章/g, " ")
    .replace(/qwen|llama|gemma|flux|wan|ltx|sdxl|sd3/g, " ")
    .replace(/(?:の|な|向け|用|モデル|lora|adapter|を|で|に|が|と)+/g, " ")
    .replace(/[^\p{L}\p{N}._+/-]+/gu, " ")
    .trim();

  const freeTerms = residual.split(/\s+/).filter((term) => term.length > 1).slice(0, 5);
  hub.push(...freeTerms);
  return {
    purposes: [...new Set(purposes)],
    types: [...new Set(types)],
    bases: [...new Set(bases)],
    freeTerms,
    hubQuery: [...new Set(hub)].join(" ") || text
  };
}

function hubPurpose(value: string) {
  const lower = value.toLowerCase();
  const purposes: string[] = [];
  if (/japanese|日本語|ja[-_ ]/.test(lower)) purposes.push("Japanese");
  if (/role\s*-?play|character|persona|chat/.test(lower)) purposes.push("Character");
  if (/coding|code|program|developer/.test(lower)) purposes.push("Coding");
  if (/reason|math|cot/.test(lower)) purposes.push("Reasoning");
  if (/style|toon|texture|art|illustration/.test(lower)) purposes.push("Style");
  if (/motion|video|transition|camera/.test(lower)) purposes.push("Motion");
  return [...new Set(purposes)].join(", ") || "General";
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const conditions = ["1 = 1"];
  const values: Array<string | number> = [];
  const q = (url.searchParams.get("q") || "").trim();
  const intent = naturalIntent(q);

  for (const purpose of intent.purposes) { conditions.push("purpose LIKE ?"); values.push(`%${purpose}%`); }
  if (intent.types.length === 1) { conditions.push("type = ?"); values.push(intent.types[0]); }
  for (const base of intent.bases) { conditions.push("(base_model LIKE ? OR base_family LIKE ?)"); values.push(`%${base}%`, `%${base}%`); }
  for (const term of intent.freeTerms) {
    const pattern = `%${term}%`;
    conditions.push("(name LIKE ? OR slug LIKE ? OR author LIKE ? OR base_model LIKE ? OR purpose LIKE ? OR best_for LIKE ? OR description LIKE ?)");
    values.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const base = (url.searchParams.get("base") || "").trim();
  const type = (url.searchParams.get("type") || "").trim();
  const author = (url.searchParams.get("author") || "").trim();
  if (base) { conditions.push("base_family = ?"); values.push(base); }
  if (type) { conditions.push("type = ?"); values.push(type); }
  if (author) { conditions.push("author LIKE ?"); values.push(`%${author}%`); }

  const license = url.searchParams.get("license") || "";
  if (license === "commercial") conditions.push("commercial_use = 1");
  if (license === "open") conditions.push("(license NOT LIKE '%OpenRAIL%' OR commercial_use = 1)");
  const compatible = (url.searchParams.get("compatible") || "").trim();
  if (compatible) { conditions.push("(base_model LIKE ? OR compatibility_summary LIKE ?)"); values.push(`%${compatible}%`, `%${compatible}%`); }

  const minRating = positiveNumber(url.searchParams.get("minRating"));
  const maxSize = positiveNumber(url.searchParams.get("maxSize"));
  const docs = positiveNumber(url.searchParams.get("docs"));
  const minDownloads = positiveNumber(url.searchParams.get("minDownloads"));
  const minLikes = positiveNumber(url.searchParams.get("minLikes"));
  const maxRank = positiveNumber(url.searchParams.get("maxRank"));
  if (minRating) { conditions.push("rating >= ?"); values.push(minRating); }
  if (maxSize) { conditions.push("file_size_mb <= ?"); values.push(maxSize); }
  if (docs) { conditions.push("docs_quality >= ?"); values.push(docs); }
  if (minDownloads) { conditions.push("downloads >= ?"); values.push(minDownloads); }
  if (minLikes) { conditions.push("likes >= ?"); values.push(minLikes); }
  if (maxRank) { conditions.push("lora_rank IS NOT NULL AND lora_rank <= ?"); values.push(maxRank); }

  const updatedDays = Math.min(3650, positiveNumber(url.searchParams.get("updatedDays")));
  if (updatedDays) { conditions.push("updated_at >= datetime('now', ?)"); values.push(`-${updatedDays} days`); }
  if (url.searchParams.get("safetensors")) conditions.push("safetensors = 1");
  for (const purpose of url.searchParams.getAll("purpose").filter(Boolean)) {
    const normalized = purpose === "Roleplay" ? "Character" : purpose;
    conditions.push("purpose LIKE ?"); values.push(`%${normalized}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const sortKey = url.searchParams.get("sort") || "fit";
  const order = SORTS[sortKey] || SORTS.fit;
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const [countResult, modelResult] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM models ${where}`).bind(...values),
    env.DB.prepare(`SELECT id, slug, name, author, hf_url, type, base_family, base_model, purpose, description, best_for, license, commercial_use, lora_rank, file_size_mb, downloads, likes, rating, review_count, docs_quality, safetensors, compatibility_summary, content_warning, content_flags, updated_at, quality_score FROM models ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...values, limit, offset)
  ]);

  const indexed = (modelResult.results as Array<Record<string, unknown>>).map((model) => ({ ...model, source: "index" }));
  const localTotal = Number((countResult.results[0] as Record<string, unknown>)?.total || 0);
  const canUseLiveHub = Boolean(q) && offset === 0 && !minRating && !maxSize && !docs && !maxRank && !compatible;
  const live: Array<Record<string, unknown>> = [];

  if (canUseLiveHub && indexed.length < limit) {
    try {
      const hubQuery = `${intent.hubQuery} lora`.trim();
      const response = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(hubQuery)}&limit=50&sort=downloads&direction=-1&full=true`, {
        headers: { Accept: "application/json", ...(env.HF_TOKEN ? { Authorization: `Bearer ${env.HF_TOKEN}` } : {}) }
      });
      if (response.ok) {
        const payload = await response.json() as Array<Record<string, unknown>>;
        const seen = new Set(indexed.map((model) => String(model.id)));
        for (const model of payload) {
          if (live.length + indexed.length >= limit) break;
          const id = String(model.id || "");
          const tags = Array.isArray(model.tags) ? model.tags.map(String) : [];
          const searchable = `${id} ${tags.join(" ")} ${String(model.pipeline_tag || "")} ${String(model.library_name || "")}`;
          if (!id || seen.has(id) || !/lora|adapter|peft/i.test(searchable)) continue;
          const modelType = typeFrom(searchable);
          const baseModelTag = tags.find((tag) => /^base_model:(adapter:)?/i.test(tag));
          const baseModel = String((model.cardData as Record<string, unknown> | undefined)?.base_model || baseModelTag?.replace(/^base_model:(adapter:)?/i, "") || "Unknown base");
          const family = familyFrom(`${baseModel} ${id}`);
          const purpose = hubPurpose(searchable);
          if (type && modelType !== type) continue;
          if (base && family !== base) continue;
          if (intent.types.length === 1 && modelType !== intent.types[0]) continue;
          if (intent.purposes.some((item) => !purpose.includes(item))) continue;
          if (minDownloads && Number(model.downloads || 0) < minDownloads) continue;
          if (minLikes && Number(model.likes || 0) < minLikes) continue;
          if (url.searchParams.get("safetensors") && !tags.some((tag) => /safetensors/i.test(tag))) continue;
          seen.add(id);
          live.push({
            id,
            slug: id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
            name: id.split("/").pop() || id,
            author: id.split("/")[0] || "unknown",
            hf_url: `https://huggingface.co/${id}`,
            type: modelType,
            base_family: family,
            base_model: baseModel,
            purpose,
            description: "Hugging Face から検索時に見つかったLoRAです。詳細メタデータは元のモデルカードで確認できます。",
            best_for: purpose === "General" ? "用途をモデルカードで確認" : `${purpose.split(", ")[0]}向け`,
            license: String((model.cardData as Record<string, unknown> | undefined)?.license || "Unknown"),
            commercial_use: 0,
            lora_rank: null,
            file_size_mb: null,
            downloads: Number(model.downloads || 0),
            likes: Number(model.likes || 0),
            rating: null,
            review_count: 0,
            docs_quality: 0,
            safetensors: tags.some((tag) => /safetensors/i.test(tag)) ? 1 : 0,
            compatibility_summary: "[]",
            updated_at: String(model.lastModified || ""),
            quality_score: Number(model.downloads || 0) / 1000 + Number(model.likes || 0),
            source: "hub-live"
          });
        }
      }
    } catch { /* Local index remains authoritative if live discovery fails. */ }
  }

  const models = [...indexed, ...live];
  return json({ models, total: localTotal + live.length, indexedTotal: localTotal, liveCount: live.length, limit, offset, sort: sortKey, interpreted: intent });
};
