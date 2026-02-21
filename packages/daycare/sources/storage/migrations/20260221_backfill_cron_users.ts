import type { Migration } from "./migrationTypes.js";

/**
 * Backfills missing cron task user ownership with the owner user.
 * Expects: users and tasks_cron tables already exist.
 */
export const migration20260221BackfillCronUsers: Migration = {
    name: "20260221_backfill_cron_users",
    up(db): void {
        const ownerRow = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as
            | { id?: unknown }
            | undefined;
        const ownerUserId = typeof ownerRow?.id === "string" ? ownerRow.id.trim() : "";
        if (!ownerUserId) {
            return;
        }

        db.prepare("UPDATE tasks_cron SET user_id = ? WHERE user_id IS NULL OR TRIM(user_id) = ''").run(ownerUserId);
    }
};
