import path from "node:path";

import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Resolves the app root folder path for app descriptors.
 * Expects: appsDir is absolute; non-app descriptors return null.
 */
export function agentAppFolderPathResolve(descriptor: AgentDescriptor, appsDir: string): string | null {
    if (descriptor.type !== "app") {
        return null;
    }
    return path.resolve(appsDir, descriptor.appId);
}
