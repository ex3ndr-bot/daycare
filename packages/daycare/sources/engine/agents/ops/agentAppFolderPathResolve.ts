import path from "node:path";

import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Resolves the app root folder path for app descriptors.
 * Expects: workspaceDir/appsDir is absolute; non-app descriptors return null.
 */
export function agentAppFolderPathResolve(
    descriptor: AgentDescriptor,
    workspaceDir: string,
    appsDir?: string
): string | null {
    if (descriptor.type !== "app") {
        return null;
    }
    if (appsDir) {
        return path.resolve(appsDir, descriptor.appId);
    }
    return path.resolve(workspaceDir, "apps", descriptor.appId);
}
