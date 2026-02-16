import type { AppManifest } from "./appTypes.js";

const APP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const APP_NAME_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

/**
 * Validates and normalizes an app manifest.
 * Expects: manifest fields are parsed from APP.md and not nullish.
 */
export function appManifestValidate(manifest: AppManifest): AppManifest {
  const id = manifest.id.trim();
  const name = manifest.name.trim();
  const title = manifest.title.trim();
  const description = manifest.description.trim();
  if (!id || !name || !title || !description) {
    throw new Error("App manifest requires id, name, title, and description.");
  }
  if (!APP_ID_PATTERN.test(id)) {
    throw new Error("App id must be lowercase alphanumeric with optional hyphen separators.");
  }
  if (!APP_NAME_PATTERN.test(name)) {
    throw new Error("App name must be username-style lowercase with optional dash or underscore separators.");
  }

  return {
    id,
    name,
    title,
    description,
    ...(manifest.model && manifest.model.trim().length > 0
      ? { model: manifest.model.trim() }
      : {})
  };
}
