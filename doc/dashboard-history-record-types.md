# Dashboard History Record Types

The agent detail page now renders all persisted history record variants returned by
`GET /v1/engine/agents/:agentId/history`.

## Covered record types

- `start`
- `reset`
- `user_message`
- `assistant_message`
- `tool_result`
- `rlm_start`
- `rlm_tool_call`
- `rlm_tool_result`
- `rlm_complete`
- `assistant_rewrite`
- `note`

## Rendering flow

```mermaid
flowchart TD
  A[Fetch agent history records] --> B[Sort by timestamp desc]
  B --> C{Record type}
  C -->|Known type| D[Type-specific badge + summary]
  D --> E[Type-specific detail sections]
  C -->|Fallback| F[Generic event card]
```
