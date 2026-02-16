import { describe, expect, it } from "vitest";

import type { AppManifest } from "./appTypes.js";
import { appManifestValidate } from "./appManifestValidate.js";

function baseManifest(): AppManifest {
  return {
    id: "github-reviewer",
    name: "GitHub Reviewer",
    description: "Reviews pull requests",
    systemPrompt: "You are a reviewer."
  };
}

describe("appManifestValidate", () => {
  it("accepts valid manifests", () => {
    const validated = appManifestValidate(baseManifest());

    expect(validated.id).toBe("github-reviewer");
    expect(validated.systemPrompt).toBe("You are a reviewer.");
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
    manifest.systemPrompt = "   ";

    expect(() => appManifestValidate(manifest)).toThrow(
      "App manifest requires id, name, description, and systemPrompt."
    );
  });
});
