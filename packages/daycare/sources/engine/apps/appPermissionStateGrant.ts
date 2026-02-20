import type { PermissionAccess } from "@/types";
import { permissionFormatTag } from "../permissions/permissionFormatTag.js";
import { appPermissionStateRead } from "./appPermissionStateRead.js";
import { appPermissionStateWrite } from "./appPermissionStateWrite.js";

/**
 * Grants one shared permission tag for an app and persists it in app state.
 * Expects: appsDir/appId point to an installed app workspace.
 */
export async function appPermissionStateGrant(
    appsDir: string,
    appId: string,
    access: PermissionAccess
): Promise<string[]> {
    const current = await appPermissionStateRead(appsDir, appId);
    const next = Array.from(new Set([...current, permissionFormatTag(access)]));
    await appPermissionStateWrite(appsDir, appId, next);
    return next;
}
