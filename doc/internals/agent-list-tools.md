# Topology Tool

Daycare provides a unified `topology` tool for runtime discovery. It returns:

- persisted agents (`agentList(config)`)
- cron tasks (`crons.listTasks()`)
- heartbeat tasks (`heartbeats.listTasks()`)
- signal subscriptions (`signals.listSubscriptions()`)

Items belonging to the calling agent are marked with `(You)` in text output and `isYou: true` in `details`.

```mermaid
flowchart TD
  A[Tool call topology] --> B[agentList]
  A --> C[crons.listTasks]
  A --> D[heartbeats.listTasks]
  A --> E[signals.listSubscriptions]
  B --> F[agents section]
  C --> G[cron section]
  D --> H[heartbeat section]
  E --> I[subscriptions section]
  F --> J[text + details]
  G --> J
  H --> J
  I --> J
```
