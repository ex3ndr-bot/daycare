# Connectors

Connectors are the interface between Scout and external systems.
Scheduled work is handled by the cron runtime (see `cron.md`).

## Connector interface
Each connector exposes:
- `onMessage(handler)` to receive `ConnectorMessage` events.
- `sendMessage(targetId, message)` to respond.

Messages are normalized to:
```
{ text: string | null }
```

```mermaid
classDiagram
  class Connector {
    <<interface>>
    +onMessage(handler)
    +sendMessage(targetId, message)
  }
  class ConnectorMessage {
    +text: string | null
  }
  class MessageContext {
    +channelId: string
    +userId: string | null
    +sessionId?: string
  }
```

## Telegram connector
- Uses long polling by default.
- Persists `lastUpdateId` to `.scout/telegram-offset.json` for resume.
- Retries polling failures with exponential backoff and jitter.
- Handles SIGINT/SIGTERM and stops polling cleanly.

```mermaid
flowchart TD
  Start[TelegramConnector] --> Poll[Polling]
  Poll --> Msg[message event]
  Msg --> Track[track update_id]
  Track --> Persist[persist offset]
  Poll -->|error| Retry[backoff + retry]
  Shutdown[SIGINT/SIGTERM] --> Stop[stopPolling]
  Stop --> Persist
```
