# Heartbeat and Cron Context Scope

## Summary
Heartbeat and cron task create/delete operations now require `ctx` and derive ownership from `ctx.userId`.

## Behavior
- Creation APIs require `ctx` and do not accept `userId` from payloads.
- Stored ownership is derived from `ctx.userId`.
- Deletion APIs require `ctx` and only delete when `task.userId === trim(ctx.userId)`.
- Cross-user delete attempts return `false`.
- Heartbeats reject create-overwrite when an existing task id belongs to another user.
- Crons reject create when an existing task id belongs to another user.

## Flow
```mermaid
flowchart TD
  A[Tool call with Context] --> B{Create or Delete}
  B -->|Create heartbeat| C[heartbeats.addTask ctx args]
  B -->|Delete heartbeat| D[heartbeats.removeTask ctx id]
  B -->|Create cron| E[crons.addTask ctx definition]
  B -->|Delete cron| F[crons.deleteTask ctx id]

  C --> G[heartbeatScheduler.createTask]
  E --> H[cronScheduler.addTask]
  D --> I[heartbeatScheduler.deleteTask]
  F --> J[cronScheduler.deleteTask]

  G --> K[userId = trim(ctx.userId)]
  H --> L[userId = trim(ctx.userId)]
  I --> M[delete only when existing.userId == trim(ctx.userId)]
  J --> N[delete only when existing.userId == trim(ctx.userId)]
```
