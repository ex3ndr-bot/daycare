import { describe, expect, it } from "vitest";

import { appReviewPromptBuild } from "./appReviewPromptBuild.js";

describe("appReviewPromptBuild", () => {
  it("includes tool details and allow/deny rules", () => {
    const prompt = appReviewPromptBuild({
      appName: "GitHub Reviewer",
      sourceIntent: "Review pull requests safely.",
      toolName: "exec",
      args: { command: "git diff" },
      rules: {
        allow: [{ text: "Run read-only git commands" }],
        deny: [{ text: "Rewrite git history" }]
      }
    });

    expect(prompt).toContain('app "GitHub Reviewer"');
    expect(prompt).toContain("- Tool: exec");
    expect(prompt).toContain('"command": "git diff"');
    expect(prompt).toContain("Review pull requests safely.");
    expect(prompt).toContain("- Run read-only git commands");
    expect(prompt).toContain("- Rewrite git history");
    expect(prompt).toContain("DENY: <reason>");
  });
});
