# App Review Tool Context

App review prompts now include the exact set of tools available to the running
app sandbox (name, description, and parameter schema).

This prevents false denials where the reviewer confuses Daycare tool names with
language/runtime built-ins (for example, interpreting tool `exec` as Python
`exec()`).

## Prompt flow

```mermaid
sequenceDiagram
  participant App as App Agent
  participant Exec as appToolExecutorBuild
  participant Review as appToolReview
  participant Model as Review Model

  App->>Exec: tool call (name + args)
  Exec->>Exec: resolve allowed runtime tools
  Exec->>Review: appToolReview(toolCall + availableTools + rules)
  Review->>Model: prompt with available tool context
  Model-->>Review: ALLOW or DENY: reason
  Review-->>Exec: decision
```

## Prompt additions

- Added section: `## Available Tools In This Sandbox`
- Added tool entries:
  - `Name`
  - `Description`
  - `Parameters` (JSON schema)
- Added explicit interpretation guard:
  - evaluate against provided tool list only
  - do not reinterpret names by language built-ins
