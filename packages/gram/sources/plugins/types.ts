import type { Logger } from "pino";

import type { FileStore } from "../files/store.js";
import type { AuthStore } from "../auth/store.js";
import type { SettingsConfig, PluginSettings } from "../settings.js";
import type { PluginRegistrar } from "./registry.js";

export type PluginKind =
  | "connector"
  | "inference"
  | "tool"
  | "mixed";

export type PluginContext = {
  config: PluginSettings;
  settings: SettingsConfig;
  logger: Logger;
  auth: AuthStore;
  dataDir: string;
  registrar: PluginRegistrar;
  fileStore: FileStore;
};

export type Plugin = {
  id: string;
  kind: PluginKind;
  load: (context: PluginContext) => Promise<void>;
  unload: (context: PluginContext) => Promise<void>;
};
