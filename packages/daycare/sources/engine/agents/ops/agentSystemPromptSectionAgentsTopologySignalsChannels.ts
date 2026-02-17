import type { AgentSystemPromptSectionContext } from "./agentSystemPromptSectionContext.js";
import { agentSystemPromptSectionRender } from "./agentSystemPromptSectionRender.js";

/**
 * Renders agents/topology/signals/channels guidance for the system prompt.
 * Expects: context includes cron ids and permanent agent summaries.
 */
export async function agentSystemPromptSectionAgentsTopologySignalsChannels(
  context: AgentSystemPromptSectionContext
): Promise<string> {
  return agentSystemPromptSectionRender(
    "SYSTEM_SECTION_AGENTS_TOPOLOGY_SIGNALS_CHANNELS.md",
    context
  );
}
