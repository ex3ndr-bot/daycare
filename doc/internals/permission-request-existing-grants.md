# Permission Request Existing Grants

## Summary

`request_permission` now checks the target agent's current permissions before emitting a connector prompt.
If all requested permissions are already available, the tool returns immediately and does not create a pending approval token.
If only some are missing, only the missing subset is sent to the user.

## Flow

```mermaid
flowchart TD
  A[request_permission called] --> B[Normalize and parse tags]
  B --> C[Load target agent permissions]
  C --> D{Already allowed?}
  D -->|all| E[Return already granted tool result]
  D -->|partial| F[Build request from missing permissions only]
  D -->|none| F
  F --> G[Send connector permission prompt]
  G --> H[Wait for decision token]
  H --> I[Apply approved missing permissions]
```
