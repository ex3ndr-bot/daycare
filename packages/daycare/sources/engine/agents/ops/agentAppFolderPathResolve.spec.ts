import { describe, expect, it } from "vitest";

import { agentAppFolderPathResolve } from "./agentAppFolderPathResolve.js";

describe("agentAppFolderPathResolve", () => {
    it("returns null for non-app descriptors", () => {
        expect(agentAppFolderPathResolve({ type: "cron", id: "task-id", name: "Task" }, "/workspace")).toBeNull();
    });

    it("resolves app folder path for app descriptors", () => {
        expect(
            agentAppFolderPathResolve(
                {
                    type: "app",
                    id: "agent-1",
                    parentAgentId: "parent-1",
                    name: "GitHub Reviewer",
                    systemPrompt: "prompt",
                    appId: "github-reviewer"
                },
                "/workspace"
            )
        ).toBe("/workspace/apps/github-reviewer");
    });

    it("resolves app folder path from a user apps root when provided", () => {
        expect(
            agentAppFolderPathResolve(
                {
                    type: "app",
                    id: "agent-1",
                    parentAgentId: "parent-1",
                    name: "GitHub Reviewer",
                    systemPrompt: "prompt",
                    appId: "github-reviewer"
                },
                "/workspace",
                "/.daycare/users/u1/apps"
            )
        ).toBe("/.daycare/users/u1/apps/github-reviewer");
    });
});
