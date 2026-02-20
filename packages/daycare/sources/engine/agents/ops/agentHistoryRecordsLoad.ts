import type { Config } from "@/types";
import type { AgentHistoryRecord } from "./agentTypes.js";
import { sessionHistoryDbLoadAll } from "../../../storage/sessionHistoryDbLoadAll.js";

/**
 * Loads all persisted history records for one agent across sessions.
 * Expects: records are returned oldest-first by session then append order.
 */
export async function agentHistoryRecordsLoad(
  config: Config,
  agentId: string
): Promise<AgentHistoryRecord[]> {
  return sessionHistoryDbLoadAll(config, agentId);
}
