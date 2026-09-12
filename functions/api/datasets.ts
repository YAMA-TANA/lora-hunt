import { json, type Env } from "../_auth";

const sortColumns: Record<string, string> = {
  fit: "quality_score DESC, downloads DESC",
  downloads: "downloads DESC, likes DESC",
  likes: "likes DESC, downloads DESC",
  updated: "updated_at DESC"
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const conditions = ["1 = 1"];
  const values: Array<string | number> = [];
  const query = url.searchParams.get("q")?.trim();
  const task = url.searchParams.get("task")?.trim();
  const limit = Math.min(24, Math.max(1, Number(url.searchParams.get("limit") || 6)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  if (query) {
    query.split(/\s+/).filter(Boolean).slice(0, 8).forEach((term) => {
      conditions.push("(name LIKE ? OR author LIKE ? OR task LIKE ? OR tags LIKE ? OR description LIKE ?)");
      const pattern = `%${term}%`;
      values.push(pattern, pattern, pattern, pattern, pattern);
    });
  }
  if (task) { conditions.push("task LIKE ?"); values.push(`%${task}%`); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const order = sortColumns[url.searchParams.get("sort") || "fit"] || sortColumns.fit;
  const queryValues = [...values];
  const [countResult, datasetResult] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM datasets ${where}`).bind(...queryValues),
    env.DB.prepare(`SELECT id, slug, name, author, hf_url, task, description, tags, license, downloads, likes, file_size_mb, files_count, docs_quality, gated, updated_at, quality_score FROM datasets ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...queryValues, limit, offset)
  ]);
  return json({ datasets: datasetResult.results, total: Number((countResult.results[0] as Record<string, unknown>)?.total || 0), limit, offset });
};
