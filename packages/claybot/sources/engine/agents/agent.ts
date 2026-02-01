import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Context } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import Handlebars from "handlebars";

import { getLogger } from "../../log.js";
import { DEFAULT_SOUL_PATH, DEFAULT_USER_PATH } from "../../paths.js";
import { listActiveInferenceProviders } from "../../providers/catalog.js";
import { cuid2Is } from "../../utils/cuid2Is.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentPromptFilesEnsure } from "./agentPromptFilesEnsure.js";
import type { MessageContext } from "@/types";
import { messageBuildUser } from "../messages/messageBuildUser.js";
import { messageFormatIncoming } from "../messages/messageFormatIncoming.js";
import { messageIsSystemText } from "../messages/messageIsSystemText.js";
import { permissionBuildCron } from "../permissions/permissionBuildCron.js";
import { permissionClone } from "../permissions/permissionClone.js";
import { permissionEnsureDefaultFile } from "../permissions/permissionEnsureDefaultFile.js";
import { permissionMergeDefault } from "../permissions/permissionMergeDefault.js";
import { skillListCore } from "../skills/skillListCore.js";
import { skillListRegistered } from "../skills/skillListRegistered.js";
import { skillPromptFormat } from "../skills/skillPromptFormat.js";
import { Session } from "../sessions/session.js";
import type { SessionDescriptor } from "../sessions/descriptor.js";
import { sessionContextIsCron } from "../sessions/sessionContextIsCron.js";
import { sessionContextIsHeartbeat } from "../sessions/sessionContextIsHeartbeat.js";
import { sessionDescriptorBuild } from "../sessions/sessionDescriptorBuild.js";
import { sessionRecordOutgoing } from "../sessions/sessionRecordOutgoing.js";
import { sessionRecordState } from "../sessions/sessionRecordState.js";
import { sessionStateNormalize } from "../sessions/sessionStateNormalize.js";
import type { SessionState } from "../sessions/sessionStateTypes.js";
import type { SessionMessage } from "@/types";
import { toolListContextBuild } from "../modules/tools/toolListContextBuild.js";
import type {
  AgentDescriptor,
  AgentInboxEntry,
  AgentInboxItem,
  AgentInboxMessage,
  AgentInboxResult,
  AgentInboxReset,
  AgentReceiveResult,
  AgentSystemContext
} from "./agentTypes.js";
import { agentLoopRun } from "./agentLoopRun.js";
import { AgentInbox } from "./agentInbox.js";

const logger = getLogger("engine.agent");

export class Agent {
  readonly session: Session<SessionState>;
  readonly descriptor: SessionDescriptor;
  private agentSystem: AgentSystemContext;
  private sessionStore: AgentSystemContext["sessionStore"];
  private processing = false;

  private constructor(
    session: Session<SessionState>,
    descriptor: SessionDescriptor,
    agentSystem: AgentSystemContext
  ) {
    this.session = session;
    this.descriptor = descriptor;
    this.agentSystem = agentSystem;
    this.sessionStore = agentSystem.sessionStore;
  }

  /**
   * Loads an agent from the session log.
   * Expects: id is a cuid2 session id, and the stored descriptor equals the requested descriptor.
   */
  static async load(
    descriptor: AgentDescriptor,
    id: string,
    agentSystem: AgentSystemContext
  ): Promise<Agent> {
    if (!cuid2Is(id)) {
      throw new Error("Agent session id must be a cuid2 value.");
    }
    const store = agentSystem.sessionStore;
    const restoredSessions = await store.loadSessions();
    const restored = restoredSessions.find((candidate) => candidate.sessionId === id);
    if (!restored) {
      throw new Error(`Agent session not found: ${id}`);
    }
    if (!restored.descriptor) {
      throw new Error(`Agent session missing descriptor: ${id}`);
    }
    if (!agentDescriptorEquals(descriptor, restored.descriptor)) {
      throw new Error(`Agent descriptor mismatch for session: ${id}`);
    }

    const state = sessionStateNormalize(
      restored.state,
      agentSystem.config.defaultPermissions
    );
    state.session = restored.descriptor;

    const now = new Date();
    const session = new Session<SessionState>(
      id,
      {
        id,
        createdAt: restored.createdAt ?? now,
        updatedAt: restored.updatedAt ?? now,
        state
      },
      restored.storageId
    );

    return new Agent(session, restored.descriptor, agentSystem);
  }

  /**
   * Creates a new agent session and records a session_created entry.
   * Expects: id is a cuid2 session id, descriptor is the session type object to persist.
   */
  static async create(
    descriptor: AgentDescriptor,
    id: string,
    agentSystem: AgentSystemContext,
    options?: { source?: string; context?: MessageContext }
  ): Promise<Agent> {
    if (!cuid2Is(id)) {
      throw new Error("Agent session id must be a cuid2 value.");
    }
    const store = agentSystem.sessionStore;
    const storageId = store.createStorageId();
    const now = new Date();
    const state: SessionState = {
      context: { messages: [] },
      providerId: undefined,
      permissions: permissionClone(agentSystem.config.defaultPermissions),
      session: descriptor
    };
    const session = new Session<SessionState>(
      id,
      {
        id,
        createdAt: now,
        updatedAt: now,
        state
      },
      storageId
    );

    const source = options?.source ?? "agent";
    const context = options?.context ?? agentContextBuild(descriptor, id);
    await store.recordSessionCreated(session, source, context, descriptor);
    await store.recordState(session);

    return new Agent(session, descriptor, agentSystem);
  }

  /**
   * Rehydrates an agent from an existing session object.
   * Expects: session already includes descriptor and normalized state.
   */
  static restore(
    session: Session<SessionState>,
    descriptor: SessionDescriptor,
    agentSystem: AgentSystemContext
  ): Agent {
    return new Agent(session, descriptor, agentSystem);
  }

  /**
   * Wraps an existing session for message handling.
   * Expects: session state will be updated with a descriptor if missing.
   */
  static fromMessage(
    session: Session<SessionState>,
    source: string,
    context: MessageContext,
    agentSystem: AgentSystemContext
  ): Agent {
    const descriptor =
      session.context.state.session ?? sessionDescriptorBuild(source, context, session.id);
    if (!session.context.state.session) {
      session.context.state.session = descriptor;
    }
    return new Agent(session, descriptor, agentSystem);
  }

  /**
   * Wraps an existing session that already has a descriptor.
   * Expects: session context includes a session descriptor.
   */
  static fromSession(session: Session<SessionState>, agentSystem: AgentSystemContext): Agent {
    const descriptor = session.context.state.session;
    if (!descriptor) {
      throw new Error(`Agent session missing descriptor: ${session.id}`);
    }
    return new Agent(session, descriptor, agentSystem);
  }

  /**
   * Enqueues a message for the agent session.
   * Expects: inbound context is valid; persistence is queued asynchronously.
   */
  receive(inbound: AgentInboxMessage): AgentReceiveResult {
    const receivedAt = new Date();
    const messageId = createId();
    const context = { ...inbound.context, sessionId: this.session.id };
    const entry: SessionMessage = {
      id: messageId,
      message: messageFormatIncoming(inbound.message, context, receivedAt),
      context,
      receivedAt
    };
    this.session.context.updatedAt = receivedAt;
    const store = this.sessionStore;

    void (async () => {
      try {
        const rawText = entry.message.rawText ?? entry.message.text ?? "";
        if (!messageIsSystemText(rawText)) {
          await store.recordIncoming(this.session, entry, inbound.source);
        }
        await store.recordState(this.session);
      } catch (error) {
        logger.warn({ sessionId: this.session.id, error }, "Agent persistence failed");
      }
    })();

    this.agentSystem.eventBus.emit("session.updated", {
      sessionId: this.session.id,
      source: inbound.source,
      messageId: entry.id,
      entry: {
        id: entry.id,
        message: entry.message,
        context: entry.context,
        receivedAt: entry.receivedAt
      }
    });

    return entry;
  }

  /**
   * Runs the agent loop for messages pulled from the inbox.
   * Expects: inbox is exclusively attached to this agent.
   */
  async run(inbox: AgentInbox): Promise<void> {
    inbox.attach();
    for (;;) {
      const entry = await inbox.next();
      this.processing = true;
      try {
        const result = await this.handleInboxEntry(entry);
        entry.completion?.resolve(result);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        entry.completion?.reject(failure);
      } finally {
        this.processing = false;
      }
    }
  }

  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Processes a queued session message by running the agent loop.
   * Expects: caller already enqueued the message into the session queue.
   */
  async handleMessage(entry: SessionMessage, source: string): Promise<string | null> {
    const session = this.session;
    const agentSystem = this.agentSystem;
    const connectorRegistry = agentSystem.connectorRegistry;
    const connector = connectorRegistry.get(source);

    const textLen = entry.message.text?.length ?? 0;
    const fileCount = entry.message.files?.length ?? 0;
    logger.debug(
      `handleMessage started sessionId=${session.id} messageId=${entry.id} source=${source} hasText=${!!entry.message.text} textLength=${textLen} fileCount=${fileCount}`
    );

    if (!entry.message.text && (!entry.message.files || entry.message.files.length === 0)) {
      logger.debug(
        `handleMessage skipping - no text or files sessionId=${session.id} messageId=${entry.id}`
      );
      return null;
    }

    const isInternal =
      !connector &&
      (source === "system" || entry.context.agent?.kind === "background" || !!entry.context.cron);
    if (!connector && !isInternal) {
      logger.debug(
        `handleMessage skipping - connector not found sessionId=${session.id} source=${source}`
      );
      return null;
    }
    logger.debug(
      `Connector ${connector ? "found" : "not required"} source=${source} internal=${isInternal}`
    );

    if (!session.context.state.session) {
      session.context.state.session = this.descriptor;
    }

    const defaultPermissions = agentSystem.config.defaultPermissions;
    if (entry.context.cron?.filesPath) {
      session.context.state.permissions = permissionBuildCron(
        defaultPermissions,
        entry.context.cron.filesPath
      );
    } else if (sessionContextIsHeartbeat(entry.context, session.context.state.session)) {
      session.context.state.permissions = permissionMergeDefault(
        session.context.state.permissions,
        defaultPermissions
      );
      permissionEnsureDefaultFile(session.context.state.permissions, defaultPermissions);
    }

    await agentPromptFilesEnsure();

    const sessionContext = session.context.state.context;
    const providers = listActiveInferenceProviders(agentSystem.config.settings);
    const providerId = this.resolveSessionProvider(session, entry.context, providers);
    logger.debug(
      `Building context sessionId=${session.id} existingMessageCount=${sessionContext.messages.length}`
    );

    const providerSettings = providerId
      ? providers.find((provider) => provider.id === providerId)
      : providers[0];
    const connectorCapabilities = connector?.capabilities ?? null;
    const fileSendModes = connectorCapabilities?.sendFiles?.modes ?? [];
    const channelType = entry.context.channelType;
    const channelIsPrivate = channelType ? channelType === "private" : null;
    const cronContext = entry.context.cron;
    const cronTaskIds = (await agentSystem.crons.listTasks()).map((task) => task.id);
    const pluginManager = agentSystem.pluginManager;
    const pluginPrompts = await pluginManager.getSystemPrompts();
    const pluginPrompt = pluginPrompts.length > 0 ? pluginPrompts.join("\n\n") : "";
    const coreSkills = await skillListCore();
    const pluginSkills = await skillListRegistered(pluginManager.listRegisteredSkills());
    const skills = [...coreSkills, ...pluginSkills];
    const skillsPrompt = skillPromptFormat(skills);
    const agentKind = session.context.state.agent?.kind ?? entry.context.agent?.kind;
    const allowCronTools = sessionContextIsCron(entry.context, session.context.state.session);
    const systemPrompt = await this.buildSystemPrompt({
      provider: providerSettings?.id,
      model: providerSettings?.model,
      workspace: session.context.state.permissions.workingDir,
      writeDirs: session.context.state.permissions.writeDirs,
      web: session.context.state.permissions.web,
      connector: source,
      canSendFiles: fileSendModes.length > 0,
      fileSendModes: fileSendModes.length > 0 ? fileSendModes.join(", ") : "",
      messageFormatPrompt: connectorCapabilities?.messageFormatPrompt ?? "",
      channelId: entry.context.channelId,
      channelType,
      channelIsPrivate,
      userId: entry.context.userId,
      userFirstName: entry.context.userFirstName,
      userLastName: entry.context.userLastName,
      username: entry.context.username,
      cronTaskId: cronContext?.taskId,
      cronTaskName: cronContext?.taskName,
      cronMemoryPath: cronContext?.memoryPath,
      cronFilesPath: cronContext?.filesPath,
      cronTaskIds: cronTaskIds.length > 0 ? cronTaskIds.join(", ") : "",
      soulPath: DEFAULT_SOUL_PATH,
      userPath: DEFAULT_USER_PATH,
      pluginPrompt,
      skillsPrompt,
      agentKind,
      parentSessionId:
        session.context.state.agent?.parentSessionId ?? entry.context.agent?.parentSessionId,
      configDir: agentSystem.config.configDir
    });
    const context: Context = {
      ...sessionContext,
      tools: this.listContextTools(source, {
        agentKind,
        allowCronTools
      }),
      systemPrompt
    };
    logger.debug(
      `Context built toolCount=${context.tools?.length ?? 0} systemPrompt=${context.systemPrompt ? "set" : "none"}`
    );

    logger.debug("Building user message from entry");
    const userMessage = await messageBuildUser(entry);
    context.messages.push(userMessage);
    logger.debug(`User message added to context totalMessages=${context.messages.length}`);

    const providersForSession = providerId
      ? providers.filter((provider) => provider.id === providerId)
      : [];
    logger.debug(
      `Session provider resolved sessionId=${session.id} providerId=${providerId ?? "none"} providerCount=${providersForSession.length}`
    );

    const result = await agentLoopRun({
      entry,
      session,
      source,
      context,
      connector,
      connectorRegistry,
      inferenceRouter: agentSystem.inferenceRouter,
      toolResolver: agentSystem.toolResolver,
      fileStore: agentSystem.fileStore,
      authStore: agentSystem.authStore,
      sessionStore: this.sessionStore,
      eventBus: agentSystem.eventBus,
      assistant: agentSystem.config.settings.assistant ?? null,
      agentRuntime: agentSystem.agentRuntime,
      providersForSession,
      verbose: agentSystem.config.verbose,
      logger,
      notifySubagentFailure: (reason, error) => this.notifySubagentFailure(reason, error)
    });
    return result.responseText ?? null;
  }

  private async handleInboxEntry(entry: AgentInboxEntry): Promise<AgentInboxResult> {
    const item = entry.item;
    if (item.type === "reset") {
      const ok = await this.handleReset(item);
      return { type: "reset", ok };
    }
    const received = this.receive(item);
    const responseText = await this.handleMessage(received, item.source);
    return { type: "message", responseText };
  }

  private async handleReset(item: AgentInboxReset): Promise<boolean> {
    const now = new Date();
    this.session.resetContext(now);
    try {
      await this.sessionStore.recordSessionReset(this.session, item.source, {
        messageId: item.messageId,
        ok: true
      });
      await this.sessionStore.recordState(this.session);
    } catch (error) {
      logger.warn({ sessionId: this.session.id, error }, "Session reset persistence failed");
      return false;
    }
    this.agentSystem.eventBus.emit("session.reset", {
      sessionId: this.session.id,
      source: item.source,
      context: { channelId: this.session.id, userId: "system", sessionId: this.session.id }
    });
    return true;
  }

  /**
   * Notifies a parent session when a subagent session fails.
   * Expects: agentRuntime can send messages to other sessions.
   */
  async notifySubagentFailure(reason: string, error?: unknown): Promise<void> {
    const descriptor = this.session.context.state.session;
    if (descriptor?.type !== "subagent") {
      return;
    }
    const parentSessionId =
      descriptor.parentSessionId ?? this.session.context.state.agent?.parentSessionId;
    if (!parentSessionId) {
      logger.warn({ sessionId: this.session.id }, "Subagent missing parent session");
      return;
    }
    const name = descriptor.name ?? this.session.context.state.agent?.name ?? "subagent";
    const errorText = error instanceof Error ? error.message : error ? String(error) : "";
    const detail = errorText ? `${reason} (${errorText})` : reason;
    try {
      await this.agentSystem.agentRuntime.sendSessionMessage({
        sessionId: parentSessionId,
        text: `Subagent ${name} (${this.session.id}) failed: ${detail}.`,
        origin: "background"
      });
    } catch (sendError) {
      logger.warn(
        { sessionId: this.session.id, parentSessionId, error: sendError },
        "Subagent failure notification failed"
      );
    }
  }

  /**
   * Builds the system prompt text for the current session.
   * Expects: prompt templates exist under engine/prompts.
   */
  private async buildSystemPrompt(
    context: AgentSystemPromptContext = {}
  ): Promise<string> {
    const soulPath = context.soulPath ?? DEFAULT_SOUL_PATH;
    const userPath = context.userPath ?? DEFAULT_USER_PATH;
    const soul = await promptFileRead(soulPath, "SOUL.md");
    const user = await promptFileRead(userPath, "USER.md");
    const templateName =
      context.agentKind === "background" ? "SYSTEM_BACKGROUND.md" : "SYSTEM.md";
    const systemTemplate = await agentPromptBundledRead(templateName);
    const permissions = (await agentPromptBundledRead("PERMISSIONS.md")).trim();
    const additionalWriteDirs = resolveAdditionalWriteDirs(
      context.writeDirs ?? [],
      context.workspace ?? "",
      soulPath,
      userPath
    );

    const isForeground = context.agentKind !== "background";
    const skillsPath =
      context.skillsPath ?? (context.configDir ? `${context.configDir}/skills` : "");

    const template = Handlebars.compile(systemTemplate);
    const rendered = template({
      date: new Date().toISOString().split("T")[0],
      os: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      model: context.model ?? "unknown",
      provider: context.provider ?? "unknown",
      workspace: context.workspace ?? "unknown",
      web: context.web ?? false,
      connector: context.connector ?? "unknown",
      canSendFiles: context.canSendFiles ?? false,
      fileSendModes: context.fileSendModes ?? "",
      messageFormatPrompt: context.messageFormatPrompt ?? "",
      channelId: context.channelId ?? "unknown",
      channelType: context.channelType ?? "",
      channelIsPrivate: context.channelIsPrivate ?? null,
      userId: context.userId ?? "unknown",
      userFirstName: context.userFirstName ?? "",
      userLastName: context.userLastName ?? "",
      username: context.username ?? "",
      cronTaskId: context.cronTaskId ?? "",
      cronTaskName: context.cronTaskName ?? "",
      cronMemoryPath: context.cronMemoryPath ?? "",
      cronFilesPath: context.cronFilesPath ?? "",
      cronTaskIds: context.cronTaskIds ?? "",
      soulPath,
      userPath,
      pluginPrompt: context.pluginPrompt ?? "",
      skillsPrompt: context.skillsPrompt ?? "",
      parentSessionId: context.parentSessionId ?? "",
      configDir: context.configDir ?? "",
      skillsPath,
      isForeground,
      soul,
      user,
      permissions,
      additionalWriteDirs
    });

    return rendered.trim();
  }

  private listContextTools(
    source?: string,
    options?: { agentKind?: "background" | "foreground"; allowCronTools?: boolean }
  ) {
    return toolListContextBuild({
      tools: this.agentSystem.toolResolver.listTools(),
      source,
      agentKind: options?.agentKind,
      allowCronTools: options?.allowCronTools,
      connectorRegistry: this.agentSystem.connectorRegistry,
      imageRegistry: this.agentSystem.imageRegistry
    });
  }

  private resolveSessionProvider(
    session: Session<SessionState>,
    context: MessageContext,
    providers: ReturnType<typeof listActiveInferenceProviders>
  ): string | undefined {
    const activeIds = new Set(providers.map((provider) => provider.id));

    let providerId = session.context.state.providerId ?? context.providerId;
    if (!providerId || !activeIds.has(providerId)) {
      const fallback =
        context.providerId && activeIds.has(context.providerId)
          ? context.providerId
          : providers[0]?.id;
      providerId = fallback;
    }

    if (providerId && session.context.state.providerId !== providerId) {
      session.context.state.providerId = providerId;
    }

    return providerId;
  }
}

type AgentSystemPromptContext = {
  model?: string;
  provider?: string;
  workspace?: string;
  writeDirs?: string[];
  web?: boolean;
  connector?: string;
  canSendFiles?: boolean;
  fileSendModes?: string;
  messageFormatPrompt?: string;
  channelId?: string;
  channelType?: string;
  channelIsPrivate?: boolean | null;
  userId?: string;
  userFirstName?: string;
  userLastName?: string;
  username?: string;
  cronTaskId?: string;
  cronTaskName?: string;
  cronMemoryPath?: string;
  cronFilesPath?: string;
  cronTaskIds?: string;
  soulPath?: string;
  userPath?: string;
  pluginPrompt?: string;
  skillsPrompt?: string;
  agentKind?: "background" | "foreground";
  parentSessionId?: string;
  configDir?: string;
  skillsPath?: string;
};

function resolveAdditionalWriteDirs(
  writeDirs: string[],
  workspace: string,
  soulPath: string,
  userPath: string
): string[] {
  const excluded = new Set(
    [workspace, soulPath, userPath]
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

function agentDescriptorEquals(
  expected: SessionDescriptor,
  actual: SessionDescriptor
): boolean {
  if (expected.type !== actual.type) {
    return false;
  }
  switch (expected.type) {
    case "user":
      return (
        actual.type === "user" &&
        actual.connector === expected.connector &&
        actual.channelId === expected.channelId &&
        actual.userId === expected.userId
      );
    case "cron":
      return actual.type === "cron" && actual.id === expected.id;
    case "heartbeat":
      return actual.type === "heartbeat";
    case "subagent":
      return (
        actual.type === "subagent" &&
        actual.id === expected.id &&
        actual.parentSessionId === expected.parentSessionId &&
        actual.name === expected.name
      );
    default:
      return false;
  }
}

function agentContextBuild(descriptor: SessionDescriptor, sessionId: string): MessageContext {
  switch (descriptor.type) {
    case "user":
      return {
        channelId: descriptor.channelId,
        userId: descriptor.userId,
        sessionId
      };
    case "cron":
      return {
        channelId: descriptor.id,
        userId: "cron",
        sessionId
      };
    case "heartbeat":
      return {
        channelId: sessionId,
        userId: "heartbeat",
        sessionId,
        heartbeat: {}
      };
    case "subagent":
      return {
        channelId: sessionId,
        userId: "system",
        sessionId,
        agent: {
          kind: "background",
          parentSessionId: descriptor.parentSessionId,
          name: descriptor.name
        }
      };
    default:
      return {
        channelId: sessionId,
        userId: "system",
        sessionId
      };
  }
}
