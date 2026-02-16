import type { AppManifest } from "./appTypes.js";

const APP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates and normalizes an app manifest.
 * Expects: manifest fields are parsed from APP.md and not nullish.
 */
export function appManifestValidate(manifest: AppManifest): AppManifest {
  const id = manifest.id.trim();
  const name = manifest.name.trim();
  const description = manifest.description.trim();
  const systemPrompt = manifest.systemPrompt.trim();
  if (!id || !name || !description || !systemPrompt) {
    throw new Error("App manifest requires id, name, description, and systemPrompt.");
  }
  if (!APP_ID_PATTERN.test(id)) {
    throw new Error("App id must be lowercase alphanumeric with optional hyphen separators.");
  }

  return {
    id,
    name,
    description,
    ...(manifest.model && manifest.model.trim().length > 0
      ? { model: manifest.model.trim() }
      : {}),
    systemPrompt
  };
}
