import { describe, expect, it } from "vitest";

import { appManifestParse } from "./appManifestParse.js";

describe("appManifestParse", () => {
  it("parses frontmatter and system prompt", () => {
    const manifest = appManifestParse(
      [
        "---",
        "id: github-reviewer",
        "name: GitHub Reviewer",
        "description: Reviews pull requests",
        "model: gpt-4.1-mini",
        "---",
        "",
        "## System Prompt",
        "",
        "You review pull requests."
      ].join("\n")
    );

    expect(manifest).toEqual({
      id: "github-reviewer",
      name: "GitHub Reviewer",
      description: "Reviews pull requests",
      model: "gpt-4.1-mini",
      systemPrompt: "You review pull requests."
    });
  });

  it("throws when required frontmatter fields are missing", () => {
    const content = [
      "---",
      "name: Missing id",
      "description: Missing id field",
      "---",
      "",
      "## System Prompt",
      "",
      "You are an app."
    ].join("\n");

    expect(() => appManifestParse(content)).toThrow(
      "APP.md frontmatter must include id, name, and description."
    );
  });

  it("throws on malformed yaml", () => {
    const content = [
      "---",
      "id: github-reviewer",
      "name: [not closed",
      "---",
      "",
      "## System Prompt",
      "",
      "Hello"
    ].join("\n");

    expect(() => appManifestParse(content)).toThrow("Invalid APP.md frontmatter.");
  });
});
