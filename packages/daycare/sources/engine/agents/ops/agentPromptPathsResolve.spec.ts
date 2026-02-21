import { describe, expect, it } from "vitest";

import { UserHome } from "../../users/userHome.js";
import { agentPromptPathsResolve } from "./agentPromptPathsResolve.js";

describe("agentPromptPathsResolve", () => {
    it("uses user knowledge paths", () => {
        const userHome = new UserHome("/tmp/daycare/users", "usr_002");
        const resolved = agentPromptPathsResolve(userHome);
        expect(resolved).toEqual(userHome.knowledgePaths());
    });
});
