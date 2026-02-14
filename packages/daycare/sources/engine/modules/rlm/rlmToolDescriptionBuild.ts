import type { Tool } from "@mariozechner/pi-ai";

import { rlmPreambleBuild } from "./rlmPreambleBuild.js";

/**
 * Builds the run_python tool description with the generated Python tool preamble.
 * Expects: tools contains the full current tool list from ToolResolver.
 */
export function rlmToolDescriptionBuild(tools: Tool[]): string {
  const preamble = rlmPreambleBuild(tools);
  return [
    "Execute Python code to complete the task.",
    "",
    "The following functions are available:",
    "```python",
    preamble,
    "```",
    "",
    "Call tool functions directly (no `await`).",
    "Use `try/except ToolError` for tool failures.",
    "Use `print()` for debug output.",
    "The value of the final expression is returned."
  ].join("\n");
}
