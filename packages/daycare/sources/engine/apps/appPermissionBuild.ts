import { promises as fs } from "node:fs";
import path from "node:path";

import type { SessionPermissions } from "@/types";
import { permissionAccessApply } from "../permissions/permissionAccessApply.js";
import { permissionAccessParse } from "../permissions/permissionAccessParse.js";
import { appPermissionStateRead } from "./appPermissionStateRead.js";

/**
 * Builds locked-down session permissions for an app agent.
 * Expects: appsDir is absolute; appId is a validated app id.
 */
export async function appPermissionBuild(appsDir: string, appId: string): Promise<SessionPermissions> {
    const resolvedAppsDir = path.resolve(appsDir);
    const appDataDir = path.join(resolvedAppsDir, appId, "data");
    await fs.mkdir(appDataDir, { recursive: true });

    const permissions: SessionPermissions = {
        workspaceDir: resolvedAppsDir,
        workingDir: appDataDir,
        writeDirs: [appDataDir],
        readDirs: [resolvedAppsDir],
        network: false,
        events: false
    };

    const sharedPermissions = await appPermissionStateRead(resolvedAppsDir, appId);
    for (const permission of sharedPermissions) {
        permissionAccessApply(permissions, permissionAccessParse(permission));
    }

    return permissions;
}
