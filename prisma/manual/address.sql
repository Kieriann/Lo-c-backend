DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='Address' AND column_name='lat'
  ) THEN
    ALTER TABLE "Address" ADD COLUMN "lat" double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='Address' AND column_name='lng'
  ) THEN
    ALTER TABLE "Address" ADD COLUMN "lng" double precision;
  END IF;
END $$;
