import { promises as fs } from "node:fs";

import { DEFAULT_USER_SKILLS_ROOT } from "../../paths.js";
import { skillListFromRoot } from "./skillListFromRoot.js";
import type { AgentSkill } from "./skillTypes.js";

/**
 * Lists skills stored in the shared home-directory skills root.
 *
 * Expects: ~/.agents/skills may be missing; missing roots return an empty list.
 */
export async function skillListUser(userRoot?: string): Promise<AgentSkill[]> {
    const roots = Array.from(
        new Set(
            [DEFAULT_USER_SKILLS_ROOT, userRoot]
                .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
                .map((entry) => entry.trim())
        )
    );
    const skills = await Promise.all(
        roots.map(async (root) => {
            if (!(await skillRootExists(root))) {
                return [] as AgentSkill[];
            }
            return skillListFromRoot(root, { source: "user", root });
        })
    );
    return skills.flat();
}

async function skillRootExists(root: string): Promise<boolean> {
    try {
        const stats = await fs.stat(root);
        return stats.isDirectory();
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") {
            return false;
        }
        throw error;
    }
}
