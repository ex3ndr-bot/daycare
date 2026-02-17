import Handlebars from "handlebars";

import { agentPermanentList } from "./agentPermanentList.js";
import { agentPermanentPrompt } from "./agentPermanentPrompt.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders agent/collaboration/scheduling guidance from permanent-agent and cron state.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionAgentsTopologySignalsChannels(
  context: AgentSystemPromptContext = {}
): Promise<string> {
  const [permanentAgentsPrompt, cronTaskIds] = await Promise.all([
    (async () => {
      const config = context.agentSystem?.config?.current;
      if (!config) {
        return "";
      }
      const permanentAgents = await agentPermanentList(config);
      return agentPermanentPrompt(permanentAgents);
    })(),
    (async () => {
      const tasks = await context.agentSystem?.crons?.listTasks();
      if (!tasks || tasks.length === 0) {
        return "";
      }
      return tasks.map((task) => task.id).join(", ");
    })()
  ]);

  const template = await agentPromptBundledRead(
    "SYSTEM_AGENTS_TOPOLOGY_SIGNALS_CHANNELS.md"
  );
  const section = Handlebars.compile(template)({
    permanentAgentsPrompt,
    cronTaskIds
  });
  return section.trim();
}
