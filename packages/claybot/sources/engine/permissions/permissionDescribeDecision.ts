import type { PermissionAccess } from "../modules/connectors/types.js";

export function permissionDescribeDecision(access: PermissionAccess): string {
  if (access.kind === "web") {
    return "web access";
  }
  if (access.kind === "read") {
    return `read access to ${access.path}`;
  }
  return `write access to ${access.path}`;
}
