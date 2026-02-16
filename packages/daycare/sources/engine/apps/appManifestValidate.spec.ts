import { describe, expect, it } from "vitest";

import type { AppManifest } from "./appTypes.js";
import { appManifestValidate } from "./appManifestValidate.js";

function baseManifest(): AppManifest {
  return {
    id: "github-reviewer",
    name: "github-reviewer",
    title: "GitHub Reviewer",
    description: "Reviews pull requests"
  };
}

describe("appManifestValidate", () => {
  it("accepts valid manifests", () => {
    const validated = appManifestValidate(baseManifest());

    expect(validated.id).toBe("github-reviewer");
    expect(validated.title).toBe("GitHub Reviewer");
    expect(validated.description).toBe("Reviews pull requests");
  });

  it("rejects invalid ids", () => {
    const manifest = baseManifest();
    manifest.id = "GitHub Reviewer";

    expect(() => appManifestValidate(manifest)).toThrow(
      "App id must be lowercase alphanumeric with optional hyphen separators."
    );
  });

  it("rejects missing required fields", () => {
    const manifest = baseManifest();
    manifest.description = "   ";

    expect(() => appManifestValidate(manifest)).toThrow(
      "App manifest requires id, name, title, and description."
    );
  });

  it("rejects non username-style names", () => {
    const manifest = baseManifest();
    manifest.name = "GitHub Reviewer";

    expect(() => appManifestValidate(manifest)).toThrow(
      "App name must be username-style lowercase with optional dash or underscore separators."
    );
  });
});
