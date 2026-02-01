# Permissions

This document summarizes the permission helper functions extracted from the engine runtime.

```mermaid
flowchart TD
  Engine[Engine runtime] --> Default[permissionBuildDefault]
  Engine --> Cron[permissionBuildCron]
  Cron --> Ensure[permissionEnsureDefaultFile]
  Engine --> Merge[permissionMergeDefault]
  Engine --> Apply[permissionApply]
  Engine --> Tag[permissionFormatTag]
  Engine --> Describe[permissionDescribeDecision]
```

## Helper roles

- `permissionBuildDefault`: create the initial session permissions from workspace + config paths.
- `permissionBuildCron`: build cron-specific permissions that inherit defaults.
- `permissionEnsureDefaultFile`: merge default read/write directories into a session.
- `permissionMergeDefault`: combine existing session permissions with defaults.
- `permissionApply`: apply an approved permission decision to a session.
- `permissionFormatTag`: format the `@web`/`@read`/`@write` tag used in logs.
- `permissionDescribeDecision`: human-readable label for permission decisions.
