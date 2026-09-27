-- AlterTable
ALTER TABLE "anime" ADD COLUMN "tmdb_id" INTEGER;

-- CreateIndex
CREATE INDEX "anime_tmdb_id_idx" ON "anime"("tmdb_id");
