import { Type, type Static } from "@sinclair/typebox";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { ToolDefinition, ToolResultContract } from "@/types";
import { agentDescriptorTargetResolve } from "../../agents/ops/agentDescriptorTargetResolve.js";
import { agentHistoryDeleteMessage } from "../../agents/ops/agentHistoryDeleteMessage.js";

const deleteMessageSchema = Type.Object(
  {
    messageId: Type.String({ minLength: 1 }),
    source: Type.Optional(Type.String({ minLength: 1 }))
  },
  { additionalProperties: false }
);

type DeleteMessageArgs = Static<typeof deleteMessageSchema>;

const deleteMessageResultSchema = Type.Object(
  {
    success: Type.Boolean(),
    message: Type.String(),
    deletedFromChannel: Type.Boolean(),
    deletedFromContext: Type.Boolean(),
    deletedFromHistory: Type.Boolean()
  },
  { additionalProperties: false }
);

type DeleteMessageResult = Static<typeof deleteMessageResultSchema>;

const deleteMessageReturns: ToolResultContract<DeleteMessageResult> = {
  schema: deleteMessageResultSchema,
  toLLMText: (result) => result.message
};

/**
 * Tool for deleting messages from channel history and agent context.
 * Use for removing accidentally shared secrets or sensitive information.
 */
export function buildDeleteMessageTool(): ToolDefinition {
  return {
    tool: {
      name: "delete_message",
      description:
        "Delete a message from channel history and agent context. Use for removing accidentally shared secrets or sensitive information.",
      parameters: deleteMessageSchema
    },
    returns: deleteMessageReturns,
    execute: async (args, toolContext, toolCall) => {
      const payload = args as DeleteMessageArgs;
      const { messageId, source } = payload;

      let deletedFromChannel = false;
      let deletedFromContext = false;
      let deletedFromHistory = false;

      // Get the connector from source or current context
      const target = agentDescriptorTargetResolve(toolContext.agent.descriptor);
      const connectorSource = source ?? target?.connector;

      // Try to delete from channel if connector supports it
      if (connectorSource && toolContext.connectorRegistry) {
        const connector = toolContext.connectorRegistry.get(connectorSource);
        if (connector?.capabilities.deleteMessage && connector.deleteMessage) {
          const targetId = target?.targetId;
          if (targetId) {
            try {
              deletedFromChannel = await connector.deleteMessage(targetId, messageId);
            } catch (error) {
              // Log but continue - deletion from other sources is still valuable
              toolContext.logger.warn(
                { error, messageId, source: connectorSource },
                "delete_message: Failed to delete from channel"
              );
            }
          }
        }
      }

      // Delete from agent in-memory context
      try {
        deletedFromContext = deleteFromAgentContext(toolContext.agent, messageId);
      } catch (error) {
        toolContext.logger.warn(
          { error, messageId },
          "delete_message: Failed to delete from agent context"
        );
      }

      // Delete from persistent history
      try {
        const config = toolContext.agentSystem.config.current;
        deletedFromHistory = await agentHistoryDeleteMessage(
          config,
          toolContext.agent.id,
          messageId
        );
      } catch (error) {
        toolContext.logger.warn(
          { error, messageId },
          "delete_message: Failed to delete from agent history"
        );
      }

      const success = deletedFromChannel || deletedFromContext || deletedFromHistory;
      const parts: string[] = [];

      if (deletedFromChannel) {
        parts.push("channel");
      }
      if (deletedFromContext) {
        parts.push("context");
      }
      if (deletedFromHistory) {
        parts.push("history");
      }

      const message = success
        ? `Message deleted from ${parts.join(" and ")}.`
        : "Message not found or could not be deleted.";

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: message }],
        isError: !success,
        timestamp: Date.now()
      };

      return {
        toolMessage,
        typedResult: {
          success,
          message,
          deletedFromChannel,
          deletedFromContext,
          deletedFromHistory
        }
      };
    }
  };
}

/**
 * Delete a message from agent's in-memory context.
 * Scans messages for the messageId tag and removes matching entries.
 */
function deleteFromAgentContext(
  agent: import("../../agents/agent.js").Agent,
  messageId: string
): boolean {
  const messages = agent.state.context.messages ?? [];
  const originalLength = messages.length;

  agent.state.context.messages = messages.filter((msg) => {
    // Check if this message has the matching messageId in its content
    // Messages from connectors include messageId in <message_id> tags
    if ("content" in msg && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text" && typeof block.text === "string") {
          // Check for messageId in formatted message
          if (block.text.includes(`<message_id>${messageId}</message_id>`)) {
            return false; // Remove this message
          }
        }
      }
    }
    return true; // Keep the message
  });

  return agent.state.context.messages.length < originalLength;
}
