import { json, type Env } from "../_auth";
import { onRequestGet as searchRequest } from "./search";

function searchQueryForEngine(input: string) {
  // Japanese search is frequently entered without spaces. Separating known
  // intent words lets search.ts interpret them instead of requiring a literal
  // compound such as "日本語キャラ" to appear in the model card.
  const spaced = input.normalize("NFKC")
    .replace(/(日本向け|日本語|和文|キャラクター|キャラ|なりきり|ロールプレイ|コード生成|コーディング|プログラミング|推論|数学|画像生成|イラスト|画像|動画|映像|音声|音楽|スタイル|画風|絵柄|アニメ|写真|実写|ポートレート|動き|ポーズ|言語モデル)/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();

  // The ranked SQL deliberately searches many model/resource fields. Keep a
  // browser query compact so one request cannot create an excessive number of
  // bound parameters; longer natural-language queries still retain their most
  // important leading concepts.
  const tokens = spaced.match(/"[^"]+"|'[^']+'|\S+/g) || [];
  return tokens.slice(0, 3).join(" ");
}

// Keep /api/models as the stable browser endpoint, while the dedicated search
// engine owns retrieval and ranking. The current browser bundle still applies
// a literal client-side query filter and re-sorts `fit` by quality_score, so
// this adapter preserves backend relevance without a risky UI-bundle rewrite.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const requestUrl = new URL(context.request.url);
  const originalQuery = requestUrl.searchParams.get("q")?.trim() || "";
  const engineQuery = searchQueryForEngine(originalQuery);

  if (engineQuery && engineQuery !== originalQuery) requestUrl.searchParams.set("q", engineQuery);
  const searchContext = engineQuery !== originalQuery
    ? { ...context, request: new Request(requestUrl.toString(), { method: context.request.method, headers: context.request.headers }) }
    : context;

  const response = await searchRequest(searchContext);
  if (!response.ok) return response;

  const payload = await response.json() as Record<string, unknown>;
  const models = Array.isArray(payload.models) ? payload.models as Array<Record<string, unknown>> : [];

  payload.models = models.map((model) => ({
    ...model,
    // Live Hub discoveries do not have generated local detail pages. Point the
    // existing title link at a redirect route that lands on the real HF repo.
    slug: model.source === "hub-live" ? `hub/${String(model.id || "")}` : model.slug,
    // Keep the browser's legacy literal query filter from discarding ranked
    // semantic/resource matches. The original purpose remains intact first.
    purpose: originalQuery ? `${String(model.purpose || "General")} ${originalQuery}` : model.purpose,
    // Keep the server's relevance order when app.js applies its old fit sort.
    quality_score: originalQuery
      ? Number(model.search_score || 0) * 1_000_000 + Number(model.quality_score || 0)
      : Number(model.quality_score || 0)
  }));

  return json(payload);
};
