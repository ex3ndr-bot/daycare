import type { AgentSystemPromptSectionContext } from "./agentSystemPromptSectionContext.js";
import { agentSystemPromptSectionRender } from "./agentSystemPromptSectionRender.js";

/**
 * Renders message-format and delivery behavior guidance for the system prompt.
 * Expects: context includes connector formatting hints.
 */
export async function agentSystemPromptSectionMessages(
  context: AgentSystemPromptSectionContext
): Promise<string> {
  return agentSystemPromptSectionRender("SYSTEM_SECTION_MESSAGES.md", context);
}
