CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploaded', 'scanning', 'processing', 'ready', 'quarantined', 'failed')),
  original_filename TEXT NOT NULL,
  declared_mime_type TEXT,
  size_bytes BIGINT,
  staging_key TEXT NOT NULL,
  storage_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
