-- AlterTable
-- D1 では列の削除が RedefineTables (テーブル再作成) を誘発し、FK の cascade を
-- 巻き込んで行が消える事故につながるため、ここでは追加しかしない。
-- 追加する列は全て nullable か定数 DEFAULT 付きなので ADD COLUMN で足りる。
ALTER TABLE "episodes" ADD COLUMN "record_status" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "episodes" ADD COLUMN "record_source" TEXT;
ALTER TABLE "episodes" ADD COLUMN "record_job_id" TEXT;
ALTER TABLE "episodes" ADD COLUMN "recording_id" TEXT;
ALTER TABLE "episodes" ADD COLUMN "record_error" TEXT;
ALTER TABLE "episodes" ADD COLUMN "record_path" TEXT;
ALTER TABLE "episodes" ADD COLUMN "record_size_mb" INTEGER;
ALTER TABLE "episodes" ADD COLUMN "recorded_at" DATETIME;
ALTER TABLE "episodes" ADD COLUMN "record_synced_at" DATETIME;

-- Backfill
-- 既存の recorded は人が手で立てたフラグでしかない (台帳が無かった頃の名残)。
-- 台帳由来ではないので record_source は 'manual'、実体の照合は初回 bootstrap に任せる。
UPDATE "episodes" SET "record_status" = 'completed', "record_source" = 'manual' WHERE "recorded" = 1;

-- CreateIndex
CREATE INDEX "episodes_episode_id_idx" ON "episodes"("episode_id");

-- CreateIndex
CREATE INDEX "episodes_record_status_idx" ON "episodes"("record_status");

-- CreateIndex
CREATE INDEX "episodes_record_job_id_idx" ON "episodes"("record_job_id");

-- CreateIndex
CREATE INDEX "episodes_recording_id_idx" ON "episodes"("recording_id");

-- CreateTable
CREATE TABLE "sync_state" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "library_cursor" TEXT,
    "snapshot_cursor" TEXT,
    "snapshot_started_at" DATETIME,
    "last_succeeded_at" DATETIME,
    "lease_until" DATETIME,
    "lease_owner" TEXT,
    "updated_at" DATETIME NOT NULL
);
