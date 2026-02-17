import os from "node:os";

import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders the preamble section from runtime identity and role metadata.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionPreamble(
  context: AgentSystemPromptContext = {}
): Promise<string> {
  const descriptor = context.descriptor;
  const template = await agentPromptBundledRead("SYSTEM.md");
  const parentAgentId =
    descriptor && (descriptor.type === "subagent" || descriptor.type === "app")
      ? descriptor.parentAgentId ?? ""
      : "";
  const section = Handlebars.compile(template)({
    isForeground: descriptor?.type === "user",
    parentAgentId,
    date: new Date().toISOString().slice(0, 10),
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    model: context.model ?? "unknown",
    provider: context.provider ?? "unknown"
  });
  return section.trim();
}
