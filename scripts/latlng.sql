ALTER TABLE public."City"    ADD COLUMN IF NOT EXISTS "lat" double precision;
ALTER TABLE public."City"    ADD COLUMN IF NOT EXISTS "lng" double precision;
ALTER TABLE public."Address" ADD COLUMN IF NOT EXISTS "lat" double precision;
ALTER TABLE public."Address" ADD COLUMN IF NOT EXISTS "lng" double precision;
