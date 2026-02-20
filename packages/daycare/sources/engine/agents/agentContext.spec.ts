import { describe, expect, it } from "vitest";

import { AgentContext } from "./agentContext.js";

describe("AgentContext", () => {
  it("stores agentId and userId from constructor", () => {
    const context = new AgentContext("agent-1", "user-1");
    expect(context.agentId).toBe("agent-1");
    expect(context.userId).toBe("user-1");
  });

  it("is readonly", () => {
    const context = new AgentContext("agent-1", "user-1");
    if (false) {
      // @ts-expect-error AgentContext fields are readonly
      context.agentId = "agent-2";
      // @ts-expect-error AgentContext fields are readonly
      context.userId = "user-2";
    }
    expect(context.agentId).toBe("agent-1");
    expect(context.userId).toBe("user-1");
  });
});
