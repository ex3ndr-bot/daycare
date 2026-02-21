import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ToolResolver } from "../modules/toolResolver.js";
import { Apps } from "./appManager.js";

describe("Apps", () => {
    let usersDir: string;

    beforeEach(async () => {
        usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-apps-manager-"));
    });

    afterEach(async () => {
        await fs.rm(usersDir, { recursive: true, force: true });
    });

    it("discovers apps and registers/unregisters app tools", async () => {
        const appDir = path.join(usersDir, "usr_001", "apps", "github-reviewer");
        await fs.mkdir(appDir, { recursive: true });
        await fs.writeFile(
            path.join(appDir, "APP.md"),
            [
                "---",
                "name: github-reviewer",
                "title: GitHub Reviewer",
                "description: Reviews pull requests",
                "---",
                "",
                "## System Prompt",
                "",
                "You are a focused PR review assistant."
            ].join("\n")
        );
        await fs.writeFile(
            path.join(appDir, "PERMISSIONS.md"),
            [
                "## Source Intent",
                "",
                "Review pull requests safely.",
                "",
                "## Rules",
                "",
                "### Allow",
                "- Read files",
                "",
                "### Deny",
                "- Delete files"
            ].join("\n")
        );

        const apps = new Apps({ usersDir });
        const discovered = await apps.discover();
        expect(discovered).toHaveLength(1);
        expect(apps.get("github-reviewer")?.id).toBe("github-reviewer");

        const toolResolver = new ToolResolver();
        apps.registerTools(toolResolver);
        expect(toolResolver.listTools().map((tool) => tool.name)).toContain("app_github_reviewer");

        apps.unregisterTools(toolResolver);
        expect(toolResolver.listTools().map((tool) => tool.name)).not.toContain("app_github_reviewer");
    });

    it("discovers apps from per-user app roots", async () => {
        const appDir = path.join(usersDir, "usr_001", "apps", "research-helper");
        await fs.mkdir(appDir, { recursive: true });
        await fs.writeFile(
            path.join(appDir, "APP.md"),
            [
                "---",
                "name: research-helper",
                "title: Research Helper",
                "description: Helps research topics",
                "---",
                "",
                "## System Prompt",
                "",
                "You are a focused research assistant."
            ].join("\n")
        );
        await fs.writeFile(
            path.join(appDir, "PERMISSIONS.md"),
            [
                "## Source Intent",
                "",
                "Research safely.",
                "",
                "## Rules",
                "",
                "### Allow",
                "- Read files",
                "",
                "### Deny",
                "- Delete files"
            ].join("\n")
        );

        const apps = new Apps({ usersDir });
        const discovered = await apps.discover();
        expect(discovered.map((entry) => entry.id)).toContain("research-helper");
    });
});
