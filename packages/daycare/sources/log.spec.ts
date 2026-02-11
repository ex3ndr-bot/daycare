import { describe, expect, it } from "vitest";

import { formatPrettyMessage } from "./log.js";

describe("formatPrettyMessage", () => {
  it("includes structured fields in pretty text output", () => {
    const output = stripAnsi(
      formatPrettyMessage(
        {
          time: "2026-01-02T03:04:05.000Z",
          level: 30,
          module: "engine.test",
          msg: "engine:start",
          agentId: "agent-1",
          retries: 2
        },
        "msg",
        "info"
      )
    );

    expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\] \[engine\.test {9}\] engine:start agentId=agent-1 retries=2/);
  });

  it("keeps plugin module labels in parenthesis", () => {
    const output = stripAnsi(
      formatPrettyMessage(
        {
          time: "2026-01-02T03:04:05.000Z",
          level: 30,
          module: "plugin.telegram",
          msg: "connector:start"
        },
        "msg",
        "info"
      )
    );

    expect(output).toContain("(telegram            ) connector:start");
  });

  it("does not duplicate keys already present in the message", () => {
    const output = stripAnsi(
      formatPrettyMessage(
        {
          time: "2026-01-02T03:04:05.000Z",
          level: 30,
          module: "engine.test",
          msg: "agent:restore agentId=agent-1",
          agentId: "agent-1",
          state: "awake"
        },
        "msg",
        "info"
      )
    );

    expect(output).toContain("agent:restore agentId=agent-1 state=awake");
    expect(output).not.toContain("agentId=agent-1 agentId=agent-1");
  });

  it("summarizes error objects into message text", () => {
    const output = stripAnsi(
      formatPrettyMessage(
        {
          time: "2026-01-02T03:04:05.000Z",
          level: 50,
          module: "engine.test",
          msg: "engine:tick-failed",
          error: {
            type: "Error",
            code: "E_TEST",
            message: "boom"
          }
        },
        "msg",
        "error"
      )
    );

    expect(output).toContain("engine:tick-failed error=Error:code:E_TEST:boom");
  });
});

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}
