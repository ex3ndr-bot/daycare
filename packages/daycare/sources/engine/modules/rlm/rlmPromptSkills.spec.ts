import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";
import type { Tool } from "@mariozechner/pi-ai";
import type { AgentSkill } from "@/types";

import { agentPromptBundledRead } from "../../agents/ops/agentPromptBundledRead.js";
import { skillPromptFormat } from "../../skills/skillPromptFormat.js";
import { rlmNoToolsPromptBuild } from "./rlmNoToolsPromptBuild.js";
import { rlmToolDescriptionBuild } from "./rlmToolDescriptionBuild.js";

type RenderSystemPromptOptions = {
  toolsText: string;
  skillsPrompt: string;
  noToolsPrompt?: string;
  isForeground?: boolean;
  featuresSay?: boolean;
};

let systemTemplatePromise: Promise<HandlebarsTemplateDelegate<Record<string, unknown>>> | null = null;

const skills: AgentSkill[] = [
  {
    id: "core:scheduling",
    name: "scheduling",
    description: "Set up recurring tasks",
    source: "core",
    path: "/tmp/skills/scheduling/SKILL.md",
    sandbox: true
  }
];

const tools = [
  { name: "run_python", description: "", parameters: {} },
  { name: "echo", description: "Echo text", parameters: {} },
  { name: "skill", description: "Load skill", parameters: {} }
] as unknown as Tool[];

describe("system prompt skills rendering", () => {
  it("includes the skill list once in classic mode", async () => {
    const prompt = await renderSystemPrompt({
      toolsText: "Tool notes",
      skillsPrompt: skillPromptFormat(skills)
    });

    expect(occurrences(prompt, "<name>scheduling</name>")).toBe(1);
  });

  it("includes the skill list once in rlm mode", async () => {
    const prompt = await renderSystemPrompt({
      toolsText: await rlmToolDescriptionBuild(tools),
      skillsPrompt: skillPromptFormat(skills)
    });

    expect(occurrences(prompt, "<name>scheduling</name>")).toBe(1);
  });

  it("includes the skill list once in no-tools mode", async () => {
    const prompt = await renderSystemPrompt({
      toolsText: "Tool notes",
      skillsPrompt: skillPromptFormat(skills),
      noToolsPrompt: await rlmNoToolsPromptBuild(tools),
      featuresSay: true
    });

    expect(occurrences(prompt, "<name>scheduling</name>")).toBe(1);
  });

  it("shows static skills guidance for background agents", async () => {
    const prompt = await renderSystemPrompt({
      toolsText: "",
      skillsPrompt: "",
      isForeground: false
    });

    expect(prompt).toContain("## Skills");
    expect(prompt).toContain("Invoke skills via the `skill` tool.");
    expect(prompt).not.toContain("For local skill authoring:");
  });
});

async function renderSystemPrompt(options: RenderSystemPromptOptions): Promise<string> {
  const systemTemplate = await systemTemplateCompile();
  return systemTemplate({
    isForeground: options.isForeground ?? true,
    date: "2026-02-17",
    permissions: "permissions",
    agentic: "agentic",
    permanentAgentsPrompt: "",
    noToolsPrompt: options.noToolsPrompt ?? "",
    os: "Darwin 24.0.0",
    arch: "arm64",
    model: "test-model",
    provider: "test-provider",
    workspace: "/tmp/workspace",
    connector: "test",
    channelId: "channel-1",
    userId: "user-1",
    cronTaskId: "",
    cronTaskName: "",
    cronMemoryPath: "",
    cronFilesPath: "",
    cronTaskIds: "",
    soulPath: "/tmp/SOUL.md",
    userPath: "/tmp/USER.md",
    agentsPath: "/tmp/AGENTS.md",
    toolsPath: "/tmp/TOOLS.md",
    memoryPath: "/tmp/MEMORY.md",
    user: "user",
    soul: "soul",
    agents: "agents",
    tools: options.toolsText,
    memory: "memory",
    skillsPrompt: options.skillsPrompt,
    pluginPrompt: "",
    messageFormatPrompt: "",
    canSendFiles: false,
    fileSendModes: "",
    agentPrompt: "",
    configDir: "/tmp/.daycare",
    features: {
      say: options.featuresSay ?? false
    }
  }).trim();
}

async function systemTemplateCompile(): Promise<HandlebarsTemplateDelegate<Record<string, unknown>>> {
  if (systemTemplatePromise) {
    return systemTemplatePromise;
  }
  systemTemplatePromise = agentPromptBundledRead("SYSTEM.md")
    .then((source) => Handlebars.compile<Record<string, unknown>>(source));
  return systemTemplatePromise;
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}
