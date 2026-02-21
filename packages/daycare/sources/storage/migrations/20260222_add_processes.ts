import type { Migration } from "./migrationTypes.js";

/**
 * Creates processes table for durable runtime records.
 * Expects: users table exists for process ownership.
 */
export const migration20260222AddProcesses: Migration = {
    name: "20260222_add_processes",
    up(db): void {
        db.exec(`
      CREATE TABLE IF NOT EXISTS processes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        cwd TEXT NOT NULL,
        home TEXT,
        env TEXT NOT NULL,
        package_managers TEXT NOT NULL,
        allowed_domains TEXT NOT NULL,
        allow_local_binding INTEGER NOT NULL DEFAULT 0,
        permissions TEXT NOT NULL,
        owner TEXT,
        keep_alive INTEGER NOT NULL DEFAULT 0,
        desired_state TEXT NOT NULL DEFAULT 'running',
        status TEXT NOT NULL DEFAULT 'running',
        pid INTEGER,
        boot_time_ms INTEGER,
        restart_count INTEGER NOT NULL DEFAULT 0,
        restart_failure_count INTEGER NOT NULL DEFAULT 0,
        next_restart_at INTEGER,
        settings_path TEXT NOT NULL,
        log_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_started_at INTEGER,
        last_exited_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_processes_user
        ON processes(user_id);
      CREATE INDEX IF NOT EXISTS idx_processes_owner
        ON processes(owner);
    `);
    }
};
