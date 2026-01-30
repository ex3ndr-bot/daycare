import type { Logger } from "pino";
import type { ZodType } from "zod";

import type { FileStore } from "../files/store.js";
import type { SecretsStore } from "../secrets/store.js";
import type { PluginInstanceSettings, SettingsConfig } from "../settings.js";
import type { PluginEventInput } from "./events.js";
import type { PluginRegistrar } from "./registry.js";

export type PluginApi<TSettings = unknown> = {
  instance: PluginInstanceSettings;
  settings: TSettings;
  engineSettings: SettingsConfig;
  logger: Logger;
  secrets: SecretsStore;
  dataDir: string;
  registrar: PluginRegistrar;
  fileStore: FileStore;
  events: {
    emit: (event: PluginEventInput) => void;
  };
};

export type PluginInstance = {
  load?: () => Promise<void>;
  unload?: () => Promise<void>;
};

export type PluginModule<TSettings = unknown> = {
  settingsSchema: ZodType<TSettings>;
  create: (api: PluginApi<TSettings>) => PluginInstance | Promise<PluginInstance>;
};

export function definePlugin<TSettings>(
  module: PluginModule<TSettings>
): PluginModule<TSettings> {
  return module;
}
