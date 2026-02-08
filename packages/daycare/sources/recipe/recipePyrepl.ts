import type { Api, Context, Model } from "@mariozechner/pi-ai";

import { promptInput } from "../commands/prompts.js";
import { recipeAnthropicApiKeyResolve } from "./utils/recipeAnthropicApiKeyResolve.js";
import { recipeAnthropicModelResolve } from "./utils/recipeAnthropicModelResolve.js";
import { recipeAnthropicReplyGet } from "./utils/recipeAnthropicReplyGet.js";
import { recipeAuthPathResolve } from "./utils/recipeAuthPathResolve.js";
import {
  recipePythonDecisionParse,
  type RecipePythonDecision
} from "./utils/recipePythonDecisionParse.js";
import {
  recipePythonReplCreate,
  type RecipePythonExecutionResult,
  type RecipePythonRepl
} from "./utils/recipePythonReplCreate.js";
import { recipePythonSystemPromptBuild } from "./utils/recipePythonSystemPromptBuild.js";

const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_SANDBOX_NAME = "pyrepl";
const MAX_INTERNAL_STEPS = 6;

/**
 * Runs a sequential inference loop where the model can return text or python code.
 * Expects: Anthropic auth is configured and system python is available.
 */
export async function main(args: string[]): Promise<void> {
  const modelId = args[0]?.trim() || process.env.DAYCARE_RECIPE_MODEL?.trim() || DEFAULT_MODEL;
  const sandboxName = args[1]?.trim() || DEFAULT_SANDBOX_NAME;
  const model = recipeAnthropicModelResolve(modelId);
  const authPath = recipeAuthPathResolve();
  const messages: Context["messages"] = [];
  const repl = await recipePythonReplCreate(sandboxName);
  const systemPrompt = recipePythonSystemPromptBuild(repl.sandboxDir);

  console.log("Recipe pyrepl started.");
  console.log(`Sandbox directory: ${repl.sandboxDir}`);
  console.log("Type /exit to quit.\n");

  try {
    while (true) {
      const userInput = await promptInput({
        message: "You",
        placeholder: "Type your message"
      });
      if (userInput === null) {
        break;
      }

      const text = userInput.trim();
      if (!text) {
        continue;
      }
      if (text === "/exit" || text === "/quit") {
        break;
      }

      messages.push({
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now()
      });

      await recipePyreplTurnRun(messages, authPath, model, repl, systemPrompt);
    }
  } finally {
    await repl.close();
  }

  console.log("Exited.");
}

async function recipePyreplTurnRun(
  messages: Context["messages"],
  authPath: string,
  model: Model<Api>,
  repl: RecipePythonRepl,
  systemPrompt: string
): Promise<void> {
  for (let step = 0; step < MAX_INTERNAL_STEPS; step += 1) {
    const apiKey = await recipeAnthropicApiKeyResolve(authPath);
    const reply = await recipeAnthropicReplyGet(messages, apiKey, model, {
      sessionId: "recipe-pyrepl",
      systemPrompt
    });

    messages.push(reply.message);

    const decision = recipePythonDecisionParse(reply.text);
    if (!decision) {
      console.log(`\nAssistant: ${reply.text}\n`);
      return;
    }

    if (decision.type === "text") {
      console.log(`\nAssistant: ${decision.text}\n`);
      return;
    }

    await recipePyreplPythonRun(messages, repl, decision);
  }

  console.error(`\nError: Max internal steps (${MAX_INTERNAL_STEPS}) reached.\n`);
}

async function recipePyreplPythonRun(
  messages: Context["messages"],
  repl: RecipePythonRepl,
  decision: Extract<RecipePythonDecision, { type: "python" }>
): Promise<void> {
  if (decision.text) {
    console.log(`\nAssistant plan: ${decision.text}`);
  }
  console.log("\nAssistant python code:");
  console.log(decision.code);

  const execution = await repl.execute(decision.code);
  const consoleSummary = recipePyreplExecutionConsoleFormat(execution);
  console.log(`\nPython execution result:\n${consoleSummary}\n`);

  const modelFeedback = recipePyreplExecutionFeedbackBuild(execution);
  messages.push({
    role: "user",
    content: [{ type: "text", text: modelFeedback }],
    timestamp: Date.now()
  });
}

function recipePyreplExecutionConsoleFormat(result: RecipePythonExecutionResult): string {
  const parts: string[] = [];
  parts.push(`ok: ${result.ok ? "true" : "false"}`);
  if (result.stdout.trim()) {
    parts.push(`stdout:\n${result.stdout.trimEnd()}`);
  }
  if (result.stderr.trim()) {
    parts.push(`stderr:\n${result.stderr.trimEnd()}`);
  }
  if (result.result !== null) {
    parts.push(`result: ${result.result}`);
  }
  if (result.error) {
    parts.push(`error:\n${result.error.trimEnd()}`);
  }
  return parts.join("\n\n");
}

function recipePyreplExecutionFeedbackBuild(result: RecipePythonExecutionResult): string {
  const sections = [
    "Python execution feedback:",
    `ok=${result.ok ? "true" : "false"}`,
    `stdout:\n${result.stdout || "(empty)"}`,
    `stderr:\n${result.stderr || "(empty)"}`,
    `result:\n${result.result ?? "(none)"}`,
    `error:\n${result.error ?? "(none)"}`,
    "Decide next action and respond with JSON only."
  ];
  return sections.join("\n\n");
}
