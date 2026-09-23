-- CreateTable
CREATE TABLE "log_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "run_id" TEXT,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT,
    "summary" TEXT,
    "props" TEXT
);

-- CreateIndex
CREATE INDEX "log_entries_ts_idx" ON "log_entries"("ts");

-- CreateIndex
CREATE INDEX "log_entries_run_id_idx" ON "log_entries"("run_id");

-- CreateIndex
CREATE INDEX "log_entries_level_ts_idx" ON "log_entries"("level", "ts");
