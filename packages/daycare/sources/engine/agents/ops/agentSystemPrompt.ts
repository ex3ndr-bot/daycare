import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import Handlebars from "handlebars";

import { getLogger } from "../../../log.js";
import {
  DEFAULT_AGENTS_PATH,
  DEFAULT_MEMORY_PATH,
  DEFAULT_SOUL_PATH,
  DEFAULT_TOOLS_PATH,
  DEFAULT_USER_PATH
} from "../../../paths.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";

const logger = getLogger("agent.prompt-build");

type AgentPromptFeatures = {
  noTools: boolean;
  rlm: boolean;
  say: boolean;
};

export type AgentSystemPromptBuildContext = {
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
};

/**
 * Builds the system prompt text for an agent from bundled templates + prompt files.
 * Expects: prompt templates exist under engine/prompts.
 */
export async function agentSystemPrompt(
  context: AgentSystemPromptBuildContext = {}
): Promise<string> {
  if (context.replaceSystemPrompt) {
    const replaced = (context.agentPrompt ?? "").trim();
    if (!replaced) {
      throw new Error("System prompt replacement requires a non-empty agent prompt.");
    }
    return replaced;
  }

  const soulPath = context.soulPath ?? DEFAULT_SOUL_PATH;
  const userPath = context.userPath ?? DEFAULT_USER_PATH;
  const agentsPath = context.agentsPath ?? DEFAULT_AGENTS_PATH;
  const toolsPath = context.toolsPath ?? DEFAULT_TOOLS_PATH;
  const memoryPath = context.memoryPath ?? DEFAULT_MEMORY_PATH;

  logger.debug(`event: buildSystemPrompt reading soul prompt path=${soulPath}`);
  const soul = await promptFileRead(soulPath, "SOUL.md");
  logger.debug(`event: buildSystemPrompt reading user prompt path=${userPath}`);
  const user = await promptFileRead(userPath, "USER.md");
  logger.debug(`event: buildSystemPrompt reading agents prompt path=${agentsPath}`);
  const agents = await promptFileRead(agentsPath, "AGENTS.md");
  logger.debug(`event: buildSystemPrompt reading tools prompt path=${toolsPath}`);
  const tools = await promptFileRead(toolsPath, "TOOLS.md");
  logger.debug(`event: buildSystemPrompt reading memory prompt path=${memoryPath}`);
  const memory = await promptFileRead(memoryPath, "MEMORY.md");
  logger.debug("event: buildSystemPrompt reading system template");
  const systemTemplate = await agentPromptBundledRead("SYSTEM.md");
  logger.debug("event: buildSystemPrompt reading permissions template");
  const permissionsTemplate = (await agentPromptBundledRead("PERMISSIONS.md")).trim();
  logger.debug("event: buildSystemPrompt reading agentic template");
  const agenticTemplate = (await agentPromptBundledRead("AGENTIC.md")).trim();

  const additionalWriteDirs = resolveAdditionalWriteDirs(
    context.writeDirs ?? [],
    context.workspace ?? "",
    soulPath,
    userPath,
    agentsPath,
    toolsPath,
    memoryPath
  );

  const isForeground = context.agentKind !== "background";
  const skillsPath =
    context.skillsPath ?? (context.configDir ? `${context.configDir}/skills` : "");

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
    soulPath,
    userPath,
    agentsPath,
    toolsPath,
    memoryPath,
    pluginPrompt: context.pluginPrompt ?? "",
    skillsPrompt: context.skillsPrompt ?? "",
    parentAgentId: context.parentAgentId ?? "",
    configDir: context.configDir ?? "",
    skillsPath,
    isForeground,
    soul,
    user,
    agents,
    tools,
    memory,
    additionalWriteDirs,
    permanentAgentsPrompt: context.permanentAgentsPrompt ?? "",
    agentPrompt: context.agentPrompt ?? "",
    noToolsPrompt: context.noToolsPrompt ?? "",
    features: context.features ?? { noTools: false, rlm: false, say: false }
  };

  logger.debug("event: buildSystemPrompt compiling permissions template");
  const permissions = Handlebars.compile(permissionsTemplate)(templateContext);

  logger.debug("event: buildSystemPrompt compiling agentic template");
  const agentic = Handlebars.compile(agenticTemplate)(templateContext);

  logger.debug("event: buildSystemPrompt compiling main template");
  const template = Handlebars.compile(systemTemplate);
  logger.debug("event: buildSystemPrompt rendering template");
  const rendered = template({
    ...templateContext,
    permissions,
    agentic
  });

  return rendered.trim();
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
