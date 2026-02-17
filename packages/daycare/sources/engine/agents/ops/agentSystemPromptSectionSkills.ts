import path from "node:path";

import Handlebars from "handlebars";

import { skillPromptFormat } from "../../skills/skillPromptFormat.js";
import { Skills } from "../../skills/skills.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders skills and plugin context by loading dynamic skill definitions and plugin prompts.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionSkills(
  context: AgentSystemPromptContext = {}
): Promise<string> {
  const [skillsPrompt, pluginPrompt] = await Promise.all([
    (async () => {
      const configDir = context.agentSystem?.config?.current.configDir ?? "";
      if (!configDir) {
        return "";
      }
      const configSkillsRoot = path.join(configDir, "skills");
      const pluginManager = context.agentSystem?.pluginManager ?? { listRegisteredSkills: () => [] };
      const skills = new Skills({
        configRoot: configSkillsRoot,
        pluginManager
      });
      return skillPromptFormat(await skills.list());
    })(),
    (async () => {
      const prompts = await context.agentSystem?.pluginManager?.getSystemPrompts();
      return prompts && prompts.length > 0 ? prompts.join("\n\n") : "";
    })()
  ]);

  const template = await agentPromptBundledRead("SYSTEM_SKILLS.md");
  const section = Handlebars.compile(template)({
    skillsPrompt,
    pluginPrompt
  });
  return section.trim();
}
