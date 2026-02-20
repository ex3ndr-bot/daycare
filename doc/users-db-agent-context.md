# Users DB and Agent Context

## Summary
This change introduces first-class users in storage and propagates user identity through runtime execution paths.

## Connector Key Format
User connector identities are normalized as:

```text
<connector>:<userId>
```

Examples:
- `telegram:12345`
- `whatsapp:+15551234567`

`channelId` is intentionally excluded from connector keys.

## Migration Logic
1. Create `users` and `user_connector_keys` tables with unique connector keys and a single-owner partial index.
2. Bootstrap users from existing `user` agents by connector key.
3. Assign earliest discovered user as owner.
4. If no `user` agents exist, create one owner user.
5. Add and backfill `agents.user_id` and enforce `NOT NULL`.
6. Add `idx_agents_user_id` for lookups.

## Schema Diagram
```mermaid
erDiagram
  USERS {
    TEXT id PK
    INTEGER is_owner
    INTEGER created_at
    INTEGER updated_at
  }

  USER_CONNECTOR_KEYS {
    INTEGER id PK
    TEXT user_id FK
    TEXT connector_key UK
  }

  AGENTS {
    TEXT id PK
    TEXT type
    TEXT user_id
    TEXT descriptor
    INTEGER created_at
    INTEGER updated_at
  }

  USERS ||--o{ USER_CONNECTOR_KEYS : has
  USERS ||--o{ AGENTS : owns
```

## Runtime Context Flow
`AgentContext(agentId, userId)` is now carried into tool execution and used for user-scoped signal behavior.

```mermaid
flowchart LR
  A[AgentSystem resolves agent] --> B[Agent has userId]
  B --> C[AgentContext agentId + userId]
  C --> D[ToolExecutionContext.agentContext]
  D --> E[signal.subscribe userId agentId pattern]
  D --> F[signal.generate source.userId]
  E --> G[Signals delivery filter by userId]
  F --> G
  C --> H[Cron/Heartbeat contexts include userId]
```

## Agent Ownership Rules
- `user` agents: resolved by connector key; user auto-created when unseen.
- `subagent` and `app` agents: inherit parent user when available.
- system/cron/heartbeat/permanent agents: owner user by default.

## Notes
- Signal subscriptions are now keyed as `userId::agentId::pattern`.
- Signal delivery checks user scope before dispatch.
