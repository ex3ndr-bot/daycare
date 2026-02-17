import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders the workspace section from permission-derived workspace path.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionWorkspace(
  context: AgentSystemPromptContext = {}
): Promise<string> {
  const template = await agentPromptBundledRead("SYSTEM_WORKSPACE.md");
  const section = Handlebars.compile(template)({
    workspace: context.permissions?.workingDir ?? "unknown",
    isForeground: context.descriptor?.type === "user"
  });
  return section.trim();
}
