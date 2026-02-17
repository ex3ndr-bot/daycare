import { describe, expect, it } from "vitest";

import type { Tool } from "@mariozechner/pi-ai";
import { rlmNoToolsPromptBuild } from "./rlmNoToolsPromptBuild.js";

describe("rlmNoToolsPromptBuild", () => {
  it("renders no-tools run_python tag instructions with generated stubs", async () => {
    const tools = [
      { name: "run_python", description: "", parameters: {} },
      { name: "echo", description: "Echo text", parameters: {} },
      { name: "skill", description: "Load skill", parameters: {} }
    ] as unknown as Tool[];

    const prompt = await rlmNoToolsPromptBuild(tools);

    expect(prompt).toContain("This mode exposes zero tools to the model.");
    expect(prompt).toContain("<run_python>...</run_python>");
    expect(prompt).toContain("Emit at most one Python block per assistant response.");
    expect(prompt).toContain("first `<run_python>` and last `</run_python>`");
    expect(prompt).toContain("`<say>` blocks must come before `<run_python>`");
    expect(prompt).toContain("```python");
    expect(prompt).toContain("def echo() -> str:");
    expect(prompt).not.toContain("Available skills");
    expect(prompt).toContain("<python_result>...</python_result>");
    expect(prompt).toContain("do not use `print()` for the final return value");
    expect(prompt).toContain("you get another turn and can emit `<say>`");
  });
});
