import matter from "gray-matter";

import type { AppManifest } from "./appTypes.js";

/**
 * Serializes an app manifest back to APP.md markdown format.
 * Expects: manifest has already been validated and normalized.
 */
export function appManifestSerialize(manifest: AppManifest): string {
  const body = [
    "## System Prompt",
    "",
    manifest.systemPrompt.trim()
  ].join("\n").trimEnd();

  return matter.stringify(body, {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    ...(manifest.model ? { model: manifest.model } : {})
  });
}
