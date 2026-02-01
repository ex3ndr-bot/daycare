import path from "node:path";

import type { PermissionDecision } from "../connectors/types.js";
import type { SessionPermissions } from "../permissions.js";

export function permissionApply(
  permissions: SessionPermissions,
  decision: PermissionDecision
): void {
  if (!decision.approved) {
    return;
  }
  if (decision.access.kind === "web") {
    permissions.web = true;
    return;
  }
  if (!path.isAbsolute(decision.access.path)) {
    return;
  }
  const resolved = path.resolve(decision.access.path);
  if (decision.access.kind === "write") {
    const next = new Set(permissions.writeDirs);
    next.add(resolved);
    permissions.writeDirs = Array.from(next.values());
    return;
  }
  if (decision.access.kind === "read") {
    const next = new Set(permissions.readDirs);
    next.add(resolved);
    permissions.readDirs = Array.from(next.values());
  }
}
