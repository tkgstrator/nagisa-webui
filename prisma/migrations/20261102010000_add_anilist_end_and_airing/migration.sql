-- AlterTable
ALTER TABLE "anilist_media" ADD COLUMN "end_day" INTEGER;
ALTER TABLE "anilist_media" ADD COLUMN "end_month" INTEGER;
ALTER TABLE "anilist_media" ADD COLUMN "end_year" INTEGER;
ALTER TABLE "anilist_media" ADD COLUMN "episodes" INTEGER;
ALTER TABLE "anilist_media" ADD COLUMN "next_airing_at" DATETIME;
ALTER TABLE "anilist_media" ADD COLUMN "next_airing_episode" INTEGER;

