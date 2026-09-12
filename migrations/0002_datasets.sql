CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  author TEXT NOT NULL,
  hf_url TEXT NOT NULL,
  task TEXT NOT NULL,
  description TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  license TEXT NOT NULL,
  downloads INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  file_size_mb REAL,
  files_count INTEGER NOT NULL DEFAULT 0,
  docs_quality INTEGER NOT NULL DEFAULT 1,
  gated INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  quality_score REAL NOT NULL DEFAULT 0
);

ALTER TABLE models ADD COLUMN content_warning INTEGER NOT NULL DEFAULT 0;
ALTER TABLE models ADD COLUMN content_flags TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_datasets_downloads ON datasets(downloads DESC);
CREATE INDEX IF NOT EXISTS idx_datasets_updated_at ON datasets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_datasets_task ON datasets(task);
