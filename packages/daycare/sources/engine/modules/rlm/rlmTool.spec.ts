import { describe, expect, it, vi } from "vitest";
import { Type } from "@sinclair/typebox";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import type { ToolResolver } from "../toolResolver.js";
import { rlmToolBuild } from "./rlmTool.js";

describe("rlmToolBuild", () => {
  it("defines run_python schema", () => {
    const tool = rlmToolBuild(createResolver(async () => okResult("x", "ok")));
    expect(tool.tool.name).toBe("run_python");
    expect(tool.tool.parameters).toMatchObject({
      type: "object",
      required: ["code"],
      properties: {
        code: {
          type: "string"
        }
      }
    });
  });

  it("executes python and formats output", async () => {
    const resolver = createResolver(async (name, args) => {
      if (name !== "echo") {
        throw new Error(`Unexpected tool ${name}`);
      }
      const payload = args as { text: string };
      return okResult(name, payload.text);
    });
    const tool = rlmToolBuild(resolver);

    const result = await tool.execute(
      { code: "print('debug')\nvalue = echo('hello')\nvalue" },
      createContext(),
      { id: "tool-call-1", name: "run_python" }
    );

    const text = messageText(result);
    expect(result.toolMessage.isError).toBe(false);
    expect(text).toContain("Python execution completed.");
    expect(text).toContain("Tool calls: 1");
    expect(text).toContain("debug");
    expect(text).toContain("hello");
  });

  it("returns syntax errors with recovery guidance", async () => {
    const tool = rlmToolBuild(createResolver(async () => okResult("x", "ok")));

    const result = await tool.execute(
      { code: "def broken(:\n  pass" },
      createContext(),
      { id: "tool-call-2", name: "run_python" }
    );

    expect(result.toolMessage.isError).toBe(true);
    expect(messageText(result)).toContain("Fix the code and retry");
  });

  it("returns runtime traceback for unhandled runtime errors", async () => {
    const tool = rlmToolBuild(createResolver(async () => okResult("x", "ok")));

    const result = await tool.execute(
      { code: "1 / 0" },
      createContext(),
      { id: "tool-call-3", name: "run_python" }
    );

    expect(result.toolMessage.isError).toBe(true);
    expect(messageText(result)).toContain("Python runtime error.");
    expect(messageText(result)).toContain("ZeroDivisionError");
  });
});

function createResolver(
  handler: (name: string, args: unknown) => Promise<ToolExecutionResult>
): ToolResolver {
  const tools = [
    {
      name: "echo",
      description: "Echo text.",
      parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
    },
    {
      name: "run_python",
      description: "meta",
      parameters: Type.Object({ code: Type.String() }, { additionalProperties: false })
    }
  ];

  return {
    listTools: () => tools,
    execute: vi.fn(async (toolCall) => handler(toolCall.name, toolCall.arguments))
  } as unknown as ToolResolver;
}

function createContext(): ToolExecutionContext {
  return {
    connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
    fileStore: null as unknown as ToolExecutionContext["fileStore"],
    auth: null as unknown as ToolExecutionContext["auth"],
    logger: console as unknown as ToolExecutionContext["logger"],
    assistant: null,
    permissions: {
      workingDir: "/tmp",
      writeDirs: [],
      readDirs: [],
      network: false,
      events: false
    },
    agent: null as unknown as ToolExecutionContext["agent"],
    source: "test",
    messageContext: {},
    agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
    heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
  };
}

function messageText(result: ToolExecutionResult): string {
  return result.toolMessage.content
    .filter((entry) => entry.type === "text")
    .map((entry) => ("text" in entry && typeof entry.text === "string" ? entry.text : ""))
    .join("\n");
}

function okResult(name: string, text: string): ToolExecutionResult {
  return {
    toolMessage: {
      role: "toolResult",
      toolCallId: "1",
      toolName: name,
      content: [{ type: "text", text }],
      isError: false,
      timestamp: Date.now()
    },
    files: []
  };
}
