# Session History Tool

`read_session_history` lets an agent inspect another session's history by `sessionId`.

- `sessionId`: target session id to read (required)
- `summarized`: when omitted, defaults to `true`
  - `true`: return a compact summary with counts, range, and latest snapshots
  - `false`: return full JSON history payload

```mermaid
sequenceDiagram
  participant Agent as Calling Agent
  participant Tool as read_session_history
  participant Disk as Agent Store
  Agent->>Tool: sessionId + summarized?
  Tool->>Disk: read descriptor.json
  Tool->>Disk: read history.jsonl
  alt summarized=true (default)
    Tool-->>Agent: summary text + recordCount
  else summarized=false
    Tool-->>Agent: full JSON history + recordCount
  end
```
