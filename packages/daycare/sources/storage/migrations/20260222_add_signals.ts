import type { Migration } from "./migrationTypes.js";

/**
 * Creates signals tables for events, subscriptions, and delayed schedules.
 * Expects: users table exists for ownership resolution.
 */
export const migration20260222AddSignals: Migration = {
    name: "20260222_add_signals",
    up(db): void {
        db.exec(`
      CREATE TABLE IF NOT EXISTS signals_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        data TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_signals_events_user
        ON signals_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_signals_events_type
        ON signals_events(type);
      CREATE INDEX IF NOT EXISTS idx_signals_events_created
        ON signals_events(created_at);

      CREATE TABLE IF NOT EXISTS signals_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        pattern TEXT NOT NULL,
        silent INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(user_id, agent_id, pattern)
      );

      CREATE INDEX IF NOT EXISTS idx_signals_subscriptions_user_agent
        ON signals_subscriptions(user_id, agent_id);

      CREATE TABLE IF NOT EXISTS signals_delayed (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        deliver_at INTEGER NOT NULL,
        source TEXT NOT NULL,
        data TEXT,
        repeat_key TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_signals_delayed_deliver
        ON signals_delayed(deliver_at);
    `);
    }
};
