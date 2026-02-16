# Context compaction

Daycare runs automatic compaction to avoid hard context overflows. The agent estimates context usage
from recent history plus the current system prompt and compacts when thresholds are crossed.

## Strategy

- Warning threshold: 75% of `settings.agents.emergencyContextLimit`.
- Critical threshold: 90% of `settings.agents.emergencyContextLimit`.
- Estimates include history plus heuristic extras (system prompt, tool payloads, incoming raw text).
- When warning/critical, the agent notifies the user that compaction is starting, runs compaction
  immediately, and resumes inference with the compacted context.

## Compaction summary handling

When compaction runs, the agent:
1) records a reset marker in history
2) appends the compaction summary as a user message with an instruction to continue
3) resumes with the latest user message appended after the summary

## Flow

```mermaid
flowchart TD
  A[Incoming user message] --> B[Estimate history + heuristic extras]
  X[Extras: system prompt, tools, raw text] --> B
  B -->|Below warning| C[Run inference normally]
  B -->|Warning/critical| D[Send compaction start notice]
  D --> E[Run compaction summary]
  E --> F[Reset history + insert summary]
  F --> G[Resume inference with compacted context]
```

## Manual compaction command

Users can request manual compaction with `/compaction` (alias `/compact`).

```mermaid
flowchart TD
  A[/compaction command/] --> B[Resolve agent + connector]
  B --> C{Agent busy?}
  C -->|yes| D[Reply: busy]
  C -->|no| E[Run compaction summary]
  E --> F{Summary produced?}
  F -->|no| G[Reply: empty summary]
  F -->|yes| H[Reset history + insert summary]
  H --> I[Reply: session compacted]
```
