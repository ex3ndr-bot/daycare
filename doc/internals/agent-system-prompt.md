# Agent System Prompt

System prompt rendering is centralized in `agentSystemPrompt()` and called from `Agent`.

`Agent` now passes only:
- `descriptor`
- `permissions`
- selected `provider`/`model`
- `agentSystem`

`Agent` ensures prompt files before prompt rendering using:
- `agentPromptPathsResolve(config.dataDir)`
- `agentPromptFilesEnsure(paths)`

`agentSystemPrompt()` derives connector, cron, app-folder, and feature context internally, loads memory files (`SOUL.md`, `USER.md`, `AGENTS.md`, `TOOLS.md`, `MEMORY.md`), then renders deterministic sections:
- Preamble
- Permissions
- Autonomous operation
- Workspace
- Tool Calling
- Agents, Topology, Signals, Channels
- Skills
- Messages
- Files

```mermaid
flowchart TD
  A[Agent handleMessage] --> A1[Resolve prompt paths from config.dataDir]
  A1 --> A2[agentPromptFilesEnsure]
  A2 --> B[agentSystemPrompt]
  B --> C[Resolve runtime from descriptor + permissions + agentSystem]
  B --> D[Resolve dynamic prompt parts]
  D --> D1[pluginPrompt]
  D --> D2[skillsPrompt]
  D --> D3[permanentAgentsPrompt]
  D --> D4[agentPrompt/replaceSystemPrompt]
  D --> D5[noToolsPrompt]
  B --> E[Load memory files x5]
  C --> F[Section context]
  D --> F
  E --> F
  F --> G[Render 9 section templates]
  G --> H[Render SYSTEM.md composition template]
```
