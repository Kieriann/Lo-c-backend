DO $$ BEGIN
  -- City.lat
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='City' AND column_name='lat'
  ) THEN
    ALTER TABLE "City" ADD COLUMN "lat" double precision;
  END IF;

  -- City.lng
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='City' AND column_name='lng'
  ) THEN
    ALTER TABLE "City" ADD COLUMN "lng" double precision;
  END IF;
END $$;
