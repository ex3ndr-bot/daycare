import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import type { AppDescriptor } from "./appTypes.js";
import { appExecute } from "./appExecute.js";
import { appToolNameFormat } from "./appToolNameFormat.js";

const schema = Type.Object(
  {
    prompt: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

type AppToolBuildArgs = Static<typeof schema>;

/**
 * Builds the per-app `app_<id>` tool definition.
 * Expects: descriptor is a validated discovered app.
 */
export function appToolBuild(app: AppDescriptor): ToolDefinition {
  const toolName = appToolNameFormat(app.id);
  return {
    tool: {
      name: toolName,
      description: app.manifest.description,
      parameters: schema
    },
    execute: async (args, context, toolCall) => {
      const payload = args as AppToolBuildArgs;
      const prompt = payload.prompt.trim();
      if (!prompt) {
        throw new Error("App prompt is required.");
      }
      const responseText = await appExecute({
        app,
        prompt,
        context
      });
      const text = responseText && responseText.trim().length > 0
        ? responseText
        : `App "${app.manifest.name}" completed without a text response.`;
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        isError: false,
        timestamp: Date.now()
      };
      return { toolMessage, files: [] };
    }
  };
}
