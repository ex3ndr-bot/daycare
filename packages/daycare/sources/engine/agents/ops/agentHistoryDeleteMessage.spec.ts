import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import type { Config } from "@/types";
import { agentHistoryDeleteMessage } from "./agentHistoryDeleteMessage.js";
import { agentHistoryAppend } from "./agentHistoryAppend.js";
import { agentHistoryRecordsLoad } from "./agentHistoryRecordsLoad.js";
import type { AgentHistoryRecord } from "./agentTypes.js";

describe("agentHistoryDeleteMessage", () => {
  let tempDir: string;
  let config: Config;
  const agentId = "test-agent";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-history-delete-"));
    config = {
      agentsDir: tempDir
    } as Config;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const buildRecord = <T extends AgentHistoryRecord>(record: T): T => record;

  it("should delete a user_message by messageId", async () => {
    await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 2, text: "first", files: [], messageId: "msg-1" })
    );
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 3, text: "second", files: [], messageId: "msg-2" })
    );

    const deleted = await agentHistoryDeleteMessage(config, agentId, "msg-1");
    expect(deleted).toBe(true);

    const records = await agentHistoryRecordsLoad(config, agentId);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ type: "start", at: 1 });
    expect(records[1]).toEqual({ type: "user_message", at: 3, text: "second", files: [], messageId: "msg-2" });
  });

  it("should return false if messageId not found", async () => {
    await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 2, text: "hello", files: [], messageId: "msg-1" })
    );

    const deleted = await agentHistoryDeleteMessage(config, agentId, "nonexistent");
    expect(deleted).toBe(false);

    const records = await agentHistoryRecordsLoad(config, agentId);
    expect(records).toHaveLength(2);
  });

  it("should return false for empty messageId", async () => {
    await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));

    const deleted = await agentHistoryDeleteMessage(config, agentId, "");
    expect(deleted).toBe(false);
  });

  it("should return false if history is empty", async () => {
    const deleted = await agentHistoryDeleteMessage(config, agentId, "msg-1");
    expect(deleted).toBe(false);
  });

  it("should not delete records without messageId", async () => {
    await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 2, text: "no id", files: [] })
    );

    const deleted = await agentHistoryDeleteMessage(config, agentId, "msg-1");
    expect(deleted).toBe(false);

    const records = await agentHistoryRecordsLoad(config, agentId);
    expect(records).toHaveLength(2);
  });

  it("should preserve non-user_message records", async () => {
    await agentHistoryAppend(config, agentId, buildRecord({ type: "start", at: 1 }));
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({ type: "user_message", at: 2, text: "user msg", files: [], messageId: "msg-1" })
    );
    await agentHistoryAppend(
      config,
      agentId,
      buildRecord({
        type: "assistant_message",
        at: 3,
        text: "response",
        files: [],
        toolCalls: [],
        tokens: null
      })
    );
    await agentHistoryAppend(config, agentId, buildRecord({ type: "note", at: 4, text: "a note" }));

    const deleted = await agentHistoryDeleteMessage(config, agentId, "msg-1");
    expect(deleted).toBe(true);

    const records = await agentHistoryRecordsLoad(config, agentId);
    expect(records).toHaveLength(3);
    expect(records[0]).toEqual({ type: "start", at: 1 });
    expect(records[1].type).toBe("assistant_message");
    expect(records[2]).toEqual({ type: "note", at: 4, text: "a note" });
  });
});
