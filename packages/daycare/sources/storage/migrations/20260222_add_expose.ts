import type { Migration } from "./migrationTypes.js";

/**
 * Creates expose endpoints table.
 * Expects: users table exists for endpoint ownership.
 */
export const migration20260222AddExpose: Migration = {
    name: "20260222_add_expose",
    up(db): void {
        db.exec(`
      CREATE TABLE IF NOT EXISTS expose_endpoints (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        target TEXT NOT NULL,
        provider TEXT NOT NULL,
        domain TEXT NOT NULL,
        mode TEXT NOT NULL,
        auth TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_expose_endpoints_user
        ON expose_endpoints(user_id);
      CREATE INDEX IF NOT EXISTS idx_expose_endpoints_domain
        ON expose_endpoints(domain);
    `);
    }
};
