import type { AgentSystemPromptSectionContext } from "./agentSystemPromptSectionContext.js";
import { agentSystemPromptSectionRender } from "./agentSystemPromptSectionRender.js";

/**
 * Renders the permissions section for the system prompt.
 * Expects: context includes workspace and permission metadata.
 */
export async function agentSystemPromptSectionPermissions(
  context: AgentSystemPromptSectionContext
): Promise<string> {
  return agentSystemPromptSectionRender("SYSTEM_SECTION_PERMISSIONS.md", context);
}
