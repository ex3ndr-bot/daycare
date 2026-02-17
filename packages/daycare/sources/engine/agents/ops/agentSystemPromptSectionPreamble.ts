import type { AgentSystemPromptSectionContext } from "./agentSystemPromptSectionContext.js";
import { agentSystemPromptSectionRender } from "./agentSystemPromptSectionRender.js";

/**
 * Renders the system prompt preamble section.
 * Expects: context includes runtime and role metadata.
 */
export async function agentSystemPromptSectionPreamble(
  context: AgentSystemPromptSectionContext
): Promise<string> {
  return agentSystemPromptSectionRender("SYSTEM_SECTION_PREAMBLE.md", context);
}
