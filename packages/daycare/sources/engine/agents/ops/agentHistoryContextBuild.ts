import type { Context, ToolCall } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";

import type { AgentHistoryRecord, AgentMessage, MessageContext } from "@/types";
import { messageBuildUser } from "../../messages/messageBuildUser.js";
import { messageBuildSystemText } from "../../messages/messageBuildSystemText.js";
import { messageFormatIncoming } from "../../messages/messageFormatIncoming.js";

/**
 * Rebuilds conversation context messages from persisted history records.
 * Expects: records are in chronological order and belong to one agent.
 */
export async function agentHistoryContextBuild(
  records: AgentHistoryRecord[],
  agentId: string
): Promise<Context["messages"]> {
  const messages: Context["messages"] = [];
  for (const record of records) {
    if (record.type === "rlm_start") {
      continue;
    }
    if (record.type === "rlm_tool_call") {
      continue;
    }
    if (record.type === "rlm_tool_result") {
      continue;
    }
    if (record.type === "rlm_complete") {
      continue;
    }
    if (record.type === "reset" && record.message && record.message.trim().length > 0) {
      messages.push(resetSystemMessageBuild(record.message, record.at, agentId));
    }
    if (record.type === "user_message") {
      const context: MessageContext = {};
      const message = messageFormatIncoming(
        {
          text: record.text,
          files: record.files.map((file) => ({ ...file }))
        },
        context,
        new Date(record.at)
      );
      const userEntry: AgentMessage = {
        id: createId(),
        message,
        context,
        receivedAt: record.at
      };
      messages.push(await messageBuildUser(userEntry));
    }
    if (record.type === "assistant_message") {
      const content: Array<{ type: "text"; text: string } | ToolCall> = [];
      if (record.text.length > 0) {
        content.push({ type: "text", text: record.text });
      }
      for (const toolCall of record.toolCalls) {
        content.push(toolCall);
      }
      messages.push({
        role: "assistant",
        content,
        api: "history",
        provider: "history",
        model: "history",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0
          }
        },
        stopReason: "stop",
        timestamp: record.at
      });
    }
    if (record.type === "tool_result") {
      messages.push(record.output.toolMessage);
    }
  }
  return messages;
}

function resetSystemMessageBuild(
  text: string,
  at: number,
  origin: string
): Context["messages"][number] {
  return {
    role: "user",
    content: messageBuildSystemText(text, origin),
    timestamp: at
  };
}
