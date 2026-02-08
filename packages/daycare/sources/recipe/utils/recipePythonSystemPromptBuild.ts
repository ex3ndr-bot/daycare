/**
 * Builds the system prompt for the python REPL recipe loop.
 * Expects: sandboxDir is the only writable directory for generated files.
 */
export function recipePythonSystemPromptBuild(sandboxDir: string): string {
  return [
    "You are running inside a sequential Python REPL workflow.",
    "On each turn, choose exactly one of the following outputs as strict JSON:",
    '- {"type":"text","text":"<final user-facing answer>"}',
    '- {"type":"python","code":"<python to execute>","text":"<optional short intent>"}',
    "Rules:",
    "- Output valid JSON only. No markdown, no prose outside JSON.",
    "- Prefer text responses when computation is not needed.",
    "- If you output python, keep code concise and deterministic.",
    "- Python code runs in a persistent session: variables/files persist between executions.",
    `- Treat this as sandboxed execution; write files only under: ${sandboxDir}`,
    "- After execution, you will receive stdout/stderr/result as the next user message."
  ].join("\n");
}
