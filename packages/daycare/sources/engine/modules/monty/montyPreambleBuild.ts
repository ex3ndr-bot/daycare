import type { Tool } from "@mariozechner/pi-ai";

import { RLM_PRINT_FUNCTION_NAME, RLM_TOOL_NAME } from "../rlm/rlmConstants.js";
import { montyParameterEntriesBuild } from "./montyParameterEntriesBuild.js";

/**
 * Builds a Python preamble containing synchronous tool stubs for the current tool surface.
 * Expects: tool names are unique and come from ToolResolver.listTools().
 */
export function montyPreambleBuild(tools: Tool[]): string {
  const lines: string[] = [
    "# You have the following tools available as Python functions.",
    "# Call tool functions directly (no await).",
    "# Tool failures raise ToolError (alias of RuntimeError).",
    "# Use print() for debug logs; the last expression is returned.",
    "",
    "from typing import Any",
    "",
    "ToolError = RuntimeError",
    "",
    "# Typed tool stubs for code assistance only (not executed).",
    "if False:",
    `    def ${RLM_PRINT_FUNCTION_NAME}(*values: Any) -> None:`,
    "        ...",
    ""
  ];
  let stubCount = 0;

  for (const tool of tools) {
    if (tool.name === RLM_TOOL_NAME) {
      continue;
    }
    if (!pythonIdentifierIs(tool.name)) {
      continue;
    }

    stubCount += 1;
    const signature = pythonSignatureBuild(tool);
    const description = pythonDocstringEscape(tool.description?.trim() || "No description.");

    lines.push(`    def ${tool.name}(${signature}) -> str:`);
    lines.push(`        \"\"\"${description}\"\"\"`);
    lines.push("        ...");
    lines.push("");
  }

  if (stubCount === 0) {
    lines.push("    pass");
  }

  return lines.join("\n").trimEnd();
}

function pythonSignatureBuild(tool: Tool): string {
  const parameterEntries = montyParameterEntriesBuild(tool);
  const signatureEntries: string[] = [];

  for (const { name, schema, required } of parameterEntries) {
    const typeHint = pythonTypeFromSchema(schema);
    if (required) {
      signatureEntries.push(`${name}: ${typeHint}`);
      continue;
    }
    signatureEntries.push(`${name}: ${typeHint} | None = None`);
  }

  return signatureEntries.join(", ");
}

function pythonTypeFromSchema(schema: unknown): string {
  if (!recordIs(schema)) {
    return "Any";
  }

  const anyOf = schema.anyOf;
  if (Array.isArray(anyOf) && anyOf.length > 0) {
    const union = anyOf
      .map((candidate) => pythonTypeFromSchema(candidate))
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
    return union.length > 0 ? union.join(" | ") : "Any";
  }

  const oneOf = schema.oneOf;
  if (Array.isArray(oneOf) && oneOf.length > 0) {
    const union = oneOf
      .map((candidate) => pythonTypeFromSchema(candidate))
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
    return union.length > 0 ? union.join(" | ") : "Any";
  }

  const type = schema.type;
  if (typeof type === "string") {
    if (type === "string") {
      return "str";
    }
    if (type === "integer") {
      return "int";
    }
    if (type === "number") {
      return "float";
    }
    if (type === "boolean") {
      return "bool";
    }
    if (type === "null") {
      return "None";
    }
    if (type === "array") {
      return `list[${pythonTypeFromSchema(schema.items)}]`;
    }
    if (type === "object") {
      const additional = schema.additionalProperties;
      if (additional === false) {
        return "dict[str, Any]";
      }
      return "dict[str, Any]";
    }
  }

  if (Array.isArray(type) && type.length > 0) {
    const union = type
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => pythonTypeFromSchema({ type: entry }))
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
    return union.length > 0 ? union.join(" | ") : "Any";
  }

  return "Any";
}

function pythonIdentifierIs(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function pythonDocstringEscape(value: string): string {
  return value.replace(/\"\"\"/g, '\\"\\"\\"');
}

function recordIs(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
