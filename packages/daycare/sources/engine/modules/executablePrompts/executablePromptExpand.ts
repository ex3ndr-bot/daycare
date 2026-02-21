import { createId } from "@paralleldrive/cuid2";
import type { ToolExecutionContext } from "@/types";
import { tagExtractAll } from "../../../util/tagExtract.js";
import { montyRuntimePreambleBuild } from "../monty/montyRuntimePreambleBuild.js";
import { rlmExecute } from "../rlm/rlmExecute.js";
import type { ToolResolverApi } from "../toolResolver.js";
import { executablePromptTagReplace } from "./executablePromptTagReplace.js";

/**
 * Expands `<run_python>...</run_python>` blocks inside a prompt using the RLM runtime.
 * Expects: caller has already checked feature flags and execution permissions.
 */
export async function executablePromptExpand(
    prompt: string,
    context: ToolExecutionContext,
    toolResolver: ToolResolverApi
): Promise<string> {
    const codeBlocks = tagExtractAll(prompt, "run_python");
    if (codeBlocks.length === 0) {
        return prompt;
    }

    const tagMatches = [...prompt.matchAll(/<run_python(\s[^>]*)?>[\s\S]*?<\/run_python\s*>/gi)];
    if (tagMatches.length === 0) {
        return prompt;
    }

    const preamble = montyRuntimePreambleBuild(toolResolver.listTools());
    const replacements: string[] = [];
    for (let index = 0; index < codeBlocks.length; index += 1) {
        const code = codeBlocks[index]!;
        try {
            const result = await rlmExecute(
                code,
                preamble,
                context,
                toolResolver,
                createId(),
                context.appendHistoryRecord
            );
            replacements.push(result.output);
        } catch (error) {
            replacements.push(`<exec_error>${errorMessageResolve(error)}</exec_error>`);
        }
    }

    let expanded = prompt;
    const replacementCount = Math.min(tagMatches.length, replacements.length);
    for (let index = replacementCount - 1; index >= 0; index -= 1) {
        const tagMatch = tagMatches[index]!;
        expanded = executablePromptTagReplace(expanded, tagMatch, replacements[index] ?? "");
    }

    return expanded;
}

function errorMessageResolve(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
