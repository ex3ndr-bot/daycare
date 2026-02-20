# Agent Session Control Tools

Daycare now includes two core tools for cross-agent session control:

- `agent_reset` posts `{ type: "reset", message?: string }` to a target agent inbox.
- `agent_compact` posts `{ type: "compact" }` to a target agent inbox.

Both tools:

- require `agentId`
- reject self-targeting (`agentId === caller agent id`)
- verify target existence via `agentSystem.agentExists(agentId)`
- return a typed summary with `targetAgentId`

Both tools are hidden from background agents by `toolListContextBuild` denylist filtering.

```mermaid
sequenceDiagram
    participant Caller as Foreground Agent
    participant Tool as agent_reset / agent_compact
    participant System as AgentSystem
    participant Target as Target Agent

    Caller->>Tool: execute({ agentId, ... })
    Tool->>System: agentExists(agentId)
    alt missing agent
      Tool-->>Caller: Error: Agent not found
    else agent exists
      Tool->>System: post({ agentId }, { type: "reset" | "compact" })
      System->>Target: enqueue inbox item
      Tool-->>Caller: summary + targetAgentId
    end
```
