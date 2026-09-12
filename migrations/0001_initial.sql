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
