import { json, type Env } from "../_auth";
import { onRequestGet as searchRequest } from "./search";

// Keep /api/models as the stable UI endpoint, but let the dedicated search
// engine own retrieval and ranking. The current browser bundle still applies
// a literal client-side query filter and re-sorts `fit` by quality_score, so
// this adapter exposes the query in the non-rendered purpose field and folds
// search_score into quality_score for this legacy response only.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const response = await searchRequest(context);
  if (!response.ok) return response;

  const payload = await response.json() as Record<string, unknown>;
  const q = new URL(context.request.url).searchParams.get("q")?.trim() || "";
  const models = Array.isArray(payload.models) ? payload.models as Array<Record<string, unknown>> : [];

  if (q) {
    payload.models = models.map((model) => ({
      ...model,
      purpose: `${String(model.purpose || "General")} ${q}`,
      quality_score: Number(model.search_score || 0) * 1_000_000 + Number(model.quality_score || 0)
    }));
  }

  return json(payload);
};
