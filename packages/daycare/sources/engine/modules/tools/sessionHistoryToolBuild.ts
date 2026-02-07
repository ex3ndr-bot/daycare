import { Type, type Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { AgentHistoryRecord, ToolDefinition } from "@/types";
import { stringTruncate } from "../../../utils/stringTruncate.js";
import { agentDescriptorRead } from "../../agents/ops/agentDescriptorRead.js";
import { agentHistoryLoad } from "../../agents/ops/agentHistoryLoad.js";
import { agentHistorySummaryBuild } from "../../agents/ops/agentHistorySummaryBuild.js";

const schema = Type.Object(
  {
    sessionId: Type.String({ minLength: 1 }),
    summarized: Type.Optional(Type.Boolean())
  },
  { additionalProperties: false }
);

type SessionHistoryArgs = Static<typeof schema>;

/**
 * Builds the read_session_history tool for cross-session visibility.
 * Expects: sessionId references another persisted agent/session id.
 */
export function sessionHistoryToolBuild(): ToolDefinition {
  return {
    tool: {
      name: "read_session_history",
      description:
        "Read another session's history by sessionId. Returns a summary by default (summarized=true).",
      parameters: schema
    },
    execute: async (args, toolContext, toolCall) => {
      const payload = args as SessionHistoryArgs;
      const sessionId = payload.sessionId.trim();
      if (!sessionId) {
        throw new Error("sessionId is required.");
      }
      if (sessionId === toolContext.agent.id) {
        throw new Error("sessionId must refer to another session.");
      }

      const config = toolContext.agentSystem.config.current;
      const descriptor = await agentDescriptorRead(config, sessionId);
      if (!descriptor) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const records = await agentHistoryLoad(config, sessionId);
      const summarized = payload.summarized ?? true;
      const text = summarized
        ? summaryTextBuild(sessionId, records)
        : rawHistoryTextBuild(sessionId, records);

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        details: {
          sessionId,
          summarized,
          recordCount: records.length
        },
        isError: false,
        timestamp: Date.now()
      };

      return { toolMessage, files: [] };
    }
  };
}

function summaryTextBuild(sessionId: string, records: AgentHistoryRecord[]): string {
  if (records.length === 0) {
    return `No history records found for session ${sessionId}.`;
  }

  const summary = agentHistorySummaryBuild(records);
  const lines = [
    `Session ${sessionId} summary:`,
    `records: ${summary.recordCount}`,
    `range: ${formatTimestamp(summary.firstAt)} -> ${formatTimestamp(summary.lastAt)}`,
    [
      `types: start=${summary.counts.start}`,
      `reset=${summary.counts.reset}`,
      `user=${summary.counts.user_message}`,
      `assistant=${summary.counts.assistant_message}`,
      `tool_result=${summary.counts.tool_result}`,
      `note=${summary.counts.note}`
    ].join(" ")
  ];

  if (summary.lastUserMessage && summary.lastUserMessage.trim().length > 0) {
    lines.push(`last_user: ${stringTruncate(summary.lastUserMessage, 280)}`);
  }
  if (summary.lastAssistantMessage && summary.lastAssistantMessage.trim().length > 0) {
    lines.push(`last_assistant: ${stringTruncate(summary.lastAssistantMessage, 280)}`);
  }
  if (summary.lastNote && summary.lastNote.trim().length > 0) {
    lines.push(`last_note: ${stringTruncate(summary.lastNote, 200)}`);
  }
  if (summary.lastToolName) {
    lines.push(`last_tool: ${summary.lastToolName}`);
  }

  return lines.join("\n");
}

function rawHistoryTextBuild(sessionId: string, records: AgentHistoryRecord[]): string {
  if (records.length === 0) {
    return `No history records found for session ${sessionId}.`;
  }
  return [
    `Session ${sessionId} full history (${records.length} records):`,
    JSON.stringify(records, null, 2)
  ].join("\n");
}

function formatTimestamp(at: number | null): string {
  if (at === null) {
    return "unknown";
  }
  return new Date(at).toISOString();
}
