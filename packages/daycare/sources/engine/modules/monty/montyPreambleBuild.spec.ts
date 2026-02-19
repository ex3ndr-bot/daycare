import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import { configResolve } from "../../../config/configResolve.js";
import { Engine } from "../../engine.js";
import { EngineEventBus } from "../../ipc/events.js";
import { montyParameterEntriesBuild } from "./montyParameterEntriesBuild.js";
import { montyPreambleBuild } from "./montyPreambleBuild.js";

describe("montyPreambleBuild", () => {
  it("generates sync stubs with python hints", () => {
    const tools = [
      {
        name: "read_file",
        description: "Read a file from disk.",
        parameters: Type.Object(
          {
            path: Type.String(),
            retries: Type.Optional(Type.Integer()),
            verbose: Type.Optional(Type.Boolean())
          },
          { additionalProperties: false }
        )
      }
    ] as unknown as Tool[];

    const preamble = montyPreambleBuild(tools);

    expect(preamble).toContain("def read_file(path: str, retries: int | None = None, verbose: bool | None = None) -> str:");
    expect(preamble).toContain('"""Read a file from disk."""');
    expect(preamble).toContain("def __daycare_print__(*values: Any) -> None:");
    expect(preamble).toContain("ToolError = RuntimeError");
  });

  it("skips run_python and invalid python identifiers", () => {
    const tools = [
      {
        name: "run_python",
        description: "Meta tool",
        parameters: Type.Object({ code: Type.String() }, { additionalProperties: false })
      },
      {
        name: "search-v2",
        description: "invalid python name",
        parameters: Type.Object({ query: Type.String() }, { additionalProperties: false })
      },
      {
        name: "search_v2",
        description: "valid python name",
        parameters: Type.Object({ query: Type.String() }, { additionalProperties: false })
      }
    ] as unknown as Tool[];

    const preamble = montyPreambleBuild(tools);

    expect(preamble).not.toContain("def run_python");
    expect(preamble).not.toContain("def search-v2");
    expect(preamble).toContain("def search_v2(query: str) -> str:");
  });

  it("emits required parameters before optional parameters", () => {
    const tools = [
      {
        name: "create_task",
        description: "Create task",
        parameters: Type.Object(
          {
            note: Type.Optional(Type.String()),
            taskId: Type.String(),
            priority: Type.Optional(Type.Integer())
          },
          { additionalProperties: false }
        )
      }
    ] as unknown as Tool[];

    const preamble = montyPreambleBuild(tools);

    expect(preamble).toContain(
      "def create_task(taskId: str, note: str | None = None, priority: int | None = None) -> str:"
    );
  });

  it("generates per-tool python stubs one by one for runtime tools", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-monty-preamble-"));
    let engine: Engine | null = null;
    try {
      const config = configResolve(
        { features: { rlm: true }, engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
        path.join(dir, "settings.json")
      );
      engine = new Engine({ config, eventBus: new EngineEventBus() });
      await engine.start();

      const tools = engine.modules.tools.listTools();
      expect(tools.length).toBeGreaterThan(0);

      for (const tool of tools) {
        const preamble = montyPreambleBuild([tool]);
        const signature = pythonSignatureResolve(preamble, tool.name);

        if (tool.name === "run_python" || !pythonIdentifierIs(tool.name)) {
          expect(signature).toBeNull();
          continue;
        }

        expect(signature).not.toBeNull();
        expect(preamble).toContain(`def ${tool.name}(`);
        expect(preamble).toContain(") -> str:");

        const signatureParts = signaturePartsResolve(signature!);
        const parameterEntries = montyParameterEntriesBuild(tool);
        expect(signatureParts).toHaveLength(parameterEntries.length);

        for (const [index, entry] of parameterEntries.entries()) {
          const part = signatureParts[index] ?? "";
          expect(part.startsWith(`${entry.name}: `)).toBe(true);
          if (entry.required) {
            expect(part).not.toContain("= None");
            continue;
          }
          expect(part).toContain("= None");
        }
      }
    } finally {
      if (engine) {
        await engine.shutdown();
      }
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function pythonSignatureResolve(preamble: string, toolName: string): string | null {
  const line = preamble.split("\n").find((entry) => entry.includes(`def ${toolName}(`));
  if (!line) {
    return null;
  }
  const marker = `def ${toolName}(`;
  const markerIndex = line.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }
  const afterMarker = line.slice(markerIndex + marker.length);
  const endIndex = afterMarker.indexOf(") -> str:");
  if (endIndex < 0) {
    return null;
  }
  return afterMarker.slice(0, endIndex);
}

function pythonIdentifierIs(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function signaturePartsResolve(signature: string): string[] {
  if (signature.length === 0) {
    return [];
  }

  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of signature) {
    if (char === "[" || char === "(" || char === "{") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === "]" || char === ")" || char === "}") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        parts.push(trimmed);
      }
      current = "";
      continue;
    }
    current += char;
  }

  const tail = current.trim();
  if (tail.length > 0) {
    parts.push(tail);
  }
  return parts;
}
