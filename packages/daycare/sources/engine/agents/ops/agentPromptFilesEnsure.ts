import { promises as fs } from "node:fs";
import path from "node:path";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";

export type AgentPromptFilesPaths = {
    soulPath: string;
    userPath: string;
    agentsPath: string;
    toolsPath: string;
};

/**
 * Ensures the default prompt files (SOUL, USER, AGENTS, TOOLS) exist on disk.
 * Expects: caller wants bundled defaults written when missing.
 */
export async function agentPromptFilesEnsure(paths: AgentPromptFilesPaths): Promise<void> {
    await promptFileEnsure(paths.soulPath, "SOUL.md");
    await promptFileEnsure(paths.userPath, "USER.md");
    await promptFileEnsure(paths.agentsPath, "AGENTS.md");
    await promptFileEnsure(paths.toolsPath, "TOOLS.md");
}

async function promptFileEnsure(filePath: string, bundledName: string): Promise<void> {
    const resolvedPath = path.resolve(filePath);
    try {
        await fs.access(resolvedPath);
        return;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }

    const content = await agentPromptBundledRead(bundledName);
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, content, "utf8");
}
