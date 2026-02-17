import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import Handlebars from "handlebars";
import type { Tool } from "@mariozechner/pi-ai";

import { getLogger } from "../../../log.js";
import {
  DEFAULT_AGENTS_PATH,
  DEFAULT_MEMORY_PATH,
  DEFAULT_SOUL_PATH,
  DEFAULT_TOOLS_PATH,
  DEFAULT_USER_PATH
} from "../../../paths.js";
import type { AgentDescriptor, Config } from "@/types";
import type { PluginManager } from "../../plugins/manager.js";
import { rlmNoToolsPromptBuild } from "../../modules/rlm/rlmNoToolsPromptBuild.js";
import { skillPromptFormat } from "../../skills/skillPromptFormat.js";
import { Skills } from "../../skills/skills.js";
import { agentPermanentList } from "./agentPermanentList.js";
import { agentPermanentPrompt } from "./agentPermanentPrompt.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentPromptFilesEnsure } from "./agentPromptFilesEnsure.js";
import { agentPromptResolve } from "./agentPromptResolve.js";

const logger = getLogger("agent.prompt-build");

type AgentPromptFeatures = {
  noTools: boolean;
  rlm: boolean;
  say: boolean;
};

type AgentSystemPromptPluginManager = Pick<PluginManager, "getSystemPrompts" | "listRegisteredSkills">;

type AgentSystemPromptPaths = {
  soulPath: string;
  userPath: string;
  agentsPath: string;
  toolsPath: string;
  memoryPath: string;
};

type AgentSystemPromptFiles = {
  soul: string;
  user: string;
  agents: string;
  tools: string;
  memory: string;
};

type AgentSystemPromptSections = {
  pluginPrompt: string;
  skillsPrompt: string;
  permanentAgentsPrompt: string;
  agentPrompt: string;
  noToolsPrompt: string;
  replaceSystemPrompt: boolean;
};

type AgentSystemPromptTemplates = {
  systemTemplate: string;
  permissionsTemplate: string;
  agenticTemplate: string;
};

export type AgentSystemPromptContext = {
  model?: string;
  provider?: string;
  workspace?: string;
  writeDirs?: string[];
  network?: boolean;
  events?: boolean;
  connector?: string;
  canSendFiles?: boolean;
  fileSendModes?: string;
  messageFormatPrompt?: string;
  channelId?: string;
  userId?: string;
  cronTaskId?: string;
  cronTaskName?: string;
  cronMemoryPath?: string;
  cronFilesPath?: string;
  cronTaskIds?: string;
  appFolderPath?: string;
  workspacePermissionGranted?: boolean;
  soulPath?: string;
  userPath?: string;
  agentsPath?: string;
  toolsPath?: string;
  memoryPath?: string;
  pluginPrompt?: string;
  skillsPrompt?: string;
  permanentAgentsPrompt?: string;
  agentPrompt?: string;
  noToolsPrompt?: string;
  replaceSystemPrompt?: boolean;
  agentKind?: "background" | "foreground";
  parentAgentId?: string;
  configDir?: string;
  skillsPath?: string;
  features?: AgentPromptFeatures;
  descriptor?: AgentDescriptor;
  config?: Config;
  pluginManager?: AgentSystemPromptPluginManager;
  availableTools?: Tool[];
  ensurePromptFiles?: boolean;
};

export type AgentSystemPromptBuildContext = AgentSystemPromptContext;

/**
 * Builds the system prompt text from deterministic sections and bundled templates.
 * Expects: prompt templates exist under engine/prompts.
 */
export async function agentSystemPrompt(
  context: AgentSystemPromptContext = {}
): Promise<string> {
  const promptPaths = resolvePromptPaths(context);
  if (context.ensurePromptFiles) {
    await agentPromptFilesEnsure();
  }

  const [promptFiles, templates, sections] = await Promise.all([
    loadPromptFiles(promptPaths),
    loadPromptTemplates(),
    resolvePromptSections(context)
  ]);

  if (sections.replaceSystemPrompt) {
    const replaced = sections.agentPrompt.trim();
    if (!replaced) {
      throw new Error("System prompt replacement requires a non-empty agent prompt.");
    }
    return replaced;
  }

  const additionalWriteDirs = resolveAdditionalWriteDirs(
    context.writeDirs ?? [],
    context.workspace ?? "",
    promptPaths.soulPath,
    promptPaths.userPath,
    promptPaths.agentsPath,
    promptPaths.toolsPath,
    promptPaths.memoryPath
  );

  const configDir = context.configDir ?? context.config?.configDir ?? "";
  const isForeground = context.agentKind !== "background";
  const skillsPath = context.skillsPath ?? (configDir ? `${configDir}/skills` : "");
  const features = context.features ?? context.config?.features ?? {
    noTools: false,
    rlm: false,
    say: false
  };

  const templateContext = {
    date: new Date().toISOString().split("T")[0],
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    model: context.model ?? "unknown",
    provider: context.provider ?? "unknown",
    workspace: context.workspace ?? "unknown",
    network: context.network ?? false,
    events: context.events ?? false,
    connector: context.connector ?? "unknown",
    canSendFiles: context.canSendFiles ?? false,
    fileSendModes: context.fileSendModes ?? "",
    messageFormatPrompt: context.messageFormatPrompt ?? "",
    channelId: context.channelId ?? "unknown",
    userId: context.userId ?? "unknown",
    cronTaskId: context.cronTaskId ?? "",
    cronTaskName: context.cronTaskName ?? "",
    cronMemoryPath: context.cronMemoryPath ?? "",
    cronFilesPath: context.cronFilesPath ?? "",
    cronTaskIds: context.cronTaskIds ?? "",
    appFolderPath: context.appFolderPath ?? "",
    workspacePermissionGranted: context.workspacePermissionGranted ?? false,
    soulPath: promptPaths.soulPath,
    userPath: promptPaths.userPath,
    agentsPath: promptPaths.agentsPath,
    toolsPath: promptPaths.toolsPath,
    memoryPath: promptPaths.memoryPath,
    pluginPrompt: sections.pluginPrompt,
    skillsPrompt: sections.skillsPrompt,
    parentAgentId: context.parentAgentId ?? "",
    configDir,
    skillsPath,
    isForeground,
    soul: promptFiles.soul,
    user: promptFiles.user,
    agents: promptFiles.agents,
    tools: promptFiles.tools,
    memory: promptFiles.memory,
    additionalWriteDirs,
    permanentAgentsPrompt: sections.permanentAgentsPrompt,
    agentPrompt: sections.agentPrompt,
    noToolsPrompt: sections.noToolsPrompt,
    features
  };

  logger.debug("event: buildSystemPrompt compiling permissions template");
  const permissions = Handlebars.compile(templates.permissionsTemplate)(templateContext);

  logger.debug("event: buildSystemPrompt compiling agentic template");
  const agentic = Handlebars.compile(templates.agenticTemplate)(templateContext);

  logger.debug("event: buildSystemPrompt compiling main template");
  const template = Handlebars.compile(templates.systemTemplate);
  logger.debug("event: buildSystemPrompt rendering template");
  const rendered = template({
    ...templateContext,
    permissions,
    agentic
  });

  return rendered.trim();
}

function resolvePromptPaths(context: AgentSystemPromptContext): AgentSystemPromptPaths {
  return {
    soulPath: context.soulPath ?? DEFAULT_SOUL_PATH,
    userPath: context.userPath ?? DEFAULT_USER_PATH,
    agentsPath: context.agentsPath ?? DEFAULT_AGENTS_PATH,
    toolsPath: context.toolsPath ?? DEFAULT_TOOLS_PATH,
    memoryPath: context.memoryPath ?? DEFAULT_MEMORY_PATH
  };
}

async function loadPromptFiles(paths: AgentSystemPromptPaths): Promise<AgentSystemPromptFiles> {
  logger.debug(`event: buildSystemPrompt reading soul prompt path=${paths.soulPath}`);
  logger.debug(`event: buildSystemPrompt reading user prompt path=${paths.userPath}`);
  logger.debug(`event: buildSystemPrompt reading agents prompt path=${paths.agentsPath}`);
  logger.debug(`event: buildSystemPrompt reading tools prompt path=${paths.toolsPath}`);
  logger.debug(`event: buildSystemPrompt reading memory prompt path=${paths.memoryPath}`);
  const [soul, user, agents, tools, memory] = await Promise.all([
    promptFileRead(paths.soulPath, "SOUL.md"),
    promptFileRead(paths.userPath, "USER.md"),
    promptFileRead(paths.agentsPath, "AGENTS.md"),
    promptFileRead(paths.toolsPath, "TOOLS.md"),
    promptFileRead(paths.memoryPath, "MEMORY.md")
  ]);
  return {
    soul,
    user,
    agents,
    tools,
    memory
  };
}

async function loadPromptTemplates(): Promise<AgentSystemPromptTemplates> {
  logger.debug("event: buildSystemPrompt reading system template");
  logger.debug("event: buildSystemPrompt reading permissions template");
  logger.debug("event: buildSystemPrompt reading agentic template");
  const [systemTemplate, permissionsTemplate, agenticTemplate] = await Promise.all([
    agentPromptBundledRead("SYSTEM.md"),
    agentPromptBundledRead("PERMISSIONS.md"),
    agentPromptBundledRead("AGENTIC.md")
  ]);
  return {
    systemTemplate,
    permissionsTemplate: permissionsTemplate.trim(),
    agenticTemplate: agenticTemplate.trim()
  };
}

async function resolvePromptSections(
  context: AgentSystemPromptContext
): Promise<AgentSystemPromptSections> {
  const [pluginPrompt, skillsPrompt, permanentAgentsPrompt, agentPromptSection, noToolsPrompt] =
    await Promise.all([
      resolvePluginPrompt(context),
      resolveSkillsPrompt(context),
      resolvePermanentAgentsPrompt(context),
      resolveAgentPromptSection(context),
      resolveNoToolsPrompt(context)
    ]);
  return {
    pluginPrompt,
    skillsPrompt,
    permanentAgentsPrompt,
    agentPrompt: agentPromptSection.agentPrompt,
    replaceSystemPrompt: agentPromptSection.replaceSystemPrompt,
    noToolsPrompt
  };
}

async function resolvePluginPrompt(context: AgentSystemPromptContext): Promise<string> {
  if (context.pluginPrompt !== undefined) {
    return context.pluginPrompt;
  }
  if (!context.pluginManager) {
    return "";
  }
  const prompts = await context.pluginManager.getSystemPrompts();
  return prompts.length > 0 ? prompts.join("\n\n") : "";
}

async function resolveSkillsPrompt(context: AgentSystemPromptContext): Promise<string> {
  if (context.skillsPrompt !== undefined) {
    return context.skillsPrompt;
  }
  const configDir = context.configDir ?? context.config?.configDir ?? "";
  const skillsRoot = context.skillsPath ?? (configDir ? path.join(configDir, "skills") : "");
  if (!skillsRoot) {
    return "";
  }
  const pluginSkills = context.pluginManager ?? { listRegisteredSkills: () => [] };
  const skills = new Skills({
    configRoot: skillsRoot,
    pluginManager: pluginSkills
  });
  const availableSkills = await skills.list();
  return skillPromptFormat(availableSkills);
}

async function resolvePermanentAgentsPrompt(context: AgentSystemPromptContext): Promise<string> {
  if (context.permanentAgentsPrompt !== undefined) {
    return context.permanentAgentsPrompt;
  }
  if (!context.config) {
    return "";
  }
  const permanentAgents = await agentPermanentList(context.config);
  return agentPermanentPrompt(permanentAgents);
}

async function resolveAgentPromptSection(
  context: AgentSystemPromptContext
): Promise<{ agentPrompt: string; replaceSystemPrompt: boolean }> {
  if (context.agentPrompt !== undefined || context.replaceSystemPrompt !== undefined) {
    return {
      agentPrompt: context.agentPrompt ?? "",
      replaceSystemPrompt: context.replaceSystemPrompt ?? false
    };
  }
  if (!context.descriptor) {
    return {
      agentPrompt: "",
      replaceSystemPrompt: false
    };
  }
  return agentPromptResolve(context.descriptor);
}

async function resolveNoToolsPrompt(context: AgentSystemPromptContext): Promise<string> {
  if (context.noToolsPrompt !== undefined) {
    return context.noToolsPrompt;
  }
  const features = context.features ?? context.config?.features;
  if (!features?.noTools) {
    return "";
  }
  const availableTools = context.availableTools ?? [];
  if (availableTools.length === 0) {
    return "";
  }
  return rlmNoToolsPromptBuild(availableTools);
}

function resolveAdditionalWriteDirs(
  writeDirs: string[],
  workspace: string,
  soulPath: string,
  userPath: string,
  agentsPath: string,
  toolsPath: string,
  memoryPath: string
): string[] {
  const excluded = new Set(
    [workspace, soulPath, userPath, agentsPath, toolsPath, memoryPath]
      .filter((entry) => entry && entry.trim().length > 0)
      .map((entry) => path.resolve(entry))
  );
  const filtered = writeDirs
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => path.resolve(entry))
    .filter((entry) => !excluded.has(entry));
  return Array.from(new Set(filtered)).sort();
}

async function promptFileRead(filePath: string, fallbackPrompt: string): Promise<string> {
  const resolvedPath = path.resolve(filePath);
  try {
    const content = await fs.readFile(resolvedPath, "utf8");
    const trimmed = content.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const defaultContent = await agentPromptBundledRead(fallbackPrompt);
  return defaultContent.trim();
}
