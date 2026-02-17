import type { AgentSystemPromptSectionContext } from "./agentSystemPromptSectionContext.js";
import { agentSystemPromptSectionRender } from "./agentSystemPromptSectionRender.js";

/**
 * Renders memory/files guidance for the system prompt.
 * Expects: context includes memory file paths and current contents.
 */
export async function agentSystemPromptSectionFiles(
  context: AgentSystemPromptSectionContext
): Promise<string> {
  return agentSystemPromptSectionRender("SYSTEM_SECTION_FILES.md", context);
}
