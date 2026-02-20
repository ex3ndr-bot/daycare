# Context Overflow Reset Removal

Daycare no longer uses heuristic text matching to classify inference failures as context overflow.
Inference errors now follow the standard error path and do not trigger emergency session reset automatically.

```mermaid
flowchart LR
  A[Inference response/error] --> B{stopReason/error}
  B -->|aborted| C[user aborted flow]
  B -->|error| D[send \"Inference failed.\"]
  B -->|other| E[normal response flow]
  D --> F[no emergency reset]
```

## Why

- Heuristic matching of free-form error text caused false positives.
- Non-overflow failures (for example token/rate-limit wording) could trigger unwanted session resets.

