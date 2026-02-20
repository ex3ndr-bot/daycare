import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appPermissionStateGrant } from "./appPermissionStateGrant.js";
import { appPermissionStatePathBuild } from "./appPermissionStatePathBuild.js";
import { appPermissionStateRead } from "./appPermissionStateRead.js";

describe("appPermissionStateGrant", () => {
    let appsDir: string;

    beforeEach(async () => {
        appsDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-state-"));
    });

    afterEach(async () => {
        await fs.rm(appsDir, { recursive: true, force: true });
    });

    it("persists shared app permissions in app workspace state.json", async () => {
        await appPermissionStateGrant(appsDir, "github-reviewer", { kind: "workspace" });
        await appPermissionStateGrant(appsDir, "github-reviewer", { kind: "network" });
        await appPermissionStateGrant(appsDir, "github-reviewer", {
            kind: "read",
            path: "/tmp/daycare-app-read"
        });
        await appPermissionStateGrant(appsDir, "github-reviewer", {
            kind: "network"
        });

        const statePath = appPermissionStatePathBuild(appsDir, "github-reviewer");
        const stat = await fs.stat(statePath);
        expect(stat.isFile()).toBe(true);

        const tags = await appPermissionStateRead(appsDir, "github-reviewer");
        expect(tags).toEqual(["@workspace", "@network", "@read:/tmp/daycare-app-read"]);
    });
});
