import type { Migration } from "./migrationTypes.js";

/**
 * Creates channels tables with members and message history.
 * Expects: users table exists for channel ownership.
 */
export const migration20260222AddChannels: Migration = {
    name: "20260222_add_channels",
    up(db): void {
        db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL UNIQUE,
        leader TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_channels_user
        ON channels(user_id);
      CREATE INDEX IF NOT EXISTS idx_channels_name
        ON channels(name);

      CREATE TABLE IF NOT EXISTS channel_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        username TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        UNIQUE(channel_id, agent_id)
      );

      CREATE INDEX IF NOT EXISTS idx_channel_members_channel
        ON channel_members(channel_id);

      CREATE TABLE IF NOT EXISTS channel_messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        sender_username TEXT NOT NULL,
        text TEXT NOT NULL,
        mentions TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_created
        ON channel_messages(channel_id, created_at);
    `);
    }
};
