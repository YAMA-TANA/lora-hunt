import { json, type Env } from "../_auth";

const sortColumns: Record<string, string> = {
  fit: "quality_score DESC, downloads DESC",
  rating: "rating DESC, review_count DESC",
  downloads: "downloads DESC, likes DESC",
  updated: "updated_at DESC"
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const conditions = ["1 = 1"];
  const values: Array<string | number> = [];
  const q = url.searchParams.get("q")?.trim();
  const base = url.searchParams.get("base");
  const type = url.searchParams.get("type");
  const license = url.searchParams.get("license");
  const compatible = url.searchParams.get("compatible");
  const minRating = Number(url.searchParams.get("minRating") || 0);
  const maxSize = Number(url.searchParams.get("maxSize") || 0);
  const minDocs = Number(url.searchParams.get("docs") || 0);
  const purposes = url.searchParams.getAll("purpose");
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

 if (q) {
    q.split(/\s+/).filter(Boolean).slice(0, 8).forEach((term) => {
      conditions.push("(name LIKE ? OR author LIKE ? OR base_model LIKE ? OR purpose LIKE ? OR description LIKE ?)");
      const pattern = "%" + term + "%";
      values.push(pattern, pattern, pattern, pattern, pattern);
    });
 }
  if (base) { conditions.push("base_family = ?"); values.push(base); }
  if (type) { conditions.push("type = ?"); values.push(type); }
  if (license === "commercial") conditions.push("commercial_use = 1");
  if (license === "open") conditions.push("license NOT LIKE '%OpenRAIL%' OR commercial_use = 1");
  if (compatible) { conditions.push("(base_model LIKE ? OR compatibility_summary LIKE ?)"); values.push(`%${compatible}%`, `%${compatible}%`); }
  if (minRating) { conditions.push("rating >= ?"); values.push(minRating); }
  if (maxSize) { conditions.push("file_size_mb <= ?"); values.push(maxSize); }
  if (minDocs) { conditions.push("docs_quality >= ?"); values.push(minDocs); }
  if (url.searchParams.get("safetensors")) conditions.push("safetensors = 1");
  purposes.forEach((purpose) => { conditions.push("purpose LIKE ?"); values.push(`%${purpose}%`); });

  const where = `WHERE ${conditions.join(" AND ")}`;
  const order = sortColumns[url.searchParams.get("sort") || "fit"] || sortColumns.fit;
  const queryValues = [...values];
  const [countResult, modelResult, voteResult] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM models ${where}`).bind(...queryValues),
    env.DB.prepare(`SELECT id, slug, name, author, hf_url, type, base_family, base_model, purpose, description, best_for, license, commercial_use, lora_rank, file_size_mb, downloads, likes, rating, review_count, docs_quality, safetensors, compatibility_summary, updated_at, quality_score FROM models ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...queryValues, limit, offset),
    env.DB.prepare("SELECT model_id, target, status, COUNT(*) AS reports FROM compatibility_votes GROUP BY model_id, target, status ORDER BY reports DESC")
  ]);
  const votes = new Map<string, Array<{ target: string; works: number; doesnt_work: number }>>();
  for (const row of voteResult.results as Array<Record<string, unknown>>) {
    const modelId = String(row.model_id);
    const items = votes.get(modelId) || [];
    let item = items.find((candidate) => candidate.target === String(row.target));
    if (!item) { item = { target: String(row.target), works: 0, doesnt_work: 0 }; items.push(item); }
    if (row.status === "works") item.works = Number(row.reports || 0);
    else item.doesnt_work = Number(row.reports || 0);
    votes.set(modelId, items);
  }
  const models = (modelResult.results as Array<Record<string, unknown>>).map((model) => {
    let seededCompatibility: unknown[] = [];
    try { seededCompatibility = JSON.parse(String(model.compatibility_summary || "[]")) as unknown[]; } catch { seededCompatibility = []; }
    return { ...model, compatibility: votes.get(String(model.id)) || seededCompatibility };
  });
  return json({ models, total: Number((countResult.results[0] as Record<string, unknown>)?.total || 0), limit, offset });
};
