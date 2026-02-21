# Telegram Document Receive Fallback

## Summary

Telegram document updates now always reach agent handlers, even when file download fails.  
When a document-only message cannot be downloaded, the connector emits a fallback text message instead of an empty payload.

## Behavior

- Successful document download: message contains `files`.
- Failed document download with no text/caption: message contains fallback text (`Document received ... (download failed).`).
- Existing text/caption behavior remains unchanged.

## Flow

```mermaid
flowchart TD
  A[Telegram update message] --> B{Has text command?}
  B -->|Yes| C[Dispatch command handlers]
  B -->|No| D[Extract files]
  D --> E{Document present and no file saved?}
  E -->|Yes| F[Set fallback text]
  E -->|No| G[Use text or caption]
  F --> H[Dispatch message handlers]
  G --> H
```
