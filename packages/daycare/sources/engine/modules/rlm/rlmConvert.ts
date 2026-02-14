import type { JsMontyObject } from "@pydantic/monty";
import type { Tool } from "@mariozechner/pi-ai";

import type { ToolExecutionResult } from "@/types";

/**
 * Converts Monty positional/keyword arguments into the JSON object expected by tool execution.
 * Expects: positional argument order matches tool parameter property order.
 */
export function rlmArgsConvert(
  args: JsMontyObject[],
  kwargs: Record<string, JsMontyObject>,
  toolSchema: Tool
): unknown {
  const propertyNames = toolParameterNamesResolve(toolSchema);
  const output: Record<string, unknown> = {};

  for (let index = 0; index < args.length; index += 1) {
    const name = propertyNames[index];
    if (!name) {
      throw new Error(`Too many positional arguments for tool ${toolSchema.name}.`);
    }
    output[name] = montyValueConvert(args[index]);
  }

  const convertedKwargs = montyValueConvert(kwargs);
  if (!recordIs(convertedKwargs)) {
    throw new Error("Tool kwargs must convert to an object.");
  }
  for (const [name, value] of Object.entries(convertedKwargs)) {
    output[name] = value;
  }

  return output;
}

/**
 * Converts a tool execution result into a Python-friendly string value.
 * Expects: tool result content follows the ToolResultMessage text block convention.
 */
export function rlmResultConvert(toolResult: ToolExecutionResult): JsMontyObject {
  const text = toolResult.toolMessage.content
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();

  if (text.length > 0) {
    return text;
  }

  if (toolResult.toolMessage.isError) {
    return "Tool execution failed.";
  }

  return "";
}

function toolParameterNamesResolve(tool: Tool): string[] {
  if (!recordIs(tool.parameters)) {
    return [];
  }

  const properties = tool.parameters.properties;
  if (!recordIs(properties)) {
    return [];
  }

  return Object.keys(properties);
}

function montyValueConvert(value: unknown): unknown {
  if (typeof value === "bigint") {
    if (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) {
      return Number(value);
    }
    return value.toString();
  }

  if (value instanceof Map) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of value.entries()) {
      result[String(key)] = montyValueConvert(item);
    }
    return result;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => montyValueConvert(entry));
  }

  if (!recordIs(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = montyValueConvert(entry);
  }
  return result;
}

function recordIs(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
