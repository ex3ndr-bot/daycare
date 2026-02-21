# Telegram Document Receive Fallback

## Summary

Telegram document updates now always include explicit text for agent handlers.  
When a document-only message arrives, the connector emits a `Document received: ...` notice, and keeps the download-failed suffix when storage fails.

## Behavior

- Successful document download with no text/caption: message contains `files` and `Document received: <name>.` text.
- Failed document download with no text/caption: message contains fallback text (`Document received ... (download failed).`).
- Existing text/caption behavior remains unchanged.

## Flow

```mermaid
flowchart TD
  A[Telegram update message] --> B{Has text command?}
  B -->|Yes| C[Dispatch command handlers]
  B -->|No| D[Extract files]
  D --> E{Document present and no user text?}
  E -->|Yes| F[Set document notice text]
  E -->|No| G[Use text or caption]
  F --> H[Dispatch message handlers]
  G --> H
```
