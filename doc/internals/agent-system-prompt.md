# Agent System Prompt Build

System prompt rendering is centralized in `agentSystemPrompt()` and called from `Agent`.

It loads prompt files (`SOUL.md`, `USER.md`, `AGENTS.md`, `TOOLS.md`, `MEMORY.md`), renders
`PERMISSIONS.md` and `AGENTIC.md`, then renders `SYSTEM.md` with the merged context.

```mermaid
flowchart TD
  A[Agent handleMessage] --> B[agentSystemPrompt]
  B --> C[promptFileRead x5]
  B --> D[read PERMISSIONS.md]
  B --> E[read AGENTIC.md]
  B --> F[read SYSTEM.md]
  C --> G[templateContext]
  D --> H[permissions section]
  E --> I[agentic section]
  F --> J[final render]
  G --> J
  H --> J
  I --> J
```
