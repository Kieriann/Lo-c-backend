DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkerStatus') THEN
    CREATE TYPE "WorkerStatus" AS ENUM ('indep','salarie');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Profile'
      AND column_name = 'workerStatus'
  ) THEN
    ALTER TABLE "Profile"
      ADD COLUMN "workerStatus" "WorkerStatus" NOT NULL DEFAULT 'indep';
  END IF;
END
$$;
