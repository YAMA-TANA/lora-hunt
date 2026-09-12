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

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const conditions = ["1 = 1"];
  const values: Array<string | number> = [];
  const q = (url.searchParams.get("q") || "").trim();
  const textTerms = q.match(/"[^"]+"|\S+/g)?.map((term) => term.replace(/^"|"$/g, "")) || [];

  for (const term of textTerms.slice(0, 10)) {
    const operator = term.match(/^([a-zA-Z][\w-]*):(.*)$/);
    if (!operator) {
      const pattern = `%${term}%`;
      conditions.push("(name LIKE ? OR slug LIKE ? OR author LIKE ? OR base_model LIKE ? OR base_family LIKE ? OR purpose LIKE ? OR best_for LIKE ? OR description LIKE ? OR license LIKE ?)");
      values.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
      continue;
    }

    const key = operator[1].toLowerCase();
    const value = operator[2].replace(/^"|"$/g, "").trim();
    const pattern = `%${value}%`;
    if (!value) continue;
    if (key === "author") { conditions.push("author LIKE ?"); values.push(pattern); }
    else if (key === "base") { conditions.push("(base_model LIKE ? OR base_family LIKE ?)"); values.push(pattern, pattern); }
    else if (key === "type") { conditions.push("type LIKE ?"); values.push(pattern); }
    else if (key === "purpose" || key === "tag") { conditions.push("purpose LIKE ?"); values.push(pattern); }
    else if (key === "best") { conditions.push("best_for LIKE ?"); values.push(pattern); }
    else if (key === "license" && value.toLowerCase() === "commercial") conditions.push("commercial_use = 1");
    else if (key === "license") { conditions.push("license LIKE ?"); values.push(pattern); }
    else if (key === "format" && value.toLowerCase().includes("safetensor")) conditions.push("safetensors = 1");
    else if (key === "minlikes" && positiveNumber(value)) { conditions.push("likes >= ?"); values.push(positiveNumber(value)); }
    else if ((key === "mindownloads" || key === "mindl") && positiveNumber(value)) { conditions.push("downloads >= ?"); values.push(positiveNumber(value)); }
    else if (key === "minrating" && positiveNumber(value)) { conditions.push("rating >= ?"); values.push(positiveNumber(value)); }
    else if (key === "maxsize" && positiveNumber(value)) { conditions.push("file_size_mb <= ?"); values.push(positiveNumber(value)); }
    else if (key === "maxrank" && positiveNumber(value)) { conditions.push("lora_rank IS NOT NULL AND lora_rank <= ?"); values.push(positiveNumber(value)); }
    else if (key === "updated" && positiveNumber(value.replace(/d$/i, ""))) {
      conditions.push("updated_at >= datetime('now', ?)");
      values.push(`-${Math.min(3650, positiveNumber(value.replace(/d$/i, "")))} days`);
    }
  }

  const exactFilters: Array<[string, string]> = [["base", "base_family"], ["type", "type"]];
  for (const [param, column] of exactFilters) {
    const value = (url.searchParams.get(param) || "").trim();
    if (value) { conditions.push(`${column} = ?`); values.push(value); }
  }

  const author = (url.searchParams.get("author") || "").trim();
  if (author) { conditions.push("author LIKE ?"); values.push(`%${author}%`); }
  const license = url.searchParams.get("license") || "";
  if (license === "commercial") conditions.push("commercial_use = 1");
  if (license === "open") conditions.push("(license NOT LIKE '%OpenRAIL%' OR commercial_use = 1)");
  const compatible = (url.searchParams.get("compatible") || "").trim();
  if (compatible) { conditions.push("(base_model LIKE ? OR compatibility_summary LIKE ?)"); values.push(`%${compatible}%`, `%${compatible}%`); }

  const numericFilters: Array<[string, string, string]> = [
    ["minRating", "rating", ">="], ["maxSize", "file_size_mb", "<="], ["docs", "docs_quality", ">="],
    ["minDownloads", "downloads", ">="], ["minLikes", "likes", ">="], ["maxRank", "lora_rank", "<="]
  ];
  for (const [param, column, op] of numericFilters) {
    const value = positiveNumber(url.searchParams.get(param));
    if (value) { conditions.push(`${column} ${op} ?`); values.push(value); }
  }

  const updatedDays = Math.min(3650, positiveNumber(url.searchParams.get("updatedDays")));
  if (updatedDays) { conditions.push("updated_at >= datetime('now', ?)"); values.push(`-${updatedDays} days`); }
  if (url.searchParams.get("safetensors")) conditions.push("safetensors = 1");
  for (const purpose of url.searchParams.getAll("purpose").filter(Boolean)) {
    conditions.push("purpose LIKE ?"); values.push(`%${purpose}%`);
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

  return json({ models: modelResult.results, total: Number((countResult.results[0] as Record<string, unknown>)?.total || 0), limit, offset, sort: sortKey });
};
