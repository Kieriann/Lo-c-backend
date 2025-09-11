DO $$
BEGIN
  -- Création de la table si elle n’existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ClientProfile'
      AND table_schema = 'public'
  ) THEN
    CREATE TABLE "ClientProfile" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER UNIQUE,
      "companyName" TEXT,
      "siret" TEXT,
      "sector" TEXT,
      "contactFirstName" TEXT,
      "contactLastName"  TEXT,
      "contactRole"      TEXT,
      "email" TEXT,
      "phone" TEXT,
      "addressStreet"     TEXT,
      "addressPostalCode" TEXT,
      "addressCity"       TEXT,
      "addressCountry"    TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;
END$$;

-- Colonnes manquantes
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "siret" TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "sector" TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "contactFirstName" TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "contactLastName"  TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "contactRole"      TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "addressStreet"     TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "addressPostalCode" TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "addressCity"       TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "addressCountry"    TEXT;
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "clientType" TEXT
  CHECK ("clientType" IN ('CLIENT_FINAL','ESN'));


-- Contrainte clé étrangère
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ClientProfile_userId_fkey'
  ) THEN
    ALTER TABLE "ClientProfile"
      ADD CONSTRAINT "ClientProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
