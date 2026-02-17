import type { Context } from "@mariozechner/pi-ai";

import type { RlmExecuteResult } from "./rlmExecute.js";
import { rlmErrorTextBuild } from "./rlmErrorTextBuild.js";
import { rlmResultTextBuild } from "./rlmResultTextBuild.js";

type RlmNoToolsResultMessageBuildOptions =
  | {
      result: RlmExecuteResult;
      prefixLines?: string[];
    }
  | {
      error: unknown;
      prefixLines?: string[];
    };

/**
 * Builds a user-role <python_result> message for no-tools RLM loop turns.
 * Expects: exactly one of result or error is provided.
 */
export function rlmNoToolsResultMessageBuild(
  options: RlmNoToolsResultMessageBuildOptions
): Context["messages"][number] {
  const bodyBase = "result" in options
    ? rlmResultTextBuild(options.result)
    : rlmErrorTextBuild(options.error);
  const prefix = options.prefixLines?.filter((line) => line.trim().length > 0) ?? [];
  const body = [...prefix, bodyBase].join("\n");
  return {
    role: "user",
    content: [
      {
        type: "text",
        text: `<python_result>\n${body}\n</python_result>`
      }
    ],
    timestamp: Date.now()
  };
}
