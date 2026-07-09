CREATE TABLE file_events (
  id BIGSERIAL PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES files (id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX file_events_file_id_idx ON file_events (file_id);
