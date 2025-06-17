/*
  Warnings:

  - A unique constraint covering the columns `[emailConfirmationToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Prestation_userId_index";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailConfirmationToken" TEXT,
ADD COLUMN     "emailConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailConfirmationToken_key" ON "User"("emailConfirmationToken");
