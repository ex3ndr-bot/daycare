import { describe, expect, it } from "vitest";

import { agentMessageRunPythonFailureTrim } from "./agentMessageRunPythonFailureTrim.js";

describe("agentMessageRunPythonFailureTrim", () => {
  it("trims text after the failed run_python block", () => {
    const text = [
      "<run_python>one()</run_python>",
      "<run_python>two()</run_python>",
      "<run_python>three()</run_python>"
    ].join("");
    expect(agentMessageRunPythonFailureTrim(text, 1)).toBe(
      "<run_python>one()</run_python><run_python>two()</run_python>"
    );
  });

  it("returns null when successfulExecutionCount is out of range", () => {
    const text = "<run_python>one()</run_python>";
    expect(agentMessageRunPythonFailureTrim(text, 1)).toBeNull();
  });

  it("returns null for negative successfulExecutionCount", () => {
    const text = "<run_python>one()</run_python>";
    expect(agentMessageRunPythonFailureTrim(text, -1)).toBeNull();
  });
});
