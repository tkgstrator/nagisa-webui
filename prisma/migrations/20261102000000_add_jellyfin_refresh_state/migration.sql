-- CreateTable
CREATE TABLE "jellyfin_refresh_state" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "dirty_generation" INTEGER NOT NULL DEFAULT 0,
    "dirty_since" DATETIME,
    "last_change_at" DATETIME,
    "last_attempt_at" DATETIME,
    "last_succeeded_at" DATETIME,
    "next_attempt_at" DATETIME,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "last_notified_at" DATETIME,
    "lease_until" DATETIME,
    "lease_owner" TEXT,
    "updated_at" DATETIME NOT NULL
);
