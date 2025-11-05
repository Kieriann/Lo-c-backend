ALTER TABLE "Thread" ADD COLUMN IF NOT EXISTS "group" TEXT;
UPDATE "Thread" SET "group" = 'general' WHERE "group" IS NULL;
ALTER TABLE "Thread" ALTER COLUMN "group" SET DEFAULT 'general';
