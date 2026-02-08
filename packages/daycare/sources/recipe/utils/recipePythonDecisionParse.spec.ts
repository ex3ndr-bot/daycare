import { describe, expect, it } from "vitest";

import { recipePythonDecisionParse } from "./recipePythonDecisionParse.js";

describe("recipePythonDecisionParse", () => {
  it("parses a text decision", () => {
    const decision = recipePythonDecisionParse('{"type":"text","text":"done"}');
    expect(decision).toEqual({ type: "text", text: "done" });
  });

  it("parses a python decision", () => {
    const decision = recipePythonDecisionParse('{"type":"python","code":"print(1)"}');
    expect(decision).toEqual({ type: "python", code: "print(1)" });
  });

  it("parses fenced json decision", () => {
    const decision = recipePythonDecisionParse(
      '```json\n{"type":"python","code":"x=1","text":"compute"}\n```'
    );
    expect(decision).toEqual({ type: "python", code: "x=1", text: "compute" });
  });

  it("returns null for invalid payload", () => {
    expect(recipePythonDecisionParse("not json")).toBeNull();
  });
});
