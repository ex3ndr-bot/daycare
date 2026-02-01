import path from "node:path";

import { createId } from "@paralleldrive/cuid2";

import { getLogger } from "../../log.js";
import type { FileStore } from "../../files/store.js";
import type { AuthStore } from "../../auth/store.js";
import type {
  AgentRuntime,
  Config,
  ConnectorMessage,
  MessageContext,
  PermissionDecision
} from "@/types";
import { listActiveInferenceProviders } from "../../providers/catalog.js";
import { cuid2Is } from "../../utils/cuid2Is.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import type { ImageGenerationRegistry } from "../modules/imageGenerationRegistry.js";
import type { ToolResolver } from "../modules/toolResolver.js";
import { messageBuildSystemText } from "../messages/messageBuildSystemText.js";
import type { PluginManager } from "../plugins/manager.js";
import type { EngineEventBus } from "../ipc/events.js";
import { SessionStore, type RestoredSession } from "../sessions/store.js";
import type { SessionState } from "../sessions/sessionStateTypes.js";
import {
  normalizeSessionDescriptor,
  sessionDescriptorMatchesStrategy,
  type SessionDescriptor,
  type SessionFetchStrategy
} from "../sessions/descriptor.js";
import { sessionDescriptorBuild } from "../sessions/sessionDescriptorBuild.js";
import { sessionKeyBuild } from "../sessions/sessionKeyBuild.js";
import { sessionKeyResolve } from "../sessions/sessionKeyResolve.js";
import { sessionRoutingSanitize } from "../sessions/sessionRoutingSanitize.js";
import { sessionStateNormalize } from "../sessions/sessionStateNormalize.js";
import { sessionTimestampGet } from "../sessions/sessionTimestampGet.js";
import { Session } from "../sessions/session.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import type { Crons } from "../cron/crons.js";
import { Agent } from "./agent.js";
import { AgentInbox } from "./agentInbox.js";
import { permissionApply } from "../permissions/permissionApply.js";
import { permissionDescribeDecision } from "../permissions/permissionDescribeDecision.js";
import { permissionFormatTag } from "../permissions/permissionFormatTag.js";
import type {
  AgentInboxItem,
  AgentInboxResult,
  AgentPostTarget,
  BackgroundAgentState,
  AgentSystemContext
} from "./agentTypes.js";

const logger = getLogger("engine.agent-system");

type AgentEntry = {
  sessionId: string;
  storageId: string;
  source: string;
  descriptor: SessionDescriptor;
  agent: Agent;
  inbox: AgentInbox;
  running: boolean;
};

type PendingInternalError = {
  sessionId: string;
  source: string;
  context: MessageContext;
};

export type AgentSystemOptions = {
  config: Config;
  eventBus: EngineEventBus;
  connectorRegistry: ConnectorRegistry;
  imageRegistry: ImageGenerationRegistry;
  toolResolver: ToolResolver;
  pluginManager: PluginManager;
  inferenceRouter: InferenceRouter;
  fileStore: FileStore;
  authStore: AuthStore;
  crons: Crons;
  agentRuntime: AgentRuntime;
};

export class AgentSystem implements AgentSystemContext {
  config: Config;
  readonly eventBus: EngineEventBus;
  readonly connectorRegistry: ConnectorRegistry;
  readonly imageRegistry: ImageGenerationRegistry;
  readonly toolResolver: ToolResolver;
  readonly pluginManager: PluginManager;
  readonly inferenceRouter: InferenceRouter;
  readonly fileStore: FileStore;
  readonly authStore: AuthStore;
  readonly sessionStore: SessionStore<SessionState>;
  readonly crons: Crons;
  readonly agentRuntime: AgentRuntime;
  private entries = new Map<string, AgentEntry>();
  private sessionKeyMap = new Map<string, string>();
  private storageIdMap = new Map<string, string>();
  private stage: "idle" | "loaded" | "scheduling" | "running" = "idle";
  private pendingInternalErrors: PendingInternalError[] = [];
  private pendingSubagentFailures: string[] = [];

  constructor(options: AgentSystemOptions) {
    this.config = options.config;
    this.eventBus = options.eventBus;
    this.connectorRegistry = options.connectorRegistry;
    this.imageRegistry = options.imageRegistry;
    this.toolResolver = options.toolResolver;
    this.pluginManager = options.pluginManager;
    this.inferenceRouter = options.inferenceRouter;
    this.fileStore = options.fileStore;
    this.authStore = options.authStore;
    this.crons = options.crons;
    this.agentRuntime = options.agentRuntime;
    this.sessionStore = new SessionStore<SessionState>({
      basePath: `${this.config.dataDir}/sessions`
    });
  }

  async load(): Promise<void> {
    if (this.stage !== "idle") {
      return;
    }
    const restoredSessions = await this.sessionStore.loadSessions();
    for (const restored of restoredSessions) {
      const restoredSessionId = cuid2Is(restored.sessionId ?? null)
        ? restored.sessionId
        : createId();
      const descriptor = this.resolveDescriptor(restored, restoredSessionId);
      if (!descriptor) {
        logger.warn({ sessionId: restored.sessionId }, "Session descriptor missing; skipping restore");
        continue;
      }
      const state = sessionStateNormalize(restored.state, this.config.defaultPermissions);
      state.session = descriptor;
      if (!state.providerId) {
        const providerId = this.resolveProviderId(restored.context);
        if (providerId) {
          state.providerId = providerId;
        }
      }
      const now = new Date();
      const session = new Session<SessionState>(
        restoredSessionId,
        {
          id: restoredSessionId,
          createdAt: restored.createdAt ?? now,
          updatedAt: restored.updatedAt ?? now,
          state
        },
        restored.storageId
      );
      const agent = Agent.restore(session, descriptor, this);
      const entry = this.registerEntry({
        sessionId: restoredSessionId,
        storageId: restored.storageId,
        source: restored.source,
        descriptor,
        agent
      });
      this.captureRouting(session, restored.source, restored.context);
      this.captureAgent(session, restored.context);

      logger.info({ sessionId: session.id, source: restored.source }, "Session restored");

      if (restoredSessionId !== restored.sessionId) {
        void this.sessionStore.recordState(session).catch((error) => {
          logger.warn({ sessionId: session.id, error }, "Session id migration failed");
        });
      }

      if (restored.lastEntryType === "incoming") {
        if (descriptor.type === "subagent") {
          this.pendingSubagentFailures.push(session.id);
        } else {
          this.pendingInternalErrors.push({
            sessionId: session.id,
            source: restored.source,
            context: restored.context
          });
        }
      }

      this.startEntryIfRunning(entry);
    }

    this.stage = "loaded";
  }

  enableScheduling(): void {
    if (this.stage === "idle") {
      throw new Error("AgentSystem must load before scheduling messages");
    }
    if (this.stage === "loaded") {
      this.stage = "scheduling";
    }
  }

  async start(): Promise<void> {
    if (this.stage === "running") {
      return;
    }
    if (this.stage === "idle") {
      throw new Error("AgentSystem must load before starting");
    }
    this.stage = "running";
    for (const entry of this.entries.values()) {
      this.startEntryIfRunning(entry);
    }
    await this.notifyPendingSubagentFailures(this.pendingSubagentFailures);
    await this.sendPendingInternalErrors(this.pendingInternalErrors);
    this.pendingSubagentFailures = [];
    this.pendingInternalErrors = [];
  }

  async scheduleMessage(
    source: string,
    message: ConnectorMessage,
    context: MessageContext
  ): Promise<void> {
    if (this.stage === "idle") {
      logger.warn(
        { source, channelId: context.channelId },
        "AgentSystem received message before load"
      );
    } else if (this.stage === "loaded") {
      logger.debug(
        { source, channelId: context.channelId },
        "AgentSystem queueing message before scheduling enabled"
      );
    }

    const messageContext = this.withProviderContext(context);
    const sessionId = this.resolveSessionIdForMessage(source, messageContext);
    await this.post(
      { sessionId },
      {
        type: "message",
        source,
        message,
        context: { ...messageContext, sessionId }
      }
    );
  }

  async handlePermissionDecision(
    source: string,
    decision: PermissionDecision,
    context: MessageContext
  ): Promise<void> {
    if (!context.channelId) {
      logger.error(
        { source, channelId: context.channelId, userId: context.userId },
        "Permission decision missing channelId"
      );
      return;
    }
    if (!context.userId) {
      logger.warn(
        { source, channelId: context.channelId },
        "Permission decision missing userId"
      );
    }
    const connector = this.connectorRegistry.get(source);
    const permissionTag = permissionFormatTag(decision.access);
    const permissionLabel = permissionDescribeDecision(decision.access);
    const sessionId = this.resolveSessionIdForContext(source, context);

    if (!decision.approved) {
      logger.info(
        { source, permission: permissionTag, sessionId },
        "Permission denied"
      );
    }

    if (!sessionId) {
      logger.warn({ source, permission: permissionTag }, "Permission decision without session id");
      if (connector) {
        await connector.sendMessage(context.channelId, {
          text: `Permission ${decision.approved ? "granted" : "denied"} for ${permissionLabel}.`,
          replyToMessageId: context.messageId
        });
      }
      return;
    }

    const session = this.getSessionById(sessionId);
    if (!session) {
      logger.warn(
        { source, sessionId },
        "Session not found for permission decision"
      );
      if (connector) {
        await connector.sendMessage(context.channelId, {
          text: `Permission ${decision.approved ? "granted" : "denied"} for ${permissionLabel}.`,
          replyToMessageId: context.messageId
        });
      }
      return;
    }

    if (decision.approved && (decision.access.kind === "read" || decision.access.kind === "write")) {
      if (!path.isAbsolute(decision.access.path)) {
        logger.warn({ sessionId: session.id, permission: permissionTag }, "Permission path not absolute");
        if (connector) {
          await connector.sendMessage(context.channelId, {
            text: `Permission ignored (path must be absolute): ${permissionLabel}.`,
            replyToMessageId: context.messageId
          });
        }
        return;
      }
    }

    if (decision.approved) {
      permissionApply(session.context.state.permissions, decision);
      try {
        await this.sessionStore.recordState(session);
      } catch (error) {
        logger.warn({ sessionId: session.id, error }, "Permission persistence failed");
      }

      this.eventBus.emit("permission.granted", {
        sessionId: session.id,
        source,
        decision
      });
    }

    const resumeText = decision.approved
      ? `Permission granted for ${permissionLabel}. Please continue with the previous request.`
      : `Permission denied for ${permissionLabel}. Please continue without that permission.`;
    await this.scheduleMessage(
      source,
      { text: resumeText },
      { ...context, sessionId: session.id }
    );
  }

  async post(target: AgentPostTarget, item: AgentInboxItem): Promise<void> {
    const entry = await this.resolveEntry(target, item);
    entry.inbox.post(item);
    this.startEntryIfRunning(entry);
  }

  async postAndWait(
    target: AgentPostTarget,
    item: AgentInboxItem
  ): Promise<AgentInboxResult> {
    const entry = await this.resolveEntry(target, item);
    const completion = this.createCompletion();
    entry.inbox.post(item, completion.completion);
    this.startEntryIfRunning(entry);
    return completion.promise;
  }

  reload(config: Config): void {
    this.config = config;
  }

  getBackgroundAgents(): BackgroundAgentState[] {
    return Array.from(this.entries.values())
      .filter((entry) => entry.agent.session.context.state.agent?.kind === "background")
      .map((entry) => {
        const pending = entry.inbox.size();
        const processing = entry.agent.isProcessing();
        const status = processing ? "running" : pending > 0 ? "queued" : "idle";
        return {
          sessionId: entry.sessionId,
          storageId: entry.storageId,
          name: entry.agent.session.context.state.agent?.name,
          parentSessionId: entry.agent.session.context.state.agent?.parentSessionId,
          status,
          pending,
          updatedAt: entry.agent.session.context.updatedAt?.toISOString()
        };
      });
  }

  getSessionById(sessionId: string) {
    return this.entries.get(sessionId)?.agent.session ?? null;
  }

  getSessionByStorageId(storageId: string) {
    const sessionId = this.storageIdMap.get(storageId);
    return sessionId ? this.getSessionById(sessionId) : null;
  }

  resetSessionByStorageId(storageId: string): boolean {
    const sessionId = this.storageIdMap.get(storageId);
    if (!sessionId) {
      return false;
    }
    return this.resetSession(sessionId);
  }

  resetSession(sessionId: string): boolean {
    const entry = this.entries.get(sessionId);
    if (!entry) {
      return false;
    }
    void this.post({ sessionId }, { type: "reset", source: "system" });
    return true;
  }

  resolveSessionIdForContext(source: string, context: MessageContext): string | null {
    let sessionId = cuid2Is(context.sessionId ?? null) ? context.sessionId! : null;
    if (!sessionId) {
      const key = sessionKeyResolve(source, context, logger);
      if (key) {
        sessionId = this.sessionKeyMap.get(key) ?? null;
      }
    }
    return sessionId;
  }

  async startBackgroundAgent(args: {
    prompt: string;
    sessionId?: string;
    name?: string;
    parentSessionId?: string;
    context?: Partial<MessageContext>;
  }): Promise<{ sessionId: string }> {
    const prompt = args.prompt.trim();
    if (!prompt) {
      throw new Error("Background agent prompt is required");
    }
    const sessionId = cuid2Is(args.sessionId ?? null) ? args.sessionId! : createId();
    const isSubagent = !args.context?.cron && !args.context?.heartbeat;
    const agentParent = args.parentSessionId ?? args.context?.agent?.parentSessionId;
    const agentName = args.name ?? args.context?.agent?.name ?? (isSubagent ? "subagent" : undefined);
    if (isSubagent && !agentParent) {
      throw new Error("Subagent parent session is required");
    }
    const agentContext = {
      kind: "background" as const,
      parentSessionId: agentParent,
      name: agentName
    };
    const messageContext: MessageContext = {
      channelId: sessionId,
      userId: "system",
      sessionId,
      agent: agentContext,
      ...(args.context ?? {})
    };
    messageContext.channelId = sessionId;
    messageContext.sessionId = sessionId;
    messageContext.agent = { ...agentContext, ...(args.context?.agent ?? {}) };
    const message: ConnectorMessage = { text: prompt };
    const startPromise = this.post(
      { sessionId },
      { type: "message", source: "system", message, context: messageContext }
    );
    startPromise.catch((error) => {
      logger.warn({ sessionId, error }, "Background agent start failed");
    });
    return { sessionId };
  }

  async sendSessionMessage(args: {
    sessionId?: string;
    text: string;
    origin?: "background" | "system";
  }): Promise<void> {
    const targetSessionId = args.sessionId ?? this.resolveSessionId("most-recent-foreground");
    if (!targetSessionId) {
      throw new Error("No recent foreground session found.");
    }
    const session = this.getSessionById(targetSessionId);
    if (!session) {
      throw new Error(`Session not found: ${targetSessionId}`);
    }
    const routing = session.context.state.routing;
    if (!routing) {
      throw new Error(`Session routing unavailable: ${targetSessionId}`);
    }
    const source = routing.source;
    if (!this.connectorRegistry.get(source)) {
      throw new Error(`Connector unavailable for session: ${source}`);
    }
    const context = { ...routing.context, messageId: undefined, commands: undefined };
    const message: ConnectorMessage = {
      text: messageBuildSystemText(args.text, args.origin)
    };
    await this.scheduleMessage(source, message, { ...context, sessionId: session.id });
  }

  withProviderContext(context: MessageContext): MessageContext {
    const providerId = this.resolveProviderId(context);
    if (!providerId || context.providerId === providerId) {
      return context;
    }
    return { ...context, providerId };
  }

  resolveSessionId(strategy: SessionFetchStrategy): string | null {
    const candidates = Array.from(this.entries.values()).filter((entry) => {
      return sessionDescriptorMatchesStrategy(entry.descriptor, strategy);
    });
    if (candidates.length === 0) {
      return null;
    }
    candidates.sort((a, b) => {
      const aTime = sessionTimestampGet(
        a.agent.session.context.updatedAt ?? a.agent.session.context.createdAt
      );
      const bTime = sessionTimestampGet(
        b.agent.session.context.updatedAt ?? b.agent.session.context.createdAt
      );
      return bTime - aTime;
    });
    return candidates[0]?.sessionId ?? null;
  }

  getOrCreateSessionIdForDescriptor(descriptor: SessionDescriptor): string {
    const key = sessionKeyBuild(descriptor);
    if (key) {
      return this.getOrCreateSessionId(key);
    }
    if (descriptor.type === "subagent" && cuid2Is(descriptor.id)) {
      return descriptor.id;
    }
    return createId();
  }

  private resolveDescriptor(
    restored: RestoredSession<SessionState>,
    sessionId: string
  ): SessionDescriptor | null {
    const normalized = restored.descriptor
      ? normalizeSessionDescriptor(restored.descriptor)
      : undefined;
    if (normalized) {
      return normalized;
    }
    try {
      return sessionDescriptorBuild(restored.source, restored.context, sessionId);
    } catch (error) {
      logger.warn({ sessionId, error }, "Failed to build session descriptor");
      return null;
    }
  }

  private registerEntry(input: {
    sessionId: string;
    storageId: string;
    source: string;
    descriptor: SessionDescriptor;
    agent: Agent;
  }): AgentEntry {
    const inbox = new AgentInbox(input.sessionId);
    const entry: AgentEntry = {
      sessionId: input.sessionId,
      storageId: input.storageId,
      source: input.source,
      descriptor: input.descriptor,
      agent: input.agent,
      inbox,
      running: false
    };
    this.entries.set(input.sessionId, entry);
    this.storageIdMap.set(input.storageId, input.sessionId);
    const key = sessionKeyBuild(input.descriptor);
    if (key) {
      this.sessionKeyMap.set(key, input.sessionId);
    }
    return entry;
  }

  private startEntryIfRunning(entry: AgentEntry): void {
    if (this.stage !== "running" || entry.running) {
      return;
    }
    entry.running = true;
    void entry.agent.run(entry.inbox).catch((error) => {
      entry.running = false;
      logger.warn({ sessionId: entry.sessionId, error }, "Agent loop exited unexpectedly");
    });
  }

  private resolveSessionIdForMessage(source: string, context: MessageContext): string {
    const key = sessionKeyResolve(source, context, logger);
    const cronTaskUid = cuid2Is(context.cron?.taskUid ?? null)
      ? context.cron!.taskUid
      : null;
    const explicitId = cuid2Is(context.sessionId ?? null) ? context.sessionId! : cronTaskUid;
    if (explicitId) {
      if (key) {
        this.sessionKeyMap.set(key, explicitId);
      }
      return explicitId;
    }
    if (key) {
      return this.getOrCreateSessionId(key);
    }
    if (source && source !== "system" && source !== "cron" && source !== "background") {
      throw new Error("userId is required to map sessions for connectors.");
    }
    return createId();
  }

  private async resolveEntry(
    target: AgentPostTarget,
    item: AgentInboxItem
  ): Promise<AgentEntry> {
    if ("sessionId" in target) {
      const existing = this.entries.get(target.sessionId);
      if (existing) {
        if (item.type === "message") {
          this.prepareSessionForMessage(existing.agent.session, item.source, item.context);
        }
        return existing;
      }
      const restored = await this.restoreBySessionId(target.sessionId);
      if (restored) {
        const entry = this.registerEntry(restored);
        if (item.type === "message") {
          this.prepareSessionForMessage(entry.agent.session, item.source, item.context);
        }
        return entry;
      }
      if (item.type !== "message") {
        throw new Error(`Agent session not found: ${target.sessionId}`);
      }
      const descriptor = sessionDescriptorBuild(item.source, item.context, target.sessionId);
      const agent = await Agent.create(descriptor, target.sessionId, this, {
        source: item.source,
        context: item.context
      });
      const entry = this.registerEntry({
        sessionId: target.sessionId,
        storageId: agent.session.storageId,
        source: item.source,
        descriptor,
        agent
      });
      this.prepareSessionForMessage(entry.agent.session, item.source, item.context);
      this.eventBus.emit("session.created", {
        sessionId: agent.session.id,
        source: item.source,
        context: item.context
      });
      return entry;
    }

    const descriptor = target.descriptor;
    const key = sessionKeyBuild(descriptor);
    if (key) {
      const sessionId = this.sessionKeyMap.get(key);
      if (sessionId) {
        const existing = this.entries.get(sessionId);
        if (existing) {
          if (item.type === "message") {
            this.prepareSessionForMessage(existing.agent.session, item.source, item.context);
          }
          return existing;
        }
      }
    }

    const sessionId = descriptor.type === "subagent" && cuid2Is(descriptor.id)
      ? descriptor.id
      : createId();
    const agent = await Agent.create(descriptor, sessionId, this, {
      source: item.type === "message" ? item.source : undefined,
      context: item.type === "message" ? item.context : undefined
    });
    const entry = this.registerEntry({
      sessionId,
      storageId: agent.session.storageId,
      source: "agent",
      descriptor,
      agent
    });
    const messageSource = item.type === "message" ? item.source : "agent";
    const messageContext = item.type === "message" ? item.context : undefined;
    this.prepareSessionForMessage(agent.session, messageSource, messageContext);
    this.eventBus.emit("session.created", {
      sessionId: agent.session.id,
      source: messageSource,
      context:
        messageContext ??
        { channelId: agent.session.id, userId: "system", sessionId: agent.session.id }
    });
    return entry;
  }

  private async restoreBySessionId(sessionId: string): Promise<{
    sessionId: string;
    storageId: string;
    source: string;
    descriptor: SessionDescriptor;
    agent: Agent;
  } | null> {
    const restoredSessions = await this.sessionStore.loadSessions();
    const restored = restoredSessions.find((candidate) => candidate.sessionId === sessionId);
    if (!restored) {
      return null;
    }
    const descriptor = this.resolveDescriptor(restored, sessionId);
    if (!descriptor) {
      return null;
    }
    const state = sessionStateNormalize(restored.state, this.config.defaultPermissions);
    state.session = descriptor;
    if (!state.providerId) {
      const providerId = this.resolveProviderId(restored.context);
      if (providerId) {
        state.providerId = providerId;
      }
    }
    const now = new Date();
    const session = new Session<SessionState>(
      sessionId,
      {
        id: sessionId,
        createdAt: restored.createdAt ?? now,
        updatedAt: restored.updatedAt ?? now,
        state
      },
      restored.storageId
    );
    return {
      sessionId,
      storageId: restored.storageId,
      source: restored.source,
      descriptor,
      agent: Agent.restore(session, descriptor, this)
    };
  }

  private prepareSessionForMessage(
    session: Session<SessionState>,
    source: string,
    context?: MessageContext
  ): void {
    if (!context) {
      return;
    }
    this.captureRouting(session, source, context);
    this.captureAgent(session, context);
    if (!session.context.state.providerId) {
      const providerId = this.resolveProviderId(context);
      if (providerId) {
        session.context.state.providerId = providerId;
      }
    }
    if (!session.context.state.session) {
      session.context.state.session = sessionDescriptorBuild(source, context, session.id);
    }
  }

  private resolveProviderId(context: MessageContext): string | undefined {
    if (context.providerId) {
      return context.providerId;
    }
    const providers = listActiveInferenceProviders(this.config.settings);
    return providers[0]?.id;
  }

  private captureRouting(
    session: Session<SessionState>,
    source: string,
    context: MessageContext
  ): void {
    session.context.state.routing = {
      source,
      context: sessionRoutingSanitize(context)
    };
  }

  private captureAgent(
    session: Session<SessionState>,
    context: MessageContext
  ): void {
    if (context.agent?.kind === "background") {
      session.context.state.agent = {
        kind: "background",
        parentSessionId: context.agent.parentSessionId,
        name: context.agent.name
      };
    }
  }

  private async notifyPendingSubagentFailures(sessionIds: string[]): Promise<void> {
    for (const sessionId of sessionIds) {
      const entry = this.entries.get(sessionId);
      if (!entry) {
        continue;
      }
      await entry.agent.notifySubagentFailure("Restored with pending work");
    }
  }

  private async sendPendingInternalErrors(
    pending: Array<{
      sessionId: string;
      source: string;
      context: MessageContext;
    }>
  ): Promise<void> {
    const message = "Internal error.";
    for (const entry of pending) {
      const connector = this.connectorRegistry.get(entry.source);
      if (!connector) {
        continue;
      }
      try {
        await connector.sendMessage(entry.context.channelId, {
          text: message,
          replyToMessageId: entry.context.messageId
        });
      } catch (error) {
        logger.warn({ sessionId: entry.sessionId, source: entry.source, error }, "Pending reply failed");
      }
    }
  }

  private createCompletion(): {
    promise: Promise<AgentInboxResult>;
    completion: {
      resolve: (result: AgentInboxResult) => void;
      reject: (error: Error) => void;
    };
  } {
    let resolve: ((result: AgentInboxResult) => void) | null = null;
    let reject: ((error: Error) => void) | null = null;
    const promise = new Promise<AgentInboxResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return {
      promise,
      completion: {
        resolve: (result) => resolve?.(result),
        reject: (error) => reject?.(error)
      }
    };
  }

  private getOrCreateSessionId(key: string): string {
    const existing = this.sessionKeyMap.get(key);
    if (existing) {
      return existing;
    }
    const id = createId();
    this.sessionKeyMap.set(key, id);
    return id;
  }
}
