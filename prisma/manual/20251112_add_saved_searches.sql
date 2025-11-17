CREATE TABLE IF NOT EXISTS public.saved_searches (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    integer     NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name       text,
  seq        integer     NOT NULL,
  query      jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_searches
  ADD CONSTRAINT saved_searches_user_seq_uidx UNIQUE (user_id, seq);
