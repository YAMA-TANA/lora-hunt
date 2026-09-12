import { json, type Env } from "../_auth";

const n = (value: string | null) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const intent = (input: string) => {
  const lower = input.toLowerCase();
  const purpose: string[] = [];
  if (/日本語|japanese|和文/.test(lower)) purpose.push("Japanese");
  if (/role.?play|ロールプレイ|なりきり|character|キャラ|persona/.test(lower)) purpose.push("Character");
  if (/coding|code|program|コーディング|プログラミング/.test(lower)) purpose.push("Coding");
  if (/reason|推論|math|数学/.test(lower)) purpose.push("Reasoning");
  if (/style|スタイル|画風|絵柄|anime|photo|portrait/.test(lower)) purpose.push("Style");
  if (/motion|動画|video|animation|camera/.test(lower)) purpose.push("Motion");
  const terms = lower
    .replace(/日本語|japanese|和文|role.?play|ロールプレイ|なりきり|character|キャラ(?:クター)?|persona|coding|code|program|コーディング|プログラミング|reason|推論|math|数学|style|スタイル|画風|絵柄|anime|photo|portrait|motion|動画|video|animation|camera/g, " ")
    .replace(/(?:の|な|向け|用|モデル|lora|adapter|ファイル|file|を|で|に|が|と)+/g, " ")
    .replace(/[^\p{L}\p{N}._+:/-]+/gu, " ")
    .trim().split(/\s+/).filter((x) => x.length > 1).slice(0, 8);
  return { purpose: [...new Set(purpose)], terms };
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const { purpose, terms } = intent(q);
  const conditions = ["1=1"];
  const values: Array<string | number> = [];

  for (const p of purpose) { conditions.push("m.purpose LIKE ?"); values.push(`%${p}%`); }
  for (const term of terms) {
    const op = term.match(/^([a-z]+):(.*)$/i);
    if (op && op[2]) {
      const pattern = `%${op[2]}%`;
      if (op[1] === "trigger") { conditions.push("r.trigger_words LIKE ?"); values.push(pattern); continue; }
      if (op[1] === "base") { conditions.push("(r.base_model LIKE ? OR r.base_family LIKE ?)"); values.push(pattern, pattern); continue; }
      if (op[1] === "file") { conditions.push("(r.filename LIKE ? OR r.path LIKE ?)"); values.push(pattern, pattern); continue; }
      if (op[1] === "repo") { conditions.push("(m.id LIKE ? OR m.name LIKE ?)"); values.push(pattern, pattern); continue; }
    }
    const pattern = `%${term}%`;
    conditions.push("(r.filename LIKE ? OR r.path LIKE ? OR r.trigger_words LIKE ? OR r.base_model LIKE ? OR r.target_modules LIKE ? OR m.id LIKE ? OR m.name LIKE ? OR m.author LIKE ? OR m.purpose LIKE ?)");
    values.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const baseModel = (url.searchParams.get("baseModel") || url.searchParams.get("compatible") || "").trim();
  if (baseModel) { conditions.push("(r.base_model LIKE ? OR r.base_family LIKE ?)"); values.push(`%${baseModel}%`, `%${baseModel}%`); }
  const base = (url.searchParams.get("base") || "").trim();
  if (base) { conditions.push("r.base_family=?"); values.push(base); }
  const type = (url.searchParams.get("type") || "").trim();
  if (type) { conditions.push("m.type=?"); values.push(type); }
  const author = (url.searchParams.get("author") || "").trim();
  if (author) { conditions.push("m.author LIKE ?"); values.push(`%${author}%`); }
  if (url.searchParams.get("examples")) conditions.push("r.has_examples=1");
  if (url.searchParams.get("enriched")) conditions.push("r.enriched_at IS NOT NULL");
  const maxRank = n(url.searchParams.get("maxRank"));
  if (maxRank) { conditions.push("r.lora_rank IS NOT NULL AND r.lora_rank<=?"); values.push(maxRank); }
  const maxSize = n(url.searchParams.get("maxSize"));
  if (maxSize) { conditions.push("r.size_mb IS NOT NULL AND r.size_mb<=?"); values.push(maxSize); }
  const minDownloads = n(url.searchParams.get("minDownloads"));
  if (minDownloads) { conditions.push("m.downloads>=?"); values.push(minDownloads); }
  const minLikes = n(url.searchParams.get("minLikes"));
  if (minLikes) { conditions.push("m.likes>=?"); values.push(minLikes); }

  const orders: Record<string, string> = {
    fit: "r.metadata_confidence DESC,m.quality_score DESC,m.downloads DESC",
    downloads: "m.downloads DESC,m.likes DESC",
    likes: "m.likes DESC,m.downloads DESC",
    smallest: "CASE WHEN r.size_mb IS NULL THEN 1 ELSE 0 END,r.size_mb ASC,m.downloads DESC",
    rank: "CASE WHEN r.lora_rank IS NULL THEN 1 ELSE 0 END,r.lora_rank ASC,m.downloads DESC",
    updated: "r.updated_at DESC"
  };
  const sort = url.searchParams.get("sort") || "fit";
  const order = orders[sort] || orders.fit;
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") || 30)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const where = `WHERE ${conditions.join(" AND ")}`;
  const fields = "r.id,r.model_id,r.path,r.filename,r.source_url,r.format,r.size_mb,r.sha256,r.base_model,r.base_family,r.trigger_words,r.recommended_weight_min,r.recommended_weight_max,r.lora_rank,r.alpha,r.target_modules,r.network_type,r.has_examples,r.metadata_confidence,r.enriched_at,r.updated_at,m.name repo_name,m.author,m.type,m.purpose,m.downloads,m.likes,m.license,m.hf_url repo_url,m.slug repo_slug";
  const [countResult, dataResult] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) total FROM lora_resources r JOIN models m ON m.id=r.model_id ${where}`).bind(...values),
    env.DB.prepare(`SELECT ${fields} FROM lora_resources r JOIN models m ON m.id=r.model_id ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...values, limit, offset)
  ]);
  return json({ resources: dataResult.results, total: Number((countResult.results[0] as Record<string, unknown>)?.total || 0), limit, offset, sort });
};
