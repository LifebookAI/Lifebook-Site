-- Catalog schema stub (v2.3)
BEGIN;

CREATE TABLE IF NOT EXISTS catalog_items (
  pk TEXT NOT NULL,
  sk TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pk, sk)
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_type ON catalog_items(type);

COMMIT;
