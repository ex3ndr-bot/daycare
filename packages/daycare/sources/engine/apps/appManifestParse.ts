import matter from "gray-matter";

import type { AppManifest } from "./appTypes.js";

type AppFrontmatter = {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  description?: unknown;
  model?: unknown;
};

/**
 * Parses APP.md content into an AppManifest shape.
 * Expects: content contains YAML frontmatter with id/name/title/description.
 */
export function appManifestParse(content: string): AppManifest {
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(content);
  } catch {
    throw new Error("Invalid APP.md frontmatter.");
  }

  const frontmatter = parsed.data as AppFrontmatter;
  const id = toOptionalString(frontmatter.id);
  const name = toOptionalString(frontmatter.name);
  const title = toOptionalString(frontmatter.title);
  const description = toOptionalString(frontmatter.description);
  if (!id || !name || !title || !description) {
    throw new Error("APP.md frontmatter must include id, name, title, and description.");
  }

  const model = toOptionalString(frontmatter.model);

  return {
    id,
    name,
    title,
    description,
    ...(model ? { model } : {})
  };
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
