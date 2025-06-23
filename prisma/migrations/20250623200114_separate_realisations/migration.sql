/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `realDescription` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `realFilePath` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `realTitle` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Experience` table. All the data in the column will be lost.
  - The `languages` column on the `Experience` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `client` on table `Experience` required. This step will fail if there are existing NULL values in that column.
  - Made the column `domains` on table `Experience` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Experience" DROP COLUMN "createdAt",
DROP COLUMN "realDescription",
DROP COLUMN "realFilePath",
DROP COLUMN "realTitle",
DROP COLUMN "updatedAt",
ALTER COLUMN "client" SET NOT NULL,
ALTER COLUMN "domains" SET NOT NULL,
ALTER COLUMN "skills" SET DATA TYPE TEXT,
DROP COLUMN "languages",
ADD COLUMN     "languages" TEXT[];

-- CreateTable
CREATE TABLE "Realisation" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "techs" TEXT[],
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Realisation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Realisation" ADD CONSTRAINT "Realisation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
