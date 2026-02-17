# RLM Checkpointing

## Overview

RLM checkpointing persists `run_python` interpreter progress into agent history so execution can survive a process restart.

Each `run_python` call now writes:

- `rlm_start` when execution begins
- `rlm_tool_call` before each inner tool call (includes VM snapshot)
- `rlm_tool_result` after each inner tool call
- `rlm_complete` when execution ends (success or error)

The outer assistant/tool protocol remains unchanged:

- assistant emits the `run_python` tool call
- `tool_result` completes that outer call

RLM checkpoint records are internal and are skipped when rebuilding model context.

## Normal Flow

```mermaid
sequenceDiagram
    participant LLM
    participant RLM as run_python
    participant VM as Monty VM
    participant Tool as Inner Tool
    participant History

    LLM->>RLM: run_python(code)
    Note over History: assistant_message (outer tool call)
    RLM->>History: rlm_start
    RLM->>VM: monty.start()
    VM->>RLM: snapshot (tool call)
    RLM->>History: rlm_tool_call (snapshot + args)
    RLM->>Tool: execute()
    Tool-->>RLM: result
    RLM->>History: rlm_tool_result
    RLM->>VM: resume(result)
    VM->>RLM: complete
    RLM->>History: rlm_complete
    RLM-->>LLM: tool_result (run_python)
```

## Restore Flow

```mermaid
sequenceDiagram
    participant Agent
    participant History
    participant VM as Restored VM
    participant Tool as Inner Tool

    Note over Agent: Process restarted
    Agent->>History: resolve pending rlm_start
    History-->>Agent: start + latest rlm_tool_call
    Agent->>VM: MontySnapshot.load(snapshot)
    Agent->>VM: resume(exception: "Process was restarted")
    VM->>Agent: next snapshot or complete
    alt next snapshot
        Agent->>History: rlm_tool_call
        Agent->>Tool: execute()
        Tool-->>Agent: result
        Agent->>History: rlm_tool_result
        Agent->>VM: resume(result)
    end
    Agent->>History: rlm_complete
    Agent->>History: tool_result (synthetic run_python completion)
    Agent->>History: user_message (<system_message origin="rlm_restore">...)
```

## Record Reference

- `rlm_start`
  - `toolCallId`, `code`, `preamble`
- `rlm_tool_call`
  - `toolCallId`, base64 `snapshot`, `printOutput`, `toolCallCount`, `toolName`, `toolArgs`
- `rlm_tool_result`
  - `toolCallId`, `toolName`, `toolResult`, `toolIsError`
- `rlm_complete`
  - `toolCallId`, `output`, `printOutput`, `toolCallCount`, `isError`, optional `error`

## Startup Recovery Behavior

- Startup scans history for an `rlm_start` without a matching `rlm_complete`.
- If a snapshot exists, execution resumes from that snapshot and injects a runtime error (`Process was restarted`) into the pending Python tool call.
- If no snapshot exists, recovery marks the run as failed (`rlm_complete` with error).
- In both paths, history is completed with:
  - synthetic outer `tool_result` for `run_python`
  - synthetic system-origin user message with `origin="rlm_restore"`
