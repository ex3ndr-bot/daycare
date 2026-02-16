import { describe, expect, it } from "vitest";

import { appManifestParse } from "./appManifestParse.js";

describe("appManifestParse", () => {
  it("parses frontmatter fields", () => {
    const manifest = appManifestParse(
      [
        "---",
        "id: github-reviewer",
        "name: github-reviewer",
        "title: GitHub Reviewer",
        "description: Reviews pull requests",
        "model: gpt-4.1-mini",
        "---"
      ].join("\n")
    );

    expect(manifest).toEqual({
      id: "github-reviewer",
      name: "github-reviewer",
      title: "GitHub Reviewer",
      description: "Reviews pull requests",
      model: "gpt-4.1-mini"
    });
  });

  it("throws when required frontmatter fields are missing", () => {
    const content = [
      "---",
      "name: missing-id",
      "title: Missing id",
      "description: Missing id field",
      "---"
    ].join("\n");

    expect(() => appManifestParse(content)).toThrow(
      "APP.md frontmatter must include id, name, title, and description."
    );
  });

  it("throws on malformed yaml", () => {
    const content = [
      "---",
      "id: github-reviewer",
      "name: github-reviewer",
      "title: [not closed",
      "---"
    ].join("\n");

    expect(() => appManifestParse(content)).toThrow("Invalid APP.md frontmatter.");
  });
});
