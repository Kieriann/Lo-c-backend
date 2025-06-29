-- DropForeignKey
ALTER TABLE "RealisationFile" DROP CONSTRAINT "RealisationFile_realisationId_fkey";

-- DropForeignKey
ALTER TABLE "Techno" DROP CONSTRAINT "Techno_realisationId_fkey";

-- AddForeignKey
ALTER TABLE "RealisationFile" ADD CONSTRAINT "RealisationFile_realisationId_fkey" FOREIGN KEY ("realisationId") REFERENCES "Realisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Techno" ADD CONSTRAINT "Techno_realisationId_fkey" FOREIGN KEY ("realisationId") REFERENCES "Realisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
