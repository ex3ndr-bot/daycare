import type { Context, SessionPermissions } from "@/types";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import type { ConfigModule } from "../config/configModule.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import type { PermissionRequestRegistry } from "../modules/tools/permissionRequestRegistry.js";
import { gatePermissionRequest } from "../scheduling/gatePermissionRequest.js";
import type { CronTaskDefinition } from "./cronTypes.js";
import { CronScheduler } from "./ops/cronScheduler.js";

const logger = getLogger("cron.facade");

export type CronsOptions = {
    config: ConfigModule;
    storage: Storage;
    eventBus: EngineEventBus;
    agentSystem: AgentSystem;
    connectorRegistry: ConnectorRegistry;
    permissionRequestRegistry: PermissionRequestRegistry;
};

/**
 * Coordinates cron scheduling for engine runtime.
 * Posts cron task prompts directly to the agent system.
 */
export class Crons {
    private readonly eventBus: EngineEventBus;
    private readonly agentSystem: AgentSystem;
    private readonly scheduler: CronScheduler;
    private readonly storage: Storage;

    constructor(options: CronsOptions) {
        this.eventBus = options.eventBus;
        this.agentSystem = options.agentSystem;
        this.storage = options.storage;
        const currentConfig = options.config.current;
        this.scheduler = new CronScheduler({
            config: options.config,
            repository: this.storage.cronTasks,
            defaultPermissions: currentConfig.defaultPermissions,
            resolvePermissions: async (task) => {
                if (task.agentId) {
                    return this.agentSystem.permissionsForTarget({ agentId: task.agentId });
                }
                const base = currentConfig.defaultPermissions;
                const current = await this.agentSystem.permissionsForTarget({
                    descriptor: { type: "cron", id: task.taskUid, name: task.name }
                });
                return mergeCronPermissions(base, current);
            },
            onTask: async (task, messageContext) => {
                const target = task.agentId
                    ? { agentId: task.agentId }
                    : { descriptor: { type: "system" as const, tag: "cron" } };
                logger.debug(
                    `event: CronScheduler.onTask triggered taskUid=${task.taskUid} agentId=${task.agentId ?? "system:cron"}`
                );

                const permissions = task.agentId
                    ? await this.agentSystem.permissionsForTarget({ agentId: task.agentId })
                    : mergeCronPermissions(
                          currentConfig.defaultPermissions,
                          await this.agentSystem.permissionsForTarget({ descriptor: { type: "system", tag: "cron" } })
                      );
                const targetAgentId = await this.agentSystem.agentIdForTarget(target);
                this.agentSystem.updateAgentPermissions(targetAgentId, permissions, Date.now());

                await this.agentSystem.postAndAwait(target, {
                    type: "system_message",
                    text: cronTaskPromptBuild(task),
                    origin: "cron",
                    execute: true,
                    context: messageContext
                });
            },
            onError: async (error, taskId) => {
                logger.warn({ taskId, error }, "error: Cron task failed");
            },
            onGatePermissionRequest: async (task, missing) => {
                const target = task.agentId
                    ? { agentId: task.agentId }
                    : { descriptor: { type: "cron" as const, id: task.taskUid, name: task.name } };
                const agentId = await this.agentSystem.agentIdForTarget(target);
                const label = task.name ? `cron task "${task.name}" (${task.id})` : `cron task ${task.id}`;
                const result = await gatePermissionRequest({
                    missing,
                    taskLabel: label,
                    agentSystem: this.agentSystem,
                    connectorRegistry: options.connectorRegistry,
                    permissionRequestRegistry: options.permissionRequestRegistry,
                    agentId
                });
                return result.granted;
            },
            onTaskComplete: (task, runAt) => {
                this.eventBus.emit("cron.task.ran", { taskId: task.id, runAt: runAt.toISOString() });
            }
        });
    }

    async start(): Promise<void> {
        await this.scheduler.start();
        this.eventBus.emit("cron.started", { tasks: this.scheduler.listTasks() });
    }

    stop(): void {
        this.scheduler.stop();
    }

    listScheduledTasks() {
        return this.scheduler.listTasks();
    }

    async listTasks() {
        return this.storage.cronTasks.findAll({ includeDisabled: true });
    }

    async addTask(ctx: Context, definition: Omit<CronTaskDefinition, "id" | "userId"> & { id?: string }) {
        const task = await this.scheduler.addTask(ctx, definition);
        this.eventBus.emit("cron.task.added", { task });
        return task;
    }

    async deleteTask(ctx: Context, taskId: string): Promise<boolean> {
        return this.scheduler.deleteTask(ctx, taskId);
    }

    async loadTask(taskId: string) {
        return this.scheduler.loadTask(taskId);
    }
}

function cronTaskPromptBuild(task: { prompt: string; taskId: string; taskUid: string; taskName: string }): string {
    return [
        "[cron]",
        `taskId: ${task.taskId}`,
        `taskUid: ${task.taskUid}`,
        `taskName: ${task.taskName}`,
        "",
        task.prompt
    ].join("\n");
}

function mergeCronPermissions(base: SessionPermissions, current: SessionPermissions): SessionPermissions {
    const writeDirs = new Set([...base.writeDirs, ...current.writeDirs]);
    const readDirs = new Set([...base.readDirs, ...current.readDirs]);
    return {
        workingDir: current.workingDir,
        writeDirs: Array.from(writeDirs.values()),
        readDirs: Array.from(readDirs.values()),
        network: base.network || current.network,
        events: base.events || current.events
    };
}
