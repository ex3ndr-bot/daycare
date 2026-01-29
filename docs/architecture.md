# Architecture

Scout is a CLI-driven agent runner that wires connectors to a session manager.

Key pieces:
- **CLI** (`sources/main.ts`) sets up commands and logging.
- **Connectors** expose `onMessage`/`sendMessage`.
- **Cron scheduler** emits messages on timers for internal automation.
- **Session manager** serializes handling per session.
- **Logging** is centralized via `initLogging`.

```mermaid
flowchart LR
  CLI[CLI: scout] --> Start[start command]
  Start -->|config| Connectors
  Connectors -->|message| Sessions[SessionManager]
  Cron[CronScheduler] -->|message| Sessions
  Sessions -->|handler| Echo[echo handler]
  Echo -->|sendMessage| Connectors
  CLI --> Logging[initLogging]
```

## Message lifecycle (current)
1. Connector emits a `ConnectorMessage` and `MessageContext`.
2. `SessionManager` routes to a session (by source + channel or explicit sessionId).
3. Session processes messages sequentially.
4. Handler echoes the message back through the originating connector.
