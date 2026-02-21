import { promises as fs } from "node:fs";

import { skillListFromRoot } from "./skillListFromRoot.js";
import type { AgentSkill } from "./skillTypes.js";

/**
 * Lists skills from the per-user skills root.
 * Expects: userRoot may be missing; missing roots return an empty list.
 */
export async function skillListUser(userRoot: string): Promise<AgentSkill[]> {
    if (!(await skillRootExists(userRoot))) {
        return [];
    }
    return skillListFromRoot(userRoot, { source: "user", root: userRoot });
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
