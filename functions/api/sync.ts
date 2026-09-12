import { getAuthUser, json, type Env } from "../_auth";

interface HubModel {
  id?: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  tags?: string[];
  pipeline_tag?: string;
  library_name?: string;
  cardData?: { license?: string; base_model?: string; base_model_relation?: string };
  siblings?: Array<{ rfilename?: string }>;
}

const familyFrom = (base: string, id: string) => {
  const value = `${base} ${id}`.toLowerCase();
  if (value.includes("qwen")) return "Qwen";
  if (value.includes("llama")) return "Llama";
  if (value.includes("gemma")) return "Gemma";
  if (value.includes("flux")) return "FLUX";
  if (value.includes("wan")) return "Wan";
  if (value.includes("ltx")) return "LTX";
  return "Other";
};

const typeFrom = (model: HubModel) => {
  const value = `${model.pipeline_tag || ""} ${(model.tags || []).join(" ")} ${model.library_name || ""}`.toLowerCase();
  if (value.includes("video") || value.includes("wan")) return "Video";
  if (value.includes("audio") || value.includes("music")) return "Audio";
  if (value.includes("diffusers") || value.includes("image")) return "Image";
  return "LLM";
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const userId = await getAuthUser(request, env);
  if (!userId) return json({ error: "Sign in is required to run a sync." }, 401);
  if (!env.HF_TOKEN) return json({ error: "HF_TOKEN is not configured for this deployment." }, 503);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const query = String(body.query || "lora").slice(0, 80);
  const response = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(query)}&limit=40&sort=downloads&direction=-1&full=true`, { headers: { Authorization: `Bearer ${env.HF_TOKEN}`, Accept: "application/json" } });
  if (!response.ok) return json({ error: "Hugging Face did not return a model list." }, 502);
  const models = await response.json() as HubModel[];
  const candidates = models.filter((model) => model.id && ((model.tags || []).some((tag) => /lora|adapter|peft/i.test(tag)) || /lora|adapter/i.test(model.id || "")));
  const statements = candidates.map((model) => {
    const id = String(model.id);
    const base = String(model.cardData?.base_model || "Unknown base");
    const file = (model.siblings || []).find((item) => /\.safetensors$/i.test(item.rfilename || ""));
    const type = typeFrom(model);
    const purpose = type === "LLM" ? "Reasoning" : type === "Video" ? "Motion" : "Style";
    return env.DB.prepare(`INSERT INTO models (id, slug, name, author, hf_url, type, base_family, base_model, purpose, description, best_for, license, commercial_use, lora_rank, file_size_mb, downloads, likes, rating, review_count, docs_quality, safetensors, compatibility_summary, updated_at, quality_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, 0, 1, ?, '[]', ?, ?) ON CONFLICT(id) DO UPDATE SET downloads=excluded.downloads, likes=excluded.likes, updated_at=excluded.updated_at, safetensors=excluded.safetensors, license=excluded.license, base_model=excluded.base_model, type=excluded.type, base_family=excluded.base_family`).bind(id, id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), id.split("/").pop() || id, id.split("/")[0] || "unknown", `https://huggingface.co/${id}`, type, familyFrom(base, id), base, purpose, "Hubから同期されたLoRA。READMEと実使用レビューで内容を補完できます。", `${type} の試作と比較`, model.cardData?.license || "Unknown", 0, Number(model.downloads || 0), Number(model.likes || 0), file ? 1 : 0, model.lastModified || new Date().toISOString(), Number(model.downloads || 0) / 1000);
  });
  for (let index = 0; index < statements.length; index += 50) await env.DB.batch(statements.slice(index, index + 50));
  return json({ ok: true, query, synced: candidates.length });
};
