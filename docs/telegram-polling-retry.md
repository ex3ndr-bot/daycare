# Telegram polling retry

This note documents how the Telegram connector handles polling errors and conflicts.

```mermaid
flowchart TD
  A[Polling error] --> B{Conflict 409?}
  B -- yes --> C{Webhook cleared?}
  C -- no --> D[Clear webhook + retry soon]
  C -- yes --> E[Stop polling + retry w/ backoff]
  B -- no --> F{Pending retry or polling disabled?}
  F -- yes --> G[Ignore]
  F -- no --> H[Schedule retry w/ backoff]
```

## Notes
- Polling restarts are owned by the connector retry logic; the underlying library is started with `restart: false`.
- A polling conflict stops the current polling loop and continues retrying with backoff.
- `startPolling` is guarded to avoid concurrent start attempts while a previous start is still in flight.
