CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  seq INTEGER NOT NULL,
  query JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_user_seq_uidx ON saved_searches(user_id, seq);
CREATE INDEX IF NOT EXISTS saved_searches_user_created_idx ON saved_searches(user_id, created_at DESC);
