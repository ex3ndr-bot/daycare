import type { AgentHistoryRecord, Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import type { DatabaseSessionHistoryRow } from "./databaseTypes.js";

/**
 * Loads history records across all sessions for one agent.
 * Expects: records are ordered by session creation and append id.
 */
export async function sessionHistoryDbLoadAll(
  config: Config,
  agentId: string
): Promise<AgentHistoryRecord[]> {
  const db = databaseOpenEnsured(config.dbPath);
  try {
    const rows = db
      .prepare(
        `
          SELECT h.*
          FROM session_history h
          INNER JOIN sessions s ON s.id = h.session_id
          WHERE s.agent_id = ?
          ORDER BY s.created_at ASC, h.id ASC
        `
      )
      .all(agentId) as DatabaseSessionHistoryRow[];

    return rows
      .map((row) => sessionHistoryRecordBuild(row))
      .filter((record): record is AgentHistoryRecord => record !== null);
  } finally {
    db.close();
  }
}

function sessionHistoryRecordBuild(row: DatabaseSessionHistoryRow): AgentHistoryRecord | null {
  try {
    const data = JSON.parse(row.data) as Record<string, unknown>;
    return {
      type: row.type as AgentHistoryRecord["type"],
      at: row.at,
      ...data
    } as AgentHistoryRecord;
  } catch {
    return null;
  }
}
