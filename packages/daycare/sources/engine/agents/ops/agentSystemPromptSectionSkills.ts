import type { AgentSystemPromptSectionContext } from "./agentSystemPromptSectionContext.js";
import { agentSystemPromptSectionRender } from "./agentSystemPromptSectionRender.js";

/**
 * Renders skills and plugin context guidance for the system prompt.
 * Expects: context includes dynamic skills/plugin sections.
 */
export async function agentSystemPromptSectionSkills(
  context: AgentSystemPromptSectionContext
): Promise<string> {
  return agentSystemPromptSectionRender("SYSTEM_SECTION_SKILLS.md", context);
}
