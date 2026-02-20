import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { createId } from "@paralleldrive/cuid2";

import { configResolve } from "../../../config/configResolve.js";
import { storageUpgrade } from "../../../storage/storageUpgrade.js";
import { sessionDbCreate } from "../../../storage/sessionDbCreate.js";
import { agentDescriptorWrite } from "./agentDescriptorWrite.js";
import { agentHistoryAppend } from "./agentHistoryAppend.js";
import { agentHistoryRecordsLoad } from "./agentHistoryRecordsLoad.js";
import { agentStateRead } from "./agentStateRead.js";
import { agentStateWrite } from "./agentStateWrite.js";

describe("agentHistoryRecordsLoad", () => {
  it("loads all records across sessions", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-history-records-"));
    const agentId = createId();
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      await storageUpgrade(config);

      await agentDescriptorWrite(config, agentId, {
        type: "cron",
        id: agentId,
        name: "records"
      });
      const state = await agentStateRead(config, agentId);
      if (!state) {
        throw new Error("State missing");
      }

      const sessionA = await sessionDbCreate(config, { agentId, createdAt: 1 });
      await agentStateWrite(config, agentId, { ...state, activeSessionId: sessionA });
      await agentHistoryAppend(config, agentId, {
        type: "rlm_start",
        at: 2,
        toolCallId: "tool-1",
        code: "echo('x')",
        preamble: "def echo(text: str) -> str: ..."
      });

      const sessionB = await sessionDbCreate(config, { agentId, createdAt: 3 });
      await agentStateWrite(config, agentId, { ...state, activeSessionId: sessionB, updatedAt: 3 });
      await agentHistoryAppend(config, agentId, {
        type: "rlm_complete",
        at: 4,
        toolCallId: "tool-1",
        output: "done",
        printOutput: ["hello"],
        toolCallCount: 1,
        isError: false
      });

      const loaded = await agentHistoryRecordsLoad(config, agentId);
      expect(loaded).toEqual([
        {
          type: "rlm_start",
          at: 2,
          toolCallId: "tool-1",
          code: "echo('x')",
          preamble: "def echo(text: str) -> str: ..."
        },
        {
          type: "rlm_complete",
          at: 4,
          toolCallId: "tool-1",
          output: "done",
          printOutput: ["hello"],
          toolCallCount: 1,
          isError: false
        }
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
