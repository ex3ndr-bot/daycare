import { describe, expect, it } from "vitest";

import { sandboxAllowedDomainsResolve } from "./sandboxAllowedDomainsResolve.js";

describe("sandboxAllowedDomainsResolve", () => {
  it("expands package manager presets and dedupes domains", () => {
    const result = sandboxAllowedDomainsResolve(
      ["example.com", "registry.npmjs.org", " example.com "],
      ["node", "python"]
    );

    expect(result).toEqual([
      "example.com",
      "registry.npmjs.org",
      "registry.yarnpkg.com",
      "pypi.org",
      "files.pythonhosted.org",
      "pypi.python.org"
    ]);
  });

  it("throws on blank explicit allowedDomains entries", () => {
    expect(() => sandboxAllowedDomainsResolve(["  "], ["go"]))
      .toThrow("allowedDomains entries cannot be blank.");
  });
});
