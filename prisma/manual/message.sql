-- prisma/sql/message.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Message'
  ) THEN
    CREATE TABLE "Message" (
      "id"         SERIAL PRIMARY KEY,
      "senderId"   INTEGER NOT NULL,
      "receiverId" INTEGER NOT NULL,
      "content"    TEXT    NOT NULL,
      "isRead"     BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;
END$$;

-- Colonnes (idempotent)
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "senderId"   INTEGER NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "receiverId" INTEGER NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "content"    TEXT    NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isRead"     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- FKs (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_senderId_fkey') THEN
    ALTER TABLE "Message"
      ADD CONSTRAINT "Message_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_receiverId_fkey') THEN
    ALTER TABLE "Message"
      ADD CONSTRAINT "Message_receiverId_fkey"
      FOREIGN KEY ("receiverId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Index (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_message_sender_created') THEN
    CREATE INDEX "idx_message_sender_created" ON "Message" ("senderId","createdAt");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_message_receiver_created') THEN
    CREATE INDEX "idx_message_receiver_created" ON "Message" ("receiverId","createdAt");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_message_pair_created') THEN
    CREATE INDEX "idx_message_pair_created" ON "Message" ("senderId","receiverId","createdAt");
  END IF;
END$$;
