import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptSectionContext } from "./agentSystemPromptSectionContext.js";

/**
 * Renders a system prompt section template with the provided deterministic context.
 * Expects: templateName points to a bundled prompt file.
 */
export async function agentSystemPromptSectionRender(
  templateName: string,
  context: AgentSystemPromptSectionContext
): Promise<string> {
  const template = await agentPromptBundledRead(templateName);
  return Handlebars.compile(template)(context).trim();
}
