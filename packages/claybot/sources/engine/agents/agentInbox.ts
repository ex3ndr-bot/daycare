import { createId } from "@paralleldrive/cuid2";

import type { AgentInboxCompletion, AgentInboxEntry, AgentInboxItem } from "./agentTypes.js";

/**
 * AgentInbox is a single-consumer queue for agent work items.
 * Expects: only one agent attaches to an inbox at a time.
 */
export class AgentInbox {
  readonly sessionId: string;
  private items: AgentInboxEntry[] = [];
  private waiters: Array<(entry: AgentInboxEntry) => void> = [];
  private attached = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  attach(): void {
    if (this.attached) {
      throw new Error(`AgentInbox already attached: ${this.sessionId}`);
    }
    this.attached = true;
  }

  post(item: AgentInboxItem, completion?: AgentInboxCompletion): AgentInboxEntry {
    const entry: AgentInboxEntry = {
      id: createId(),
      postedAt: Date.now(),
      item,
      completion
    };
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(entry);
      return entry;
    }
    this.items.push(entry);
    return entry;
  }

  async next(): Promise<AgentInboxEntry> {
    const next = this.items.shift();
    if (next) {
      return next;
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  size(): number {
    return this.items.length;
  }

  listPending(): AgentInboxEntry[] {
    return [...this.items];
  }
}
