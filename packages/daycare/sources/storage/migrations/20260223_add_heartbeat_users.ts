import type { Migration } from "./migrationTypes.js";

/**
 * Adds user ownership to heartbeat tasks and backfills existing rows.
 * Expects: users and tasks_heartbeat tables already exist.
 */
export const migration20260223AddHeartbeatUsers: Migration = {
    name: "20260223_add_heartbeat_users",
    up(db): void {
        const columns = db.prepare("PRAGMA table_info(tasks_heartbeat)").all() as Array<{ name: string }>;
        if (columns.length === 0) {
            return;
        }

        const hasUserId = columns.some((column) => column.name === "user_id");
        if (!hasUserId) {
            db.exec("ALTER TABLE tasks_heartbeat ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
        }

        const ownerRow = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as
            | { id?: unknown }
            | undefined;
        const ownerUserId = typeof ownerRow?.id === "string" ? ownerRow.id.trim() : "";
        const pendingBackfillRow = db
            .prepare("SELECT COUNT(1) AS count FROM tasks_heartbeat WHERE user_id IS NULL OR TRIM(user_id) = ''")
            .get() as { count?: number | bigint } | undefined;
        const pendingBackfill = Number(pendingBackfillRow?.count ?? 0);
        if (pendingBackfill > 0 && !ownerUserId) {
            throw new Error("No owner user found for heartbeat user backfill.");
        }
        if (ownerUserId) {
            db.prepare("UPDATE tasks_heartbeat SET user_id = ? WHERE user_id IS NULL OR TRIM(user_id) = ''").run(
                ownerUserId
            );
        }

        db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_heartbeat_user_id ON tasks_heartbeat(user_id)");
    }
};
