CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  author TEXT NOT NULL,
  hf_url TEXT NOT NULL,
  type TEXT NOT NULL,
  base_family TEXT NOT NULL,
  base_model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  description TEXT NOT NULL,
  best_for TEXT NOT NULL,
  license TEXT NOT NULL,
  commercial_use INTEGER NOT NULL DEFAULT 0,
  lora_rank INTEGER,
  file_size_mb REAL,
  downloads INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  rating REAL,
  review_count INTEGER NOT NULL DEFAULT 0,
  docs_quality INTEGER NOT NULL DEFAULT 1,
  safetensors INTEGER NOT NULL DEFAULT 0,
  compatibility_summary TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  quality_score REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  overall INTEGER NOT NULL CHECK (overall BETWEEN 1 AND 5),
  output_quality INTEGER NOT NULL CHECK (output_quality BETWEEN 1 AND 5),
  matches_description INTEGER NOT NULL CHECK (matches_description BETWEEN 1 AND 5),
  ease_of_use INTEGER NOT NULL CHECK (ease_of_use BETWEEN 1 AND 5),
  documentation INTEGER NOT NULL CHECK (documentation BETWEEN 1 AND 5),
  base_model TEXT,
  runtime TEXT,
  quantization TEXT,
  lora_strength REAL,
  hardware TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(model_id, user_id)
);

CREATE TABLE IF NOT EXISTS compatibility_votes (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('works', 'doesnt_work')),
  created_at TEXT NOT NULL,
  UNIQUE(model_id, user_id, target)
);

CREATE INDEX IF NOT EXISTS idx_models_quality ON models(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_models_base_family ON models(base_family);
CREATE INDEX IF NOT EXISTS idx_models_type ON models(type);
CREATE INDEX IF NOT EXISTS idx_models_purpose ON models(purpose);
CREATE INDEX IF NOT EXISTS idx_models_updated_at ON models(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_model ON reviews(model_id);
CREATE INDEX IF NOT EXISTS idx_votes_model_target ON compatibility_votes(model_id, target);

INSERT OR IGNORE INTO models
  (id, slug, name, author, hf_url, type, base_family, base_model, purpose, description, best_for, license, commercial_use, lora_rank, file_size_mb, downloads, likes, rating, review_count, docs_quality, safetensors, compatibility_summary, updated_at, quality_score)
VALUES
  ('demo/qwen3-japanese-coding', 'qwen3-japanese-coding', 'Qwen3 Japanese Coding', 'demo-lab', 'https://huggingface.co/models?search=Qwen3%20Japanese%20Coding', 'LLM', 'Qwen', 'Qwen3-8B', 'Coding, Japanese', '日本語でのコード説明と実装相談に寄せた、軽量な開発者向けアダプター。', '日本語で仕様を詰めながら実装する', 'Apache-2.0', 1, 16, 168, 18200, 360, 4.7, 12, 3, 1, '[{"target":"Qwen3-8B","works":48,"doesnt_work":0},{"target":"Qwen3-8B-Q4_K_M","works":21,"doesnt_work":0},{"target":"llama.cpp","works":35,"doesnt_work":1},{"target":"Transformers","works":42,"doesnt_work":0}]', '2026-09-06', 91.4),
  ('demo/llama3-jp-reasoning', 'llama3-jp-reasoning', 'Llama 3 Japanese Reasoning', 'community-research', 'https://huggingface.co/models?search=Llama%203%20Japanese%20Reasoning', 'LLM', 'Llama', 'Llama-3.1-8B', 'Japanese, Reasoning', '日本語の推論タスクで、回答の段階分けを安定させるためのアダプター。', '日本語の分析メモと長めの回答', 'CC-BY-4.0', 0, 32, 96, 9400, 188, 4.4, 8, 4, 1, '[{"target":"Llama-3.1-8B","works":33,"doesnt_work":2},{"target":"Transformers","works":28,"doesnt_work":0},{"target":"Ollama","works":14,"doesnt_work":1}]', '2026-08-31', 78.2),
  ('demo/gemma-roleplay-ja', 'gemma-roleplay-ja', 'Gemma Japanese Character', 'paper-crane', 'https://huggingface.co/models?search=Gemma%20Japanese%20Character', 'LLM', 'Gemma', 'Gemma-3-12B', 'Japanese, Roleplay, Character', '会話の口調とキャラクター設定を、プロンプトだけより一貫させる実験用モデル。', 'キャラクター会話の試作', 'MIT', 1, 32, 112, 6300, 204, 4.3, 17, 3, 1, '[{"target":"Gemma-3-12B","works":29,"doesnt_work":3},{"target":"Transformers","works":31,"doesnt_work":0}]', '2026-09-03', 74.8),
  ('demo/flux-ink-line', 'flux-ink-line', 'FLUX Ink Line', 'studio-kumo', 'https://huggingface.co/models?search=FLUX%20Ink%20Line', 'Image', 'FLUX', 'FLUX.1-dev', 'Style, Character', 'インクの線と余白の出方を寄せる画像向け LoRA。作例とトリガー語を README に整理。', '線画寄りのキャラクター作例', 'OpenRAIL++', 0, 16, 144, 22100, 512, 4.8, 26, 5, 1, '[{"target":"FLUX.1-dev","works":55,"doesnt_work":2},{"target":"ComfyUI","works":48,"doesnt_work":1},{"target":"Diffusers","works":36,"doesnt_work":0}]', '2026-09-08', 93.1),
  ('demo/wan-motion-soft', 'wan-motion-soft', 'Wan Motion Soft', 'motion-field', 'https://huggingface.co/models?search=Wan%20Motion%20Soft', 'Video', 'Wan', 'Wan2.1-T2V-14B', 'Motion, Style', '動きの強さを抑えた短い動画向けアダプター。低強度から試すと表情とカメラの破綻を確認しやすい。', '穏やかなカメラワークの動画', 'Apache-2.0', 1, 64, 768, 11700, 244, 4.2, 9, 2, 1, '[{"target":"Wan2.1-T2V-14B","works":18,"doesnt_work":4},{"target":"ComfyUI","works":16,"doesnt_work":2}]', '2026-08-29', 71.6),
  ('demo/ltx-motion-detail', 'ltx-motion-detail', 'LTX Motion Detail', 'frame-lab', 'https://huggingface.co/models?search=LTX%20Motion%20Detail', 'Video', 'LTX', 'LTX-Video', 'Motion, Character', '動きの細部と衣服の揺れを補う動画用 LoRA。強度を上げすぎると背景にも影響する。', '人物中心の短尺モーション', 'Apache-2.0', 1, 48, 512, 4900, 118, 4.1, 6, 3, 1, '[{"target":"LTX-Video","works":14,"doesnt_work":3},{"target":"Diffusers","works":9,"doesnt_work":2}]', '2026-09-01', 64.5),
  ('demo/sdxl-anime-character', 'sdxl-anime-character', 'SDXL Anime Character', 'night-atelier', 'https://huggingface.co/models?search=SDXL%20Anime%20Character', 'Image', 'Other', 'SDXL 1.0', 'Character, Style', 'キャラクターの輪郭と目の表現を調整する定番寄りの画像 LoRA。', 'アニメ調キャラクターの安定化', 'CreativeML Open RAIL++', 0, 32, 224, 39100, 890, 4.6, 44, 4, 1, '[{"target":"SDXL 1.0","works":64,"doesnt_work":3},{"target":"ComfyUI","works":58,"doesnt_work":2},{"target":"A1111","works":51,"doesnt_work":1}]', '2026-09-07', 89.7),
  ('demo/music-texture-v1', 'music-texture-v1', 'Music Texture v1', 'audio-notebook', 'https://huggingface.co/models?search=Music%20Texture%20LoRA', 'Audio', 'Other', 'Stable Audio Open', 'Style, Motion', '音の質感とループの雰囲気を変えるオーディオ向けアダプター。', '短いループの方向性を探す', 'MIT', 1, 24, 88, 2600, 72, 4.0, 5, 2, 1, '[{"target":"Stable Audio Open","works":7,"doesnt_work":2},{"target":"Diffusers","works":6,"doesnt_work":1}]', '2026-08-26', 58.9);
