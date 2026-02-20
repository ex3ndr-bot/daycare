import type { Migration } from "./migrationTypes.js";

export const migration20260220AddUsers: Migration = {
  name: "20260220_add_users",
  up(db): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        is_owner INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_connector_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        connector_key TEXT NOT NULL UNIQUE
      );

      CREATE INDEX IF NOT EXISTS idx_user_connector_keys_user_id
        ON user_connector_keys(user_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_owner
        ON users(is_owner)
        WHERE is_owner = 1;
    `);
  }
};
