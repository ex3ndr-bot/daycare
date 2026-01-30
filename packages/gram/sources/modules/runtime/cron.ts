import type {
  ConnectorMessage,
  MessageContext
} from "../../engine/connectors/types.js";
import { getLogger } from "../../log.js";

const logger = getLogger("cron.scheduler");

export type CronTaskConfig = {
  id?: string;
  everyMs: number;
  message?: string;
  channelId?: string;
  sessionId?: string;
  userId?: string | null;
  source?: string;
  enabled?: boolean;
  runOnStart?: boolean;
  once?: boolean;
  action?: string;
  payload?: Record<string, unknown>;
};

export type CronAction = (
  task: CronTaskConfig,
  context: MessageContext
) => void | Promise<void>;

export type CronSchedulerOptions = {
  tasks: CronTaskConfig[];
  onMessage: (
    message: ConnectorMessage,
    context: MessageContext,
    task: CronTaskConfig
  ) => void | Promise<void>;
  actions?: Record<string, CronAction>;
  onError?: (error: unknown, task: CronTaskConfig) => void | Promise<void>;
};

type CronTask = Required<Pick<CronTaskConfig, "id" | "everyMs">> &
  CronTaskConfig;

export class CronScheduler {
  private tasks: CronTask[];
  private timers = new Map<string, NodeJS.Timeout>();
  private started = false;
  private stopped = false;
  private taskCounter = 0;
  private onMessage: CronSchedulerOptions["onMessage"];
  private actions: Record<string, CronAction>;
  private onError?: CronSchedulerOptions["onError"];

  constructor(options: CronSchedulerOptions) {
    this.tasks = CronScheduler.normalizeTasks(options.tasks);
    this.taskCounter = CronScheduler.seedTaskCounter(this.tasks);
    this.onMessage = options.onMessage;
    this.actions = options.actions ?? {};
    this.onError = options.onError;
    logger.debug(`CronScheduler initialized taskCount=${this.tasks.length} actionCount=${Object.keys(this.actions).length}`);
  }

  start(): void {
    logger.debug(`start() called started=${this.started} stopped=${this.stopped}`);
    if (this.started || this.stopped) {
      logger.debug("Already started or stopped, returning");
      return;
    }

    this.started = true;
    logger.debug(`Scheduling tasks taskCount=${this.tasks.length}`);

    for (const task of this.tasks) {
      if (task.enabled === false) {
        logger.debug(`Task disabled, skipping taskId=${task.id}`);
        continue;
      }

      this.scheduleTask(task);
    }
    logger.debug("All tasks scheduled");
  }

  stop(): void {
    logger.debug(`stop() called stopped=${this.stopped}`);
    if (this.stopped) {
      logger.debug("Already stopped, returning");
      return;
    }

    this.stopped = true;
    logger.debug(`Clearing timers timerCount=${this.timers.size}`);
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    logger.debug("CronScheduler stopped");
  }

  addTask(task: CronTaskConfig): CronTask {
    logger.debug(`addTask() called taskId=${task.id} everyMs=${task.everyMs} action=${task.action}`);
    const normalized = this.normalizeTask(task);

    if (this.tasks.some((existing) => existing.id === normalized.id)) {
      logger.debug(`Task already exists taskId=${normalized.id}`);
      throw new Error(`Cron task already exists: ${normalized.id}`);
    }

    this.tasks.push(normalized);
    logger.debug(`Task added taskId=${normalized.id} totalTasks=${this.tasks.length}`);

    if (this.started && !this.stopped && normalized.enabled !== false) {
      logger.debug(`Scheduling newly added task taskId=${normalized.id}`);
      this.scheduleTask(normalized);
    }

    return normalized;
  }

  listTasks(): CronTaskConfig[] {
    return this.tasks.map((task) => ({ ...task }));
  }

  private async dispatchTask(task: CronTask): Promise<void> {
    logger.debug(`dispatchTask() called taskId=${task.id} stopped=${this.stopped}`);
    if (this.stopped) {
      logger.debug("Scheduler stopped, not dispatching");
      return;
    }

    const context: MessageContext = {
      channelId: task.channelId ?? task.sessionId ?? `cron:${task.id}`,
      userId: task.userId ?? null,
      sessionId: task.sessionId
    };
    logger.debug(`Built message context taskId=${task.id} channelId=${context.channelId} sessionId=${context.sessionId}`);

    if (task.action) {
      logger.debug(`Dispatching action task taskId=${task.id} action=${task.action}`);
      const handler = this.actions[task.action];
      if (!handler) {
        logger.debug(`Action handler not found taskId=${task.id} action=${task.action}`);
        await this.reportError(
          new Error(`Missing cron action handler: ${task.action}`),
          task
        );
        return;
      }
      logger.debug(`Calling action handler taskId=${task.id} action=${task.action}`);
      await handler(task, context);
      logger.debug(`Action handler completed taskId=${task.id}`);
      return;
    }

    if (typeof task.message !== "string") {
      logger.debug(`No message for task taskId=${task.id}`);
      await this.reportError(
        new Error(`Missing message for cron task ${task.id}`),
        task
      );
      return;
    }

    const message: ConnectorMessage = {
      text: task.message
    };

    logger.debug(`Dispatching message task taskId=${task.id} messageLength=${task.message.length}`);
    await this.onMessage(message, context, task);
    logger.debug(`Message task dispatched taskId=${task.id}`);
  }

  private async reportError(
    error: unknown,
    task: CronTaskConfig
  ): Promise<void> {
    if (!this.onError) {
      return;
    }
    await this.onError(error, task);
  }

  private scheduleTask(task: CronTask): void {
    logger.debug(`scheduleTask() called taskId=${task.id} everyMs=${task.everyMs} once=${task.once} runOnStart=${task.runOnStart}`);
    if (!this.isValidInterval(task.everyMs)) {
      logger.debug(`Invalid interval taskId=${task.id} everyMs=${task.everyMs}`);
      void this.reportError(
        new Error(`Invalid interval for task ${task.id}`),
        task
      );
      return;
    }

    if (task.runOnStart) {
      logger.debug(`Running task on start taskId=${task.id}`);
      void this.dispatchTask(task);
    }

    if (task.once) {
      if (!task.runOnStart) {
        logger.debug(`Scheduling one-time task taskId=${task.id} delayMs=${task.everyMs}`);
        const timer = setTimeout(() => {
          logger.debug(`One-time task timer fired taskId=${task.id}`);
          void this.dispatchTask(task).finally(() => {
            this.timers.delete(task.id);
            logger.debug(`One-time task timer removed taskId=${task.id}`);
          });
        }, task.everyMs);
        this.timers.set(task.id, timer);
      }
    } else {
      logger.debug(`Scheduling recurring task taskId=${task.id} intervalMs=${task.everyMs}`);
      const timer = setInterval(() => {
        logger.debug(`Recurring task timer fired taskId=${task.id}`);
        void this.dispatchTask(task);
      }, task.everyMs);
      this.timers.set(task.id, timer);
    }
    logger.debug(`Task scheduled taskId=${task.id} timerCount=${this.timers.size}`);
  }

  private isValidInterval(value: number): boolean {
    return Number.isFinite(value) && value > 0;
  }

  private normalizeTask(task: CronTaskConfig): CronTask {
    return {
      ...task,
      id: task.id ?? this.nextTaskId(),
      everyMs: task.everyMs
    };
  }

  private nextTaskId(): string {
    let candidate = this.taskCounter + 1;
    let id = `task-${candidate}`;

    while (this.tasks.some((task) => task.id === id)) {
      candidate += 1;
      id = `task-${candidate}`;
    }

    this.taskCounter = candidate;
    return id;
  }

  private static normalizeTasks(tasks: CronTaskConfig[]): CronTask[] {
    return tasks.map((task, index) => ({
      ...task,
      id: task.id ?? `task-${index + 1}`,
      everyMs: task.everyMs
    }));
  }

  private static seedTaskCounter(tasks: CronTask[]): number {
    let max = 0;
    for (const task of tasks) {
      const match = /^task-(\d+)$/.exec(task.id);
      if (match) {
        const value = Number(match[1]);
        if (Number.isFinite(value) && value > max) {
          max = value;
        }
      }
    }
    return Math.max(max, tasks.length);
  }
}
