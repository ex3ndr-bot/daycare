import { describe, expect, it, vi } from "vitest";

import { AgentInbox } from "./agentInbox.js";

const buildReset = () => ({ type: "reset" as const });
const buildMessage = (text: string, messageId: string, tags: string[] = []) => ({
  type: "message" as const,
  message: { text },
  context: {
    messageId,
    ...(tags.length > 0 ? { permissionTags: tags } : {})
  }
});

describe("AgentInbox", () => {
  it("delivers queued entries in order", async () => {
    const inbox = new AgentInbox("agent-1");
    const first = inbox.post(buildReset());
    const second = inbox.post(buildReset());

    const entry1 = await inbox.next();
    const entry2 = await inbox.next();

    expect(entry1.id).toBe(first.id);
    expect(entry2.id).toBe(second.id);
  });

  it("awaits until an entry is posted", async () => {
    const inbox = new AgentInbox("agent-2");
    const pending = inbox.next();
    const posted = inbox.post(buildReset());
    const entry = await pending;

    expect(entry.id).toBe(posted.id);
  });

  it("allows reattach after detach", () => {
    const inbox = new AgentInbox("agent-3");
    inbox.attach();
    inbox.detach();
    expect(() => inbox.attach()).not.toThrow();
  });

  it("combines queued message items into one inbox entry", async () => {
    const inbox = new AgentInbox("agent-4");
    inbox.post(buildMessage("first", "1", ["@read:/tmp"]));
    const second = inbox.post(buildMessage("second", "2", ["@write:/tmp", "@read:/tmp"]));

    expect(inbox.size()).toBe(1);
    const entry = await inbox.next();
    expect(entry.id).toBe(second.id);
    expect(entry.item.type).toBe("message");
    if (entry.item.type !== "message") {
      throw new Error("Expected merged message entry");
    }
    expect(entry.item.message.text).toBe("first\nsecond");
    expect(entry.item.context).toEqual({
      messageId: "2",
      permissionTags: ["@read:/tmp", "@write:/tmp"]
    });
  });

  it("resolves completion handlers for all merged messages", async () => {
    const inbox = new AgentInbox("agent-5");
    const resolveFirst = vi.fn();
    const resolveSecond = vi.fn();
    const rejectFirst = vi.fn();
    const rejectSecond = vi.fn();
    inbox.post(buildMessage("one", "1"), {
      resolve: resolveFirst,
      reject: rejectFirst
    });
    inbox.post(buildMessage("two", "2"), {
      resolve: resolveSecond,
      reject: rejectSecond
    });

    const entry = await inbox.next();
    entry.completion?.resolve({ type: "message", responseText: "ok" });

    expect(resolveFirst).toHaveBeenCalledWith({ type: "message", responseText: "ok" });
    expect(resolveSecond).toHaveBeenCalledWith({ type: "message", responseText: "ok" });
    expect(rejectFirst).not.toHaveBeenCalled();
    expect(rejectSecond).not.toHaveBeenCalled();
  });
});
