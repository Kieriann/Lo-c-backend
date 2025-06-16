-- CreateTable for Prestation
CREATE TABLE "Prestation" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "tech" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Prestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for Prestation
CREATE INDEX "Prestation_userId_index" ON "Prestation"("userId");

-- AddForeignKey for Prestation
ALTER TABLE "Prestation"
  ADD CONSTRAINT "Prestation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
