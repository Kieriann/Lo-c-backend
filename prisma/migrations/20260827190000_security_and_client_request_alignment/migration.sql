ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailConfirmationExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "User_passwordResetTokenHash_key"
  ON "User"("passwordResetTokenHash");

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "deliveryType" TEXT NOT NULL DEFAULT 'upload';

ALTER TABLE "RealisationFile"
  ADD COLUMN IF NOT EXISTS "deliveryType" TEXT NOT NULL DEFAULT 'upload';

ALTER TABLE "Profile"
  ALTER COLUMN "email" TYPE TEXT;

ALTER TABLE "SavedSearch"
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3);

ALTER TABLE "SavedSearch"
  DROP CONSTRAINT IF EXISTS "SavedSearch_userId_fkey";

ALTER TABLE "SavedSearch"
  ADD CONSTRAINT "SavedSearch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "RequestKind" ADD VALUE IF NOT EXISTS 'ALTERNANCE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientRequestStatus') THEN
    CREATE TYPE "ClientRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');
  END IF;
END $$;

ALTER TABLE "ClientRequest"
  ADD COLUMN IF NOT EXISTS "expertiseObjective" TEXT,
  ADD COLUMN IF NOT EXISTS "expertiseDuration" TEXT,
  ADD COLUMN IF NOT EXISTS "prehireJobTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "prehireContractType" TEXT,
  ADD COLUMN IF NOT EXISTS "prehireTrialPeriod" TEXT,
  ADD COLUMN IF NOT EXISTS "prehireCompensation" INTEGER,
  ADD COLUMN IF NOT EXISTS "alternanceJobTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "alternanceDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "alternanceRemuMode" TEXT,
  ADD COLUMN IF NOT EXISTS "alternanceRemuAmount" INTEGER,
  ADD COLUMN IF NOT EXISTS "skillsWeight" INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "teleworkWeight" INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "availabilityWeight" INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "status" "ClientRequestStatus" NOT NULL DEFAULT 'PENDING';
