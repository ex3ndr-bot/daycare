import type { PermissionAccess } from "../modules/connectors/types.js";

export function permissionFormatTag(access: PermissionAccess): string {
  if (access.kind === "web") {
    return "@web";
  }
  return `@${access.kind}:${access.path}`;
}
