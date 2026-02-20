import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

const mockedPaths = vi.hoisted(() => ({ userSkillsRoot: "" }));

vi.mock("../../paths.js", () => ({
    get DEFAULT_USER_SKILLS_ROOT() {
        return mockedPaths.userSkillsRoot;
    }
}));

import { skillListUser } from "./skillListUser.js";

describe("skillListUser", () => {
    it("loads skills from ~/.agents/skills", async () => {
        const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-user-skills-"));
        mockedPaths.userSkillsRoot = baseDir;

        try {
            const skillDir = path.join(baseDir, "bridge-builder");
            await fs.mkdir(skillDir, { recursive: true });
            const skillPath = path.join(skillDir, "SKILL.md");
            await fs.writeFile(skillPath, "---\nname: bridge-builder\ndescription: Build bridges\n---\n\nSkill body");

            const skills = await skillListUser();

            expect(skills).toHaveLength(1);
            const skill = skills[0];
            expect(skill?.source).toBe("user");
            expect(skill?.id).toBe("user:bridge-builder");
            expect(skill?.name).toBe("bridge-builder");
            expect(skill?.path).toBe(path.resolve(skillPath));
        } finally {
            await fs.rm(baseDir, { recursive: true, force: true });
        }
    });

    it("returns an empty list when ~/.agents/skills is missing", async () => {
        mockedPaths.userSkillsRoot = path.join(os.tmpdir(), `daycare-user-skills-missing-${Date.now()}`);
        await expect(skillListUser()).resolves.toEqual([]);
    });

    it("loads skills from both system and user roots when userRoot is provided", async () => {
        const systemRoot = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-system-skills-"));
        const userRoot = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-user-scoped-skills-"));
        mockedPaths.userSkillsRoot = systemRoot;

        try {
            const systemSkillDir = path.join(systemRoot, "system-one");
            await fs.mkdir(systemSkillDir, { recursive: true });
            await fs.writeFile(
                path.join(systemSkillDir, "SKILL.md"),
                "---\nname: system-one\ndescription: System skill\n---\n\nSystem body"
            );

            const userSkillDir = path.join(userRoot, "user-two");
            await fs.mkdir(userSkillDir, { recursive: true });
            await fs.writeFile(
                path.join(userSkillDir, "SKILL.md"),
                "---\nname: user-two\ndescription: User skill\n---\n\nUser body"
            );

            const skills = await skillListUser(userRoot);
            const names = skills.map((skill) => skill.name).sort();
            expect(names).toEqual(["system-one", "user-two"]);
        } finally {
            await fs.rm(systemRoot, { recursive: true, force: true });
            await fs.rm(userRoot, { recursive: true, force: true });
        }
    });
});
