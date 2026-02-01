import type { SessionContext } from "./types.js";

export class Session<State = Record<string, unknown>> {
  readonly id: string;
  readonly storageId: string;
  readonly context: SessionContext<State>;

  constructor(id: string, context: SessionContext<State>, storageId: string) {
    this.id = id;
    this.storageId = storageId;
    this.context = context;
  }

  resetContext(now: Date): void {
    const current = this.context.state as { context?: { messages?: unknown[] } };
    const existingContext =
      current && typeof current === "object" && current.context && typeof current.context === "object"
        ? current.context
        : { messages: [] };
    this.context.state = {
      ...(this.context.state as Record<string, unknown>),
      context: {
        ...(existingContext as Record<string, unknown>),
        messages: []
      }
    } as SessionContext<State>["state"];
    this.context.updatedAt = now;
  }
}
