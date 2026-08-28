ALTER TABLE "User"
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "inactivity22WarningSentAt" TIMESTAMP(3),
ADD COLUMN "inactivity23WarningSentAt" TIMESTAMP(3);

UPDATE "User"
SET "lastLoginAt" = "firstLoginAt"
WHERE "firstLoginAt" IS NOT NULL;
