import { describe, expect, it } from "vitest";
import type { AgentInboxItem, AgentInboxResult } from "./agentTypes.js";

describe("agentTypes", () => {
    it("allows execute flag on system_message items", () => {
        const messageItem = {
            type: "system_message",
            text: "Run task",
            origin: "cron",
            execute: true,
            context: { messageId: "msg-1" }
        } satisfies AgentInboxItem;

        expect(messageItem.type).toBe("system_message");
        expect(messageItem.execute).toBe(true);
    });

    it("keeps system_message inbox result variant", () => {
        const result = {
            type: "system_message",
            responseText: "ok"
        } satisfies AgentInboxResult;

        expect(result.type).toBe("system_message");
    });
});
