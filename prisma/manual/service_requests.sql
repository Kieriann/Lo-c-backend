-- ========== ENUMS ==========
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'servicerequeststatus') THEN
    CREATE TYPE "ServiceRequestStatus" AS ENUM ('DRAFT','OPEN','CLOSED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shortliststatus') THEN
    CREATE TYPE "ShortlistStatus" AS ENUM ('PENDING','CONTACTED','REJECTED');
  END IF;
END $$;

-- ========== TABLES ==========
CREATE TABLE IF NOT EXISTS "ServiceRequest" (
  "id"          SERIAL PRIMARY KEY,
  "ownerId"     INTEGER NOT NULL,
  "title"       TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL,
  "minRate"     INTEGER NOT NULL,
  "maxRate"     INTEGER NOT NULL,
  "deadline"    TIMESTAMP NULL,
  "status"      "ServiceRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "ServiceRequest_owner_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "ServiceRequestItem" (
  "id"                SERIAL PRIMARY KEY,
  "serviceRequestId"  INTEGER NOT NULL,
  "skillLabel"        TEXT NOT NULL,
  "level"             TEXT NOT NULL,
  CONSTRAINT "ServiceRequestItem_sr_fkey"
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "ServiceShortlist" (
  "id"                SERIAL PRIMARY KEY,
  "serviceRequestId"  INTEGER NOT NULL,
  "candidateId"       INTEGER NOT NULL,
  "status"            "ShortlistStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "ServiceShortlist_sr_fkey"
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE,
  CONSTRAINT "ServiceShortlist_user_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "ServiceShortlist_unique" UNIQUE ("serviceRequestId","candidateId")
);

-- ========== INDEXES ==========
CREATE INDEX IF NOT EXISTS "ServiceRequest_owner_idx"    ON "ServiceRequest" ("ownerId");
CREATE INDEX IF NOT EXISTS "ServiceShortlist_candidate_idx" ON "ServiceShortlist" ("candidateId");

-- ========== updatedAt trigger (idempotent) ==========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'set_updated_at' AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW."updatedAt" = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sr_set_updated_at') THEN
    CREATE TRIGGER trg_sr_set_updated_at
    BEFORE UPDATE ON "ServiceRequest"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
