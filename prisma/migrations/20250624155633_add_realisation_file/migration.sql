/*
  Warnings:

  - You are about to drop the column `fileName` on the `Realisation` table. All the data in the column will be lost.
  - You are about to drop the column `originalName` on the `Realisation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Realisation" DROP COLUMN "fileName",
DROP COLUMN "originalName";

-- CreateTable
CREATE TABLE "RealisationFile" (
    "id" SERIAL NOT NULL,
    "realisationId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "format" TEXT NOT NULL,

    CONSTRAINT "RealisationFile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RealisationFile" ADD CONSTRAINT "RealisationFile_realisationId_fkey" FOREIGN KEY ("realisationId") REFERENCES "Realisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
