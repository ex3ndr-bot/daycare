import path from "node:path";

import { describe, expect, it } from "vitest";

import { UserHome } from "../../users/userHome.js";
import { agentPromptPathsResolve } from "./agentPromptPathsResolve.js";

describe("agentPromptPathsResolve", () => {
    it("resolves prompt files under dataDir when provided", () => {
        const dataDir = "/tmp/daycare-data";
        expect(agentPromptPathsResolve(dataDir)).toEqual({
            soulPath: path.join(dataDir, "SOUL.md"),
            userPath: path.join(dataDir, "USER.md"),
            agentsPath: path.join(dataDir, "AGENTS.md"),
            toolsPath: path.join(dataDir, "TOOLS.md"),
            memoryPath: path.join(dataDir, "MEMORY.md")
        });
    });

    it("uses user knowledge paths when userHome is provided", () => {
        const userHome = new UserHome("/tmp/daycare/users", "usr_002");
        const resolved = agentPromptPathsResolve("/tmp/daycare-data", userHome);
        expect(resolved).toEqual(userHome.knowledgePaths());
    });
});
