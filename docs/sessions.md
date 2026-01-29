# Sessions

Sessions provide per-channel sequencing of messages, ensuring each session is handled one message at a time.

```mermaid
sequenceDiagram
  participant Connector
  participant SessionManager
  participant Session
  participant Handler
  Connector->>SessionManager: handleMessage(source, message, context)
  SessionManager->>Session: enqueue(message)
  SessionManager->>Handler: process queue sequentially
  Handler-->>SessionManager: done
```

## Session rules
- Session id defaults to `${source}:${channelId}`.
- A connector can override with `context.sessionId`.
- Messages are queued and processed in order.

## Key types
- `SessionMessage` stores message, context, and timestamps.
- `SessionContext` holds mutable per-session state.
