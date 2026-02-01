import type { PermissionAccess } from "../connectors/types.js";

export function permissionFormatTag(access: PermissionAccess): string {
  if (access.kind === "web") {
    return "@web";
  }
  return `@${access.kind}:${access.path}`;
}
