-- 生ログは Workers Logs (Telemetry API) から引くようになったので D1 には持たない。
-- DropTable
DROP TABLE "log_entries";

-- AlterTable
ALTER TABLE "sync_runs" DROP COLUMN "dropped_logs";
