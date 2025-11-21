CREATE TABLE IF NOT EXISTS "SavedSearch" (
  "id"        SERIAL PRIMARY KEY,
  "userId"    INTEGER    NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name"      TEXT       NOT NULL,
  "seq"       INTEGER    NOT NULL,
  "query"     JSONB      NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "SavedSearch_userId_seq_key"
  ON "SavedSearch"("userId","seq");
