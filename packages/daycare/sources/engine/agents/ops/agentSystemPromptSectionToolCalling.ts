import type { AgentSystemPromptSectionContext } from "./agentSystemPromptSectionContext.js";
import { agentSystemPromptSectionRender } from "./agentSystemPromptSectionRender.js";

/**
 * Renders tool-calling instructions for the system prompt.
 * Expects: context includes optional no-tools guidance.
 */
export async function agentSystemPromptSectionToolCalling(
  context: AgentSystemPromptSectionContext
): Promise<string> {
  return agentSystemPromptSectionRender("SYSTEM_SECTION_TOOL_CALLING.md", context);
}
