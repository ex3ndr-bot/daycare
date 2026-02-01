import path from "node:path";

import { resolveEngineSocketPath } from "../engine/ipc/socket.js";
import { resolveWorkspaceDir } from "../engine/permissions.js";
import { permissionBuildDefault } from "../engine/permissions/permissionBuildDefault.js";
import { DEFAULT_CLAYBOT_DIR } from "../paths.js";
import type { SettingsConfig } from "../settings.js";
import { freezeDeep } from "../util/freezeDeep.js";
import type { Config } from "./configTypes.js";

/**
 * Resolves derived paths and defaults into an immutable Config snapshot.
 * Expects: settingsPath is absolute; settings already validated.
 */
export function configResolve(settings: SettingsConfig, settingsPath: string): Config {
  const resolvedSettingsPath = path.resolve(settingsPath);
  const configDir = path.dirname(resolvedSettingsPath);
  const dataDir = path.resolve(settings.engine?.dataDir ?? DEFAULT_CLAYBOT_DIR);
  const authPath = path.join(dataDir, "auth.json");
  const socketPath = resolveEngineSocketPath(settings.engine?.socketPath);
  const workspaceDir = resolveWorkspaceDir(configDir, settings.assistant ?? null);
  const defaultPermissions = permissionBuildDefault(workspaceDir, configDir);
  const frozenSettings = freezeDeep(structuredClone(settings));
  const frozenPermissions = freezeDeep(defaultPermissions);

  return freezeDeep({
    settingsPath: resolvedSettingsPath,
    configDir,
    dataDir,
    authPath,
    socketPath,
    workspaceDir,
    settings: frozenSettings,
    defaultPermissions: frozenPermissions
  });
}
