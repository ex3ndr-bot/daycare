import type { AgentSystemPromptSectionContext } from "./agentSystemPromptSectionContext.js";
import { agentSystemPromptSectionRender } from "./agentSystemPromptSectionRender.js";

/**
 * Renders autonomous-operation guidance for the system prompt.
 * Expects: context includes parent/foreground metadata and optional agent prompt.
 */
export async function agentSystemPromptSectionAutonomousOperation(
  context: AgentSystemPromptSectionContext
): Promise<string> {
  return agentSystemPromptSectionRender("SYSTEM_SECTION_AUTONOMOUS_OPERATION.md", context);
}
