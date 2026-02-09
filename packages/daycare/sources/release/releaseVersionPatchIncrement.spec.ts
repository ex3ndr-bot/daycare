import { describe, expect, it } from "vitest";

import { releaseVersionPatchIncrement } from "./releaseVersionPatchIncrement.js";

describe("releaseVersionPatchIncrement", () => {
  it("increments a stable version", () => {
    expect(releaseVersionPatchIncrement("1.2.3")).toBe("1.2.4");
  });

  it("drops prerelease and build metadata when incrementing", () => {
    expect(releaseVersionPatchIncrement("1.2.3-beta.1+build.42")).toBe("1.2.4");
  });

  it("throws for invalid semver values", () => {
    expect(() => releaseVersionPatchIncrement("v1.2.3")).toThrow(
      "Invalid semantic version: v1.2.3"
    );
  });
});
