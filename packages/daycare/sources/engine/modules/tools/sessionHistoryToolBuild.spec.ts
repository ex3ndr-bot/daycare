import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import { agentDescriptorWrite } from "../../agents/ops/agentDescriptorWrite.js";
import { agentHistoryAppend } from "../../agents/ops/agentHistoryAppend.js";
import { sessionHistoryToolBuild } from "./sessionHistoryToolBuild.js";

const toolCall = { id: "tool-1", name: "read_session_history" };

describe("sessionHistoryToolBuild", () => {
  it("returns summary output by default", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-session-history-tool-"));
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      const currentAgentId = createId();
      const targetSessionId = createId();
      await agentDescriptorWrite(config, targetSessionId, {
        type: "subagent",
        id: targetSessionId,
        parentAgentId: currentAgentId,
        name: "worker"
      });
      await agentHistoryAppend(config, targetSessionId, { type: "start", at: 10 });
      await agentHistoryAppend(config, targetSessionId, {
        type: "user_message",
        at: 20,
        text: "check logs",
        files: []
      });

      const tool = sessionHistoryToolBuild();
      const context = buildContext(currentAgentId, config);
      const result = await tool.execute({ sessionId: targetSessionId }, context, toolCall);

      const text = contentText(result.toolMessage.content);
      expect(result.toolMessage.isError).toBe(false);
      expect(text).toContain("summary:");
      expect(text).toContain("records: 1");
      expect(text).not.toContain("full history");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns raw history when summarized is false", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-session-history-tool-"));
    try {
      const config = configResolve(
        { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      const currentAgentId = createId();
      const targetSessionId = createId();
      await agentDescriptorWrite(config, targetSessionId, {
        type: "subagent",
        id: targetSessionId,
        parentAgentId: currentAgentId,
        name: "worker"
      });
      await agentHistoryAppend(config, targetSessionId, { type: "start", at: 10 });
      await agentHistoryAppend(config, targetSessionId, {
        type: "note",
        at: 30,
        text: "done"
      });

      const tool = sessionHistoryToolBuild();
      const context = buildContext(currentAgentId, config);
      const result = await tool.execute(
        { sessionId: targetSessionId, summarized: false },
        context,
        toolCall
      );

      const text = contentText(result.toolMessage.content);
      expect(result.toolMessage.isError).toBe(false);
      expect(text).toContain("full history");
      expect(text).toContain("\"type\": \"note\"");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function buildContext(
  agentId: string,
  config: ReturnType<typeof configResolve>
): ToolExecutionContext {
  return {
    connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
    fileStore: null as unknown as ToolExecutionContext["fileStore"],
    auth: null as unknown as ToolExecutionContext["auth"],
    logger: console as unknown as ToolExecutionContext["logger"],
    assistant: null,
    permissions: config.defaultPermissions,
    agent: { id: agentId } as unknown as ToolExecutionContext["agent"],
    source: "test",
    messageContext: {},
    agentSystem: { config: { current: config } } as unknown as ToolExecutionContext["agentSystem"],
    heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
  };
}

function contentText(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((item) => {
      if (typeof item !== "object" || item === null) {
        return false;
      }
      return (item as { type?: unknown }).type === "text";
    })
    .map((item) => (item as { text?: unknown }).text)
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}
