import Handlebars from "handlebars";

import { rlmNoToolsPromptBuild } from "../../modules/rlm/rlmNoToolsPromptBuild.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders tool-calling guidance and optional no-tools enforcement section.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionToolCalling(
  context: AgentSystemPromptContext = {}
): Promise<string> {
  const config = context.agentSystem?.config?.current;
  const availableTools = context.agentSystem?.toolResolver?.listTools() ?? [];
  const noToolsPrompt =
    config?.features.noTools && availableTools.length > 0
      ? await rlmNoToolsPromptBuild(availableTools)
      : "";
  const template = await agentPromptBundledRead("SYSTEM_TOOL_CALLING.md");
  const section = Handlebars.compile(template)({ noToolsPrompt });
  return section.trim();
}
