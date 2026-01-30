import type { PluginFactory } from "./manager.js";
import { createTelegramPlugin } from "./telegram.js";
import { createBraveSearchPlugin } from "./brave-search.js";
import { createGptImagePlugin } from "./gpt-image.js";
import { createNanobananaPlugin } from "./nanobanana.js";
import { PROVIDER_DEFINITIONS } from "./providers.js";
import { createPiAiProviderPlugin } from "./pi-ai-provider.js";
import { createOpenAICompatiblePlugin } from "./openai-compatible.js";

export function buildPluginCatalog(): Map<string, PluginFactory> {
  const catalog = new Map<string, PluginFactory>([
    ["telegram", createTelegramPlugin],
    ["brave-search", createBraveSearchPlugin],
    ["gpt-image", createGptImagePlugin],
    ["nanobanana", createNanobananaPlugin]
  ]);

  for (const provider of PROVIDER_DEFINITIONS) {
    if (provider.kind === "openai-compatible") {
      catalog.set(provider.id, () => createOpenAICompatiblePlugin());
      continue;
    }
    catalog.set(provider.id, () => createPiAiProviderPlugin(provider));
  }

  return catalog;
}
