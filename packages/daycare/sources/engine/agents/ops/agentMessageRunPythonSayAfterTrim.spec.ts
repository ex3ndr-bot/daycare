import { describe, expect, it } from "vitest";

import { agentMessageRunPythonSayAfterTrim } from "./agentMessageRunPythonSayAfterTrim.js";

describe("agentMessageRunPythonSayAfterTrim", () => {
  it("returns null when no run_python tags are present", () => {
    expect(agentMessageRunPythonSayAfterTrim("<say>hello</say>")).toBeNull();
  });

  it("removes say tags after the first run_python tag", () => {
    const text = "<say>before</say><run_python>echo()</run_python><say>after</say>";
    expect(agentMessageRunPythonSayAfterTrim(text)).toBe("<say>before</say><run_python>echo()</run_python>");
  });

  it("returns null when there are no say tags after run_python", () => {
    const text = "<say>before</say><run_python>echo()</run_python>";
    expect(agentMessageRunPythonSayAfterTrim(text)).toBeNull();
  });
});
