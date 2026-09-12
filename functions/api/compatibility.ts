import { getAuthUser, json, type Env } from "../_auth";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const userId = await getAuthUser(request, env);
  if (!userId) return json({ error: "Sign in is required to report compatibility." }, 401);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "The compatibility payload is invalid." }, 400); }
  const modelId = String(body.modelId || "");
  const target = String(body.target || "").slice(0, 120);
  const status = body.status === "works" || body.status === "doesnt_work" ? body.status : "";
  if (!modelId || !target || !status) return json({ error: "Choose a model, target, and result." }, 400);
  const model = await env.DB.prepare("SELECT id FROM models WHERE id = ?").bind(modelId).first();
  if (!model) return json({ error: "That model is not in the index." }, 404);
  await env.DB.prepare("INSERT INTO compatibility_votes (id, model_id, user_id, target, status, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(model_id, user_id, target) DO UPDATE SET status=excluded.status, created_at=excluded.created_at").bind(crypto.randomUUID(), modelId, userId, target, status, new Date().toISOString()).run();
  return json({ ok: true });
};
