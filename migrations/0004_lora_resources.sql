CREATE TABLE IF NOT EXISTS lora_resources (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  filename TEXT NOT NULL,
  source_url TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'safetensors',
  size_mb REAL,
  sha256 TEXT,
  base_model TEXT NOT NULL DEFAULT 'Unknown base',
  base_family TEXT NOT NULL DEFAULT 'Other',
  trigger_words TEXT NOT NULL DEFAULT '[]',
  recommended_weight_min REAL,
  recommended_weight_max REAL,
  lora_rank INTEGER,
  alpha REAL,
  target_modules TEXT NOT NULL DEFAULT '[]',
  network_type TEXT,
  has_examples INTEGER NOT NULL DEFAULT 0,
  metadata_confidence REAL NOT NULL DEFAULT 0,
  enriched_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(model_id, path)
);

CREATE INDEX IF NOT EXISTS idx_resources_model ON lora_resources(model_id);
CREATE INDEX IF NOT EXISTS idx_resources_filename ON lora_resources(filename);
CREATE INDEX IF NOT EXISTS idx_resources_base_model ON lora_resources(base_model);
CREATE INDEX IF NOT EXISTS idx_resources_base_family ON lora_resources(base_family);
CREATE INDEX IF NOT EXISTS idx_resources_rank ON lora_resources(lora_rank);
CREATE INDEX IF NOT EXISTS idx_resources_sha256 ON lora_resources(sha256);
CREATE INDEX IF NOT EXISTS idx_resources_updated ON lora_resources(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_confidence ON lora_resources(metadata_confidence DESC);
