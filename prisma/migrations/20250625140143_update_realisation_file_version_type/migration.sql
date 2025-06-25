/*
  Warnings:

  - You are about to drop the column `public_id` on the `RealisationFile` table. All the data in the column will be lost.
  - The `version` column on the `RealisationFile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `publicId` to the `RealisationFile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RealisationFile" DROP COLUMN "publicId",
ADD COLUMN     "publicId" TEXT NOT NULL,
DROP COLUMN "version",
ADD COLUMN     "version" INTEGER;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "version" INTEGER;
