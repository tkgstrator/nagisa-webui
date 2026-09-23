-- CreateTable
CREATE TABLE "recording_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anime_id" TEXT NOT NULL,
    "episode_id" TEXT,
    "provider" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "http_status" INTEGER,
    "episode_count" INTEGER,
    "error_message" TEXT,
    "run_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "recording_events_created_at_idx" ON "recording_events"("created_at");

-- CreateIndex
CREATE INDEX "recording_events_anime_id_idx" ON "recording_events"("anime_id");
