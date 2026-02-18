# Daycare RLM `<say>` + `<run_python>` Flow

## Summary

In no-tools RLM mode, `<say>` blocks are split at the first `<run_python>` tag:
- `<say>` before the first `<run_python>` is sent immediately.
- `<say>` after the first `<run_python>` is trimmed and not delivered.
- On execution failure, the failed block is rewrite-trimmed from context history tail and no failure notice message is injected.

This keeps user-visible messages aligned with actual execution state while preserving full assistant text in context/history.

## Sequence

```mermaid
sequenceDiagram
  participant M as Model
  participant L as agentLoopRun
  participant P as rlmExecute
  participant U as User Connector

  M->>L: assistant text with <say> + <run_python>
  L->>L: split text at last </run_python>
  L->>U: send pre-run <say> blocks
  L->>P: execute extracted run_python code
  alt execution success
    P-->>L: result
    L->>M: add <python_result> success message
  else execution failure
    P-->>L: error
    L->>L: rewrite-trim history after failed run_python block
    L->>M: no synthetic failure notice message
  end
```
