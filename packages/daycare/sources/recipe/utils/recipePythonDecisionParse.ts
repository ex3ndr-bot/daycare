export type RecipePythonDecision =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "python";
      code: string;
      text?: string;
    };

/**
 * Parses assistant text into a recipe python-loop decision object.
 * Expects: input follows the recipe JSON protocol.
 */
export function recipePythonDecisionParse(input: string): RecipePythonDecision | null {
  const value = recipeJsonParseExtract(input);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const decision = value as Record<string, unknown>;
  const type = decision.type;
  if (type !== "text" && type !== "python") {
    return null;
  }

  if (type === "text") {
    const text = recipeStringFirst(decision.text, decision.message, decision.content);
    if (!text) {
      return null;
    }
    return { type, text };
  }

  const code = recipeStringFirst(decision.code, decision.python);
  if (!code) {
    return null;
  }
  const text = recipeStringFirst(decision.text, decision.message, decision.content);
  return text ? { type, code, text } : { type, code };
}

function recipeJsonParseExtract(input: string): unknown {
  const text = input.trim();
  if (!text) {
    return null;
  }
  const direct = recipeJsonParseTry(text);
  if (direct !== undefined) {
    return direct;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const parsed = recipeJsonParseTry(fenced.trim());
    if (parsed !== undefined) {
      return parsed;
    }
  }

  const objectLike = text.match(/\{[\s\S]*\}/)?.[0];
  if (objectLike) {
    const parsed = recipeJsonParseTry(objectLike);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  return null;
}

function recipeJsonParseTry(input: string): unknown | undefined {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return undefined;
  }
}

function recipeStringFirst(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}
