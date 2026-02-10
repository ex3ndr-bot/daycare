# daycare-factory

## Overview

`daycare-factory` is a CLI wrapper that runs a containerized build using a task folder containing `TASK.md`, `AGENTS.md`, and `daycare-factory.yaml`.

The host `out/` folder is bind-mounted into the container so build artifacts are produced directly on the host.
The host `~/.pi` directory is bind-mounted as read-only to provide Pi auth (`~/.pi/agent/auth.json`) to the container.

## Build flow

```mermaid
flowchart TD
  A[CLI: daycare-factory build TASK_DIR] --> B[Resolve paths: TASK.md config out]
  B --> C[Validate TASK.md and AGENTS.md exist]
  C --> D[Reset out directory unless --keep-out]
  D --> E[Read daycare-factory.yaml]
  E --> F[Remove existing container by name if enabled]
  F --> G[Create container from configured image]
  G --> H[Mount TASK.md, AGENTS.md, and out plus host ~/.pi as readonly]
  H --> I[Run internal daycare-factory command inside container]
  I --> J[Internal command verifies it is running in Docker]
  J --> K[Copy TASK.md and AGENTS.md to out/]
  K --> L[Create Pi SDK session with SessionManager.inMemory]
  L --> M[Append session + command records to out/build.jsonl]
  M --> N[Run Pi prompt from TASK.md + AGENTS.md via createAgentSession]
  N --> O[Execute configured buildCommand]
  O --> P[Execute optional testCommand]
  P --> Q{Build/test pass?}
  Q -- Yes --> R[Optional container cleanup]
  R --> S[Done: outputs available in host out]
  Q -- No --> T{Attempts left?}
  T -- Yes --> U[Feed failure output to Pi and retry]
  U --> N
  T -- No --> V[Fail build with last exit code]
```

Pi prompt/auth failures are treated as hard failures. The flow does not include
fallback behavior.

## Repo-backed E2E fixture

The e2e script uses a committed fixture folder:
`packages/daycare-factory/examples/e2e-repo-task`.
The fixture keeps `out/` in git so generated artifacts can be inspected directly.

```mermaid
flowchart LR
  A[scripts/factoryE2e.sh] --> B[examples/e2e-repo-task/TASK.md]
  A --> C[examples/e2e-repo-task/daycare-factory.yaml]
  A --> D[examples/e2e-repo-task/out/]
  D --> E[Generated artifacts after run]
```

## Config contract

Required field:
- `image`: Docker image used to start the build container.
- `buildCommand`: command array executed by the in-container internal runner.

Optional fields:
- `testCommand`: command array executed after `buildCommand` for validation.
- `testMaxAttempts`: max correction attempts when `testCommand` fails (default `5`).
- `containerName`: stable container name; defaults to `daycare-factory-<task-folder-name>`.
- `command`: command array executed in the container.
- `workingDirectory`: container working directory.
- `taskMountPath`: mount target for `TASK.md`.
- `outMountPath`: mount target for host `out/`.
- `env`: environment variables for the container process.
- `removeExistingContainer`: remove previous container with same name before run.
- `removeContainerOnExit`: remove container after run.

## History output

Each build attempt appends JSON lines to `out/build.jsonl` including:
- Pi session events (`pi.*`)
- command results (`command.build`, `command.test`)
- attempt boundaries (`attempt.start`)
