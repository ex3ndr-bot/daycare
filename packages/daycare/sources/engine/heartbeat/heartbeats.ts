import { createId } from "@paralleldrive/cuid2";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import type { ConfigModule } from "../config/configModule.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import type { PermissionRequestRegistry } from "../modules/tools/permissionRequestRegistry.js";
import { gatePermissionRequest } from "../scheduling/gatePermissionRequest.js";
import type { HeartbeatCreateTaskArgs, HeartbeatDefinition } from "./heartbeatTypes.js";
import { heartbeatPromptBuildBatch } from "./ops/heartbeatPromptBuildBatch.js";
import { HeartbeatScheduler } from "./ops/heartbeatScheduler.js";

const logger = getLogger("heartbeat.facade");

export type HeartbeatsOptions = {
    config: ConfigModule;
    storage: Storage;
    eventBus: EngineEventBus;
    agentSystem: AgentSystem;
    connectorRegistry: ConnectorRegistry;
    permissionRequestRegistry: PermissionRequestRegistry;
    intervalMs?: number;
};

/**
 * Coordinates heartbeat scheduling for engine runtime.
 * Posts heartbeat prompts directly to the agent system.
 */
export class Heartbeats {
    private readonly eventBus: EngineEventBus;
    private readonly agentSystem: AgentSystem;
    private readonly scheduler: HeartbeatScheduler;

    constructor(options: HeartbeatsOptions) {
        this.eventBus = options.eventBus;
        this.agentSystem = options.agentSystem;
        const currentConfig = options.config.current;
        this.scheduler = new HeartbeatScheduler({
            config: options.config,
            repository: options.storage.heartbeatTasks,
            intervalMs: options.intervalMs,
            defaultPermissions: currentConfig.defaultPermissions,
            resolvePermissions: async () =>
                this.agentSystem.permissionsForTarget({
                    descriptor: { type: "system", tag: "heartbeat" }
                }),
            onRun: async (tasks) => {
                const target = { descriptor: { type: "system" as const, tag: "heartbeat" } };
                const targetAgentId = await this.agentSystem.agentIdForTarget(target);
                const permissions = await this.agentSystem.permissionsForTarget(target);
                this.agentSystem.updateAgentPermissions(targetAgentId, permissions, Date.now());
                const tasksByUserId = new Map<string, HeartbeatDefinition[]>();
                for (const task of tasks) {
                    const bucket = tasksByUserId.get(task.userId) ?? [];
                    bucket.push(task);
                    tasksByUserId.set(task.userId, bucket);
                }
                for (const [userId, userTasks] of tasksByUserId.entries()) {
                    const batch = heartbeatPromptBuildBatch(userTasks);
                    await this.agentSystem.postAndAwait(target, {
                        type: "signal",
                        subscriptionPattern: "internal.heartbeat.tick",
                        signal: {
                            id: createId(),
                            type: "internal.heartbeat.tick",
                            source: { type: "system", userId },
                            createdAt: Date.now(),
                            data: {
                                prompt: batch.prompt,
                                userId,
                                tasks: userTasks.map((task) => ({
                                    id: task.id,
                                    title: task.title,
                                    prompt: task.prompt
                                }))
                            }
                        }
                    });
                }
            },
            onError: async (error, taskIds) => {
                logger.warn({ taskIds, error }, "error: Heartbeat task failed");
            },
            onGatePermissionRequest: async (task, missing) => {
                const label = task.title ? `heartbeat task "${task.title}" (${task.id})` : `heartbeat task ${task.id}`;
                const target = { descriptor: { type: "system" as const, tag: "heartbeat" } };
                const agentId = await this.agentSystem.agentIdForTarget(target);
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
                this.eventBus.emit("heartbeat.task.ran", { taskId: task.id, runAt: runAt.toISOString() });
            }
        });
    }

    async start(): Promise<void> {
        await this.scheduler.start();
        const tasks = await this.listTasks();
        this.eventBus.emit("heartbeat.started", { tasks });
        if (tasks.length === 0) {
            logger.info("event: No heartbeat tasks found on boot.");
            return;
        }
        const withLastRun = tasks.filter((task) => typeof task.lastRunAt === "number");
        const missingLastRun = tasks.filter((task) => typeof task.lastRunAt !== "number");
        if (withLastRun.length > 0) {
            const mostRecent = Math.max(...withLastRun.map((task) => task.lastRunAt ?? 0));
            logger.info(
                {
                    taskCount: tasks.length,
                    mostRecentRunAt: new Date(mostRecent).toISOString()
                },
                "load: Heartbeat last run loaded on boot"
            );
        }
        if (missingLastRun.length > 0) {
            logger.info(
                {
                    taskCount: missingLastRun.length,
                    taskIds: missingLastRun.map((task) => task.id)
                },
                "event: Heartbeat missing last run info; running now"
            );
            await this.runNow({ ids: missingLastRun.map((task) => task.id) });
        }
        const nextRunAt = this.scheduler.getNextRunAt() ?? new Date(Date.now() + this.scheduler.getIntervalMs());
        logger.info({ nextRunAt: nextRunAt.toISOString() }, "schedule: Next heartbeat run scheduled");
    }

    stop(): void {
        this.scheduler.stop();
    }

    async listTasks(): Promise<HeartbeatDefinition[]> {
        return this.scheduler.listTasks();
    }

    async runNow(args?: { ids?: string[] }): Promise<{ ran: number; taskIds: string[] }> {
        return this.scheduler.runNow(args?.ids);
    }

    async addTask(args: HeartbeatCreateTaskArgs): Promise<HeartbeatDefinition> {
        return this.scheduler.createTask(args);
    }

    async removeTask(taskId: string): Promise<boolean> {
        return this.scheduler.deleteTask(taskId);
    }
}
