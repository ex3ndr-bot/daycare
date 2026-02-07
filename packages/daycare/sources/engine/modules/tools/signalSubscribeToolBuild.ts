import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import type { Signals } from "../../signals/signals.js";

const schema = Type.Object(
  {
    pattern: Type.String({ minLength: 1 }),
    silent: Type.Optional(Type.Boolean()),
    agentId: Type.Optional(Type.String({ minLength: 1 }))
  },
  { additionalProperties: false }
);

type SubscribeSignalArgs = Static<typeof schema>;

export function buildSignalSubscribeTool(signals: Signals): ToolDefinition {
  return {
    tool: {
      name: "signal_subscribe",
      description:
        "Subscribe an agent to signal types using `*` wildcard segments (for example `a:*:c`).",
      parameters: schema
    },
    execute: async (args, toolContext, toolCall) => {
      const payload = args as SubscribeSignalArgs;
      const targetAgentId = payload.agentId?.trim() ?? toolContext.agent.id;
      const exists = await toolContext.agentSystem.agentExists(targetAgentId);
      if (!exists) {
        throw new Error(`Agent not found: ${targetAgentId}`);
      }

      const subscription = signals.subscribe({
        agentId: targetAgentId,
        pattern: payload.pattern,
        silent: payload.silent
      });

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [
          {
            type: "text",
            text: `Signal subscription saved for ${subscription.agentId}: ${subscription.pattern} (silent=${subscription.silent}).`
          }
        ],
        details: { subscription },
        isError: false,
        timestamp: Date.now()
      };

      return { toolMessage, files: [] };
    }
  };
}
