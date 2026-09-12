import { getAuthUser, json, type Env } from "../_auth";

const ratingFields = ["overall", "outputQuality", "matchesDescription", "easeOfUse", "documentation"] as const;
const textFields = ["baseModel", "runtime", "quantization", "hardware", "note"] as const;

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const userId = await getAuthUser(request, env);
  if (!userId) return json({ error: "Sign in is required to publish a review." }, 401);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "The review payload is invalid." }, 400); }
  const modelId = String(body.modelId || "");
  if (!modelId) return json({ error: "Choose a model before publishing." }, 400);
  const model = await env.DB.prepare("SELECT id FROM models WHERE id = ?").bind(modelId).first();
  if (!model) return json({ error: "That model is not in the index." }, 404);
  const ratings = ratingFields.map((field) => Number(body[field] || 0));
  if (ratings.some((rating) => !Number.isInteger(rating) || rating < 1 || rating > 5)) return json({ error: "Each rating must be between 1 and 5." }, 400);
  const loraStrength = body.loraStrength === "" || body.loraStrength == null ? null : Number(body.loraStrength);
  if (loraStrength !== null && (!Number.isFinite(loraStrength) || loraStrength < 0 || loraStrength > 2)) return json({ error: "LoRA strength must be between 0 and 2." }, 400);
  const now = new Date().toISOString();
  const textValues = textFields.map((field) => String(body[field] || "").slice(0, field === "note" ? 600 : 120) || null);
  const upsert = env.DB.prepare(`INSERT INTO reviews (id, model_id, user_id, overall, output_quality, matches_description, ease_of_use, documentation, base_model, runtime, quantization, lora_strength, hardware, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(model_id, user_id) DO UPDATE SET overall=excluded.overall, output_quality=excluded.output_quality, matches_description=excluded.matches_description, ease_of_use=excluded.ease_of_use, documentation=excluded.documentation, base_model=excluded.base_model, runtime=excluded.runtime, quantization=excluded.quantization, lora_strength=excluded.lora_strength, hardware=excluded.hardware, note=excluded.note, created_at=excluded.created_at`).bind(crypto.randomUUID(), modelId, userId, ...ratings, ...textValues.slice(0, 3), loraStrength, textValues[3], textValues[4], now);
  const aggregate = env.DB.prepare("UPDATE models SET rating = ROUND((SELECT AVG(overall) FROM reviews WHERE model_id = ?), 1), review_count = (SELECT COUNT(*) FROM reviews WHERE model_id = ?), quality_score = ROUND(COALESCE((SELECT AVG(overall) FROM reviews WHERE model_id = ?), 0) * 15 + (SELECT COUNT(*) FROM reviews WHERE model_id = ?) * 0.8 + docs_quality * 2, 1) WHERE id = ?").bind(modelId, modelId, modelId, modelId, modelId);
  await env.DB.batch([upsert, aggregate]);
  return json({ ok: true });
};
