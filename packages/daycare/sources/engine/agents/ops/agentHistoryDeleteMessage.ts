import { promises as fs } from "node:fs";
import path from "node:path";

import type { Config } from "@/types";
import { agentPath } from "./agentPath.js";
import { agentHistoryRecordsLoad } from "./agentHistoryRecordsLoad.js";

/**
 * Removes a message from agent history by messageId.
 * Rewrites the history file excluding the matching user_message record.
 * Expects: messageId is a non-empty string.
 * Returns: true if a record was found and deleted, false otherwise.
 */
export async function agentHistoryDeleteMessage(
  config: Config,
  agentId: string,
  messageId: string
): Promise<boolean> {
  if (!messageId || messageId.trim().length === 0) {
    return false;
  }

  const records = await agentHistoryRecordsLoad(config, agentId);
  if (records.length === 0) {
    return false;
  }

  const originalLength = records.length;
  const filteredRecords = records.filter((record) => {
    if (record.type !== "user_message") {
      return true;
    }
    return record.messageId !== messageId;
  });

  if (filteredRecords.length === originalLength) {
    return false;
  }

  const basePath = agentPath(config, agentId);
  const filePath = path.join(basePath, "history.jsonl");

  const lines = filteredRecords.map((record) => JSON.stringify(record)).join("\n") + "\n";
  await fs.writeFile(filePath, lines, "utf8");

  return true;
}
