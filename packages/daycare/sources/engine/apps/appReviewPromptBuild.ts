import type { AppRuleSet } from "./appTypes.js";

type AppReviewPromptBuildInput = {
  appName: string;
  sourceIntent: string;
  toolName: string;
  args: unknown;
  rules: AppRuleSet;
};

/**
 * Builds the review-model prompt for a pending app tool call.
 * Expects: tool metadata and app rules are already normalized.
 */
export function appReviewPromptBuild(input: AppReviewPromptBuildInput): string {
  const argsText = argsSerialize(input.args);
  const allowRules =
    input.rules.allow.length > 0
      ? input.rules.allow.map((rule) => `- ${rule.text}`).join("\n")
      : "- (none)";
  const denyRules =
    input.rules.deny.length > 0
      ? input.rules.deny.map((rule) => `- ${rule.text}`).join("\n")
      : "- (none)";

  return [
    `You are a security reviewer for the app "${input.appName}".`,
    "A tool call is being made. Decide if it should be ALLOWED or DENIED based on the rules below.",
    "",
    "## Tool Call",
    `- Tool: ${input.toolName}`,
    `- Arguments: ${argsText}`,
    "",
    "## Source Intent",
    input.sourceIntent,
    "",
    "## Allow Rules",
    allowRules,
    "",
    "## Deny Rules",
    denyRules,
    "",
    "Respond with exactly one of:",
    "- ALLOW",
    "- DENY: <reason>"
  ].join("\n");
}

function argsSerialize(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "null";
  } catch {
    return "<unserializable>";
  }
}
