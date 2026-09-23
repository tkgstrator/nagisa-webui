-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "parent_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    "duration_ms" INTEGER,
    "total" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "retried" INTEGER NOT NULL DEFAULT 0,
    "anime_created" INTEGER NOT NULL DEFAULT 0,
    "anime_updated" INTEGER NOT NULL DEFAULT 0,
    "dropped_logs" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "meta" TEXT
);


-- CreateIndex
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs"("started_at");

-- CreateIndex
CREATE INDEX "sync_runs_kind_started_at_idx" ON "sync_runs"("kind", "started_at");

-- CreateIndex
CREATE INDEX "sync_runs_parent_id_idx" ON "sync_runs"("parent_id");

