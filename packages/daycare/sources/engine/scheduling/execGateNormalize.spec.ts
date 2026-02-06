import { describe, it, expect } from "vitest";

import { execGateNormalize } from "./execGateNormalize.js";

describe("execGateNormalize", () => {
  it("returns undefined for missing command", () => {
    expect(execGateNormalize(null)).toBeUndefined();
    expect(execGateNormalize({})).toBeUndefined();
  });

  it("normalizes gate fields", () => {
    const result = execGateNormalize({
      command: "  echo ok  ",
      cwd: " /tmp ",
      timeoutMs: 1500,
      env: { FOO: "bar", SKIP: 3, FLAG: true },
      permissions: ["@network", "  @read:/tmp  ", "", "@network"],
      packageManagers: ["node", " node ", "python", "invalid"],
      allowedDomains: ["example.com", " example.com "]
    });
    expect(result).toEqual({
      command: "echo ok",
      cwd: "/tmp",
      timeoutMs: 1500,
      env: { FOO: "bar", SKIP: "3", FLAG: "true" },
      permissions: ["@network", "@read:/tmp"],
      packageManagers: ["node", "python"],
      allowedDomains: ["example.com"]
    });
  });
});
