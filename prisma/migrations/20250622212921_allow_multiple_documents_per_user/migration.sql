/*
  Warnings:

  - A unique constraint covering the columns `[userId,type]` on the table `Document` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Document_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Document_userId_type_key" ON "Document"("userId", "type");
