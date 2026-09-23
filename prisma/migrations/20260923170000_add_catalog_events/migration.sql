-- CreateTable
CREATE TABLE "catalog_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anime_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "season_number" INTEGER,
    "episode_count" INTEGER,
    "episodes" TEXT,
    "fields" TEXT,
    "run_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "catalog_events_created_at_idx" ON "catalog_events"("created_at");

-- CreateIndex
CREATE INDEX "catalog_events_anime_id_idx" ON "catalog_events"("anime_id");
