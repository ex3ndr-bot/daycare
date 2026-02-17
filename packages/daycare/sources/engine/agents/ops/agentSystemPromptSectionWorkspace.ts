import type { AgentSystemPromptSectionContext } from "./agentSystemPromptSectionContext.js";
import { agentSystemPromptSectionRender } from "./agentSystemPromptSectionRender.js";

/**
 * Renders the workspace section for the system prompt.
 * Expects: context includes workspace location.
 */
export async function agentSystemPromptSectionWorkspace(
  context: AgentSystemPromptSectionContext
): Promise<string> {
  return agentSystemPromptSectionRender("SYSTEM_SECTION_WORKSPACE.md", context);
}
