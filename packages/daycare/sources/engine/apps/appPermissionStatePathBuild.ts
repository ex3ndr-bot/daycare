import path from "node:path";

/**
 * Builds the app permission state file path under the app workspace.
 * Expects: appsDir is absolute; appId is a validated app id.
 */
export function appPermissionStatePathBuild(appsDir: string, appId: string): string {
    return path.join(path.resolve(appsDir), appId, "state.json");
}
