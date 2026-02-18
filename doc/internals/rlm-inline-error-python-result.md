# RLM Inline Error `<python_result>` Injection

In no-tools RLM inline mode, failed `<run_python>` blocks now inject an error
`<python_result>` user message into context, matching the success path behavior.

## Why

Previously, on failure we only wrote history records and stopped executing remaining
blocks. Because raw `<run_python>` text is suppressed and `<say>` output is selective,
users could receive an empty response in some turns.

## Flow

```mermaid
sequenceDiagram
  participant M as Model
  participant L as agentLoopRun
  participant R as rlmExecute

  M->>L: assistant text with <run_python>
  L->>R: execute block
  alt success
    R-->>L: result
    L->>L: append <python_result> success
  else failure
    R-->>L: throws error
    L->>L: append history error record
    L->>L: append <python_result> error
    L->>L: trim failed tail blocks
  end
  L-->>M: next iteration includes python_result context
```

## Code

- `packages/daycare/sources/engine/agents/ops/agentLoopRun.ts`
