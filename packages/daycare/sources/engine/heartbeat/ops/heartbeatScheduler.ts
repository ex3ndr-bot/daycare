import { getLogger } from "../../../log.js";
import { stringSlugify } from "../../../utils/stringSlugify.js";
import { taskIdIsSafe } from "../../../utils/taskIdIsSafe.js";
import { permissionClone } from "../../permissions/permissionClone.js";
import { execGateCheck } from "../../scheduling/execGateCheck.js";
import { execGateOutputAppend } from "../../scheduling/execGateOutputAppend.js";
import { gatePermissionsCheck } from "../../scheduling/gatePermissionsCheck.js";
import type { HeartbeatCreateTaskArgs, HeartbeatDefinition, HeartbeatSchedulerOptions } from "../heartbeatTypes.js";

const logger = getLogger("heartbeat.scheduler");

/**
 * Manages interval-based heartbeat task execution.
 *
 * Runs all heartbeat tasks in a single batch at regular intervals.
 */
export class HeartbeatScheduler {
    private config: HeartbeatSchedulerOptions["config"];
    private repository: HeartbeatSchedulerOptions["repository"];
    private intervalMs: number;
    private onRun: HeartbeatSchedulerOptions["onRun"];
    private onError?: HeartbeatSchedulerOptions["onError"];
    private onGatePermissionRequest?: HeartbeatSchedulerOptions["onGatePermissionRequest"];
    private onTaskComplete?: HeartbeatSchedulerOptions["onTaskComplete"];
    private defaultPermissions: HeartbeatSchedulerOptions["defaultPermissions"];
    private resolvePermissions?: HeartbeatSchedulerOptions["resolvePermissions"];
    private gateCheck: HeartbeatSchedulerOptions["gateCheck"];
    private timer: NodeJS.Timeout | null = null;
    private started = false;
    private stopped = false;
    private running = false;
    private nextRunAt: Date | null = null;

    constructor(options: HeartbeatSchedulerOptions) {
        this.config = options.config;
        this.repository = options.repository;
        this.intervalMs = options.intervalMs ?? 30 * 60 * 1000;
        this.onRun = options.onRun;
        this.onError = options.onError;
        this.onGatePermissionRequest = options.onGatePermissionRequest;
        this.onTaskComplete = options.onTaskComplete;
        this.defaultPermissions = options.defaultPermissions;
        this.resolvePermissions = options.resolvePermissions;
        this.gateCheck = options.gateCheck ?? execGateCheck;
        logger.debug("init: HeartbeatScheduler initialized");
    }

    async start(): Promise<void> {
        logger.debug(`start: start() called started=${this.started} stopped=${this.stopped}`);
        if (this.started || this.stopped) {
            return;
        }
        this.started = true;
        this.scheduleNext();
    }

    stop(): void {
        logger.debug(`stop: stop() called stopped=${this.stopped}`);
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        logger.debug("stop: HeartbeatScheduler stopped");
    }

    async runNow(taskIds?: string[]): Promise<{ ran: number; taskIds: string[] }> {
        return this.runOnce(taskIds);
    }

    async listTasks(): Promise<HeartbeatDefinition[]> {
        return this.repository.findMany();
    }

    async createTask(definition: HeartbeatCreateTaskArgs): Promise<HeartbeatDefinition> {
        const title = definition.title.trim();
        const prompt = definition.prompt.trim();
        if (!title) {
            throw new Error("Heartbeat title is required.");
        }
        if (!prompt) {
            throw new Error("Heartbeat prompt is required.");
        }

        const providedId = definition.id?.trim();
        if (providedId && !taskIdIsSafe(providedId)) {
            throw new Error("Heartbeat id contains invalid characters.");
        }

        const taskId = providedId ?? (await this.generateTaskIdFromTitle(title));
        const existing = await this.repository.findById(taskId);
        if (existing && !definition.overwrite) {
            throw new Error(`Heartbeat already exists: ${taskId}`);
        }

        const now = Date.now();
        if (existing) {
            const updated: HeartbeatDefinition = {
                ...existing,
                title,
                prompt,
                gate: definition.gate ?? null,
                updatedAt: now
            };
            await this.repository.update(taskId, updated);
            return heartbeatTaskClone(updated);
        }

        const created: HeartbeatDefinition = {
            id: taskId,
            title,
            prompt,
            gate: definition.gate ?? null,
            lastRunAt: null,
            createdAt: now,
            updatedAt: now
        };
        await this.repository.create(created);
        return heartbeatTaskClone(created);
    }

    async deleteTask(taskId: string): Promise<boolean> {
        if (!taskIdIsSafe(taskId)) {
            throw new Error("Heartbeat id contains invalid characters.");
        }
        return this.repository.delete(taskId);
    }

    getIntervalMs(): number {
        return this.intervalMs;
    }

    getNextRunAt(): Date | null {
        return this.nextRunAt;
    }

    private async generateTaskIdFromTitle(title: string): Promise<string> {
        const base = stringSlugify(title) || "heartbeat";
        const tasks = await this.repository.findMany();
        const existing = new Set(tasks.map((task) => task.id));

        let candidate = base;
        let suffix = 2;
        while (existing.has(candidate)) {
            candidate = `${base}-${suffix}`;
            suffix += 1;
        }
        return candidate;
    }

    private scheduleNext(): void {
        if (this.stopped) {
            return;
        }
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.nextRunAt = new Date(Date.now() + this.intervalMs);
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.tick();
        }, this.intervalMs);
    }

    private async tick(): Promise<void> {
        if (this.stopped) {
            return;
        }
        try {
            await this.runOnce();
        } finally {
            this.scheduleNext();
        }
    }

    private async runOnce(taskIds?: string[]): Promise<{ ran: number; taskIds: string[] }> {
        return this.config.inReadLock(async () => this.runOnceUnlocked(taskIds));
    }

    private async runOnceUnlocked(taskIds?: string[]): Promise<{ ran: number; taskIds: string[] }> {
        if (this.running) {
            logger.debug("skip: HeartbeatScheduler run skipped (already running)");
            return { ran: 0, taskIds: [] };
        }
        this.running = true;
        try {
            const tasks = await this.repository.findMany();
            const filtered = taskIds && taskIds.length > 0 ? tasks.filter((task) => taskIds.includes(task.id)) : tasks;
            if (filtered.length === 0) {
                return { ran: 0, taskIds: [] };
            }
            const basePermissions = (await this.resolvePermissions?.()) ?? this.defaultPermissions;
            const gated = await this.filterByGate(filtered, basePermissions);
            if (gated.length === 0) {
                return { ran: 0, taskIds: [] };
            }
            const runAt = new Date();
            const runAtMs = runAt.getTime();
            const ids = gated.map((task) => task.id);
            logger.info(
                {
                    taskCount: gated.length,
                    taskIds: ids
                },
                "start: Heartbeat run started"
            );
            try {
                await this.onRun(gated, runAt);
            } catch (error) {
                logger.warn({ taskIds: ids, error }, "error: Heartbeat run failed");
                await this.onError?.(error, ids);
            } finally {
                await this.repository.recordRun(runAtMs);
                for (const task of gated) {
                    task.lastRunAt = runAtMs;
                    task.updatedAt = runAtMs;
                    await this.onTaskComplete?.(heartbeatTaskClone(task), runAt);
                }
            }
            logger.info(
                {
                    taskCount: filtered.length,
                    taskIds: ids
                },
                "event: Heartbeat run completed"
            );
            return { ran: gated.length, taskIds: ids };
        } catch (error) {
            logger.warn({ error }, "error: Heartbeat run failed");
            await this.onError?.(error, undefined);
            return { ran: 0, taskIds: [] };
        } finally {
            this.running = false;
        }
    }

    private async filterByGate(
        tasks: HeartbeatDefinition[],
        basePermissions: HeartbeatSchedulerOptions["defaultPermissions"]
    ): Promise<HeartbeatDefinition[]> {
        const eligible: HeartbeatDefinition[] = [];
        for (const task of tasks) {
            if (!task.gate) {
                eligible.push(task);
                continue;
            }
            let permissions = permissionClone(basePermissions);
            let permissionCheck = await gatePermissionsCheck(permissions, task.gate.permissions);
            if (!permissionCheck.allowed) {
                logger.warn(
                    { taskId: task.id, missing: permissionCheck.missing },
                    "event: Heartbeat gate permissions missing; requesting user approval"
                );
                let granted = false;
                try {
                    granted = (await this.onGatePermissionRequest?.(task, permissionCheck.missing)) ?? false;
                } catch (error) {
                    logger.warn({ taskId: task.id, error }, "error: Heartbeat gate permission request failed");
                    await this.onError?.(error, [task.id]);
                    continue;
                }
                if (!granted) {
                    logger.debug(
                        { taskId: task.id, missing: permissionCheck.missing },
                        "skip: Heartbeat skipped because gate permissions were denied or timed out"
                    );
                    continue;
                }

                const refreshedBasePermissions = (await this.resolvePermissions?.()) ?? this.defaultPermissions;
                permissions = permissionClone(refreshedBasePermissions);
                permissionCheck = await gatePermissionsCheck(permissions, task.gate.permissions);
                if (!permissionCheck.allowed) {
                    logger.warn(
                        { taskId: task.id, missing: permissionCheck.missing },
                        "skip: Heartbeat skipped because requested gate permissions are still missing"
                    );
                    continue;
                }
            }
            const result = await this.gateCheck?.({
                gate: task.gate,
                permissions,
                workingDir: permissions.workingDir,
                socketPath: this.config.current.socketPath
            });
            if (!result) {
                eligible.push(task);
                continue;
            }
            if (result.error) {
                logger.warn({ taskId: task.id, error: result.error }, "error: Heartbeat gate failed");
                await this.onError?.(result.error, [task.id]);
                continue;
            }
            if (!result.shouldRun) {
                logger.debug({ taskId: task.id, exitCode: result.exitCode }, "skip: Heartbeat gate skipped execution");
                continue;
            }
            const prompt = execGateOutputAppend(task.prompt, result);
            eligible.push(prompt === task.prompt ? task : { ...task, prompt });
        }
        return eligible;
    }
}

function heartbeatTaskClone(task: HeartbeatDefinition): HeartbeatDefinition {
    return {
        ...task,
        gate: task.gate ? (JSON.parse(JSON.stringify(task.gate)) as HeartbeatDefinition["gate"]) : null
    };
}
