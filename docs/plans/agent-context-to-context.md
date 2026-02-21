# Rename AgentContext → Context

## Overview
Rename `AgentContext` to `Context`, use `ctx` as the standard variable name everywhere, and make it the primary object for scoping all operations to a user+agent pair. Every entity (signals, processes, channels, cron tasks, heartbeat tasks, etc.) belongs to a user — `userId` must never be optional. Repositories receive `ctx` as the first parameter for scoped queries.

## Context (from discovery)

### Current State
- `AgentContext` class in `engine/agents/agentContext.ts` — simple readonly `{ agentId, userId }`
- Exported via `@/types`
- Used in: `ToolExecutionContext`, `AgentSystem`, `Agent`, `Crons`, `Heartbeats`, `Signals`, tool execution loop
- Variable name is inconsistent: `agentContext`, `targetAgentContext`, `context`

### Problems Being Solved
- `userId` is optional in many places: `SignalSource`, `CronTaskDefinition`, `ProcessCreateInput`, repository `findMany` options
- Heartbeat tasks have **no userId at all** in DB schema
- Repositories accept loose `userId?: string` in options instead of a typed context object
- Variable naming is inconsistent (`agentContext`, `context`, `targetAgentContext`)

### Files/Components Involved
- **Type definition**: `engine/agents/agentContext.ts`, `types.ts`
- **Engine facades**: `cron/crons.ts`, `heartbeat/heartbeats.ts`, `signals/signals.ts`, `signals/delayedSignals.ts`, `processes/processes.ts`
- **Agent system**: `agents/agentSystem.ts`, `agents/agent.ts`, `agents/ops/agentLoopRun.ts`
- **Tool types**: `modules/tools/types.ts` (`ToolExecutionContext.agentContext` field)
- **Tool implementations** (~30+ files accessing `context.agentContext?.userId`):
  - `tools/cron.ts`, `tools/signal.ts`, `tools/send-file.ts`
  - `tools/signalSubscribeToolBuild.ts`, `tools/signalUnsubscribeToolBuild.ts`
  - `tools/topologyToolBuild.ts`, `tools/permanentAgentToolBuild.ts`
  - `tools/exposeCreateToolBuild.ts`, `tools/sessionHistoryToolBuild.ts`
  - `tools/channelSendTool.ts`, `tools/channelHistoryTool.ts`, `tools/channelMemberTool.ts`, `tools/channelCreateTool.ts`
  - `tools/skillToolBuild.ts`, `tools/agentCompactTool.ts`, `tools/agentResetTool.ts`
  - `tools/sendUserMessageTool.ts`, `tools/image-generation.ts`, `tools/mermaid-png.ts`, `tools/background.ts`
  - `tools/permissions.ts`
  - `apps/appExecute.ts`, `apps/appRuleToolBuild.ts`, `apps/appInstallToolBuild.ts`, `apps/appToolExecutorBuild.ts`
  - `modules/rlm/rlmExecute.ts`, `modules/rlm/rlmRestore.ts`
  - `modules/toolResolver.ts`
  - `plugins/shell/processTools.ts`
- **Tool test files** (~25+ spec files): all corresponding `.spec.ts` files that mock `ToolExecutionContext`
- **Channels facade**: `channels/channels.ts` (calls `agentContextForAgentId` 5+ times)
- **Signal types**: `signals/signalTypes.ts`
- **Cron types**: `cron/cronTypes.ts`
- **Database types**: `storage/databaseTypes.ts`
- **All 13 repositories**: `storage/*Repository.ts`
- **Storage facade**: `storage/storage.ts`
- **Tests**: `agentContext.spec.ts`, `rlmTool.spec.ts`, `plugin.spec.ts`
- **Migrations**: new migration needed for heartbeat `user_id` column

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Rename AgentContext class → Context
- [x] Rename file `engine/agents/agentContext.ts` → `engine/agents/context.ts`
- [x] Rename class `AgentContext` → `Context` inside the file
- [x] Update export in `types.ts`: change `AgentContext` → `Context`
- [x] Rename test file `agentContext.spec.ts` → `context.spec.ts`
- [x] Update test to reference `Context` instead of `AgentContext`
- [x] Run tests — must pass before next task

### Task 2: Update all imports from AgentContext → Context in engine core
- [x] Update `engine/agents/agent.ts` — import and usage
- [x] Update `engine/agents/agentSystem.ts` — import, method return types, `new AgentContext()` → `new Context()`
- [x] Rename `agentContextForAgentId` method → `contextForAgentId` on `AgentSystem`
- [x] Update `engine/agents/ops/agentLoopRun.ts` — import and usage
- [x] Update `engine/cron/crons.ts` — import and usage
- [x] Update `engine/heartbeat/heartbeats.ts` — import and usage
- [x] Update `engine/signals/signals.ts` — import and usage
- [x] Update `engine/signals/delayedSignals.ts` — import and usage
- [x] Update `engine/channels/channels.ts` — all `agentContextForAgentId` calls → `contextForAgentId`
- [x] Run tests — must pass before next task

### Task 3: Update ToolExecutionContext and all tool implementations
- [x] Update `engine/modules/tools/types.ts` — rename `agentContext: AgentContext` → `ctx: Context` (required, not optional)
- [x] Update `engine/agents/agent.ts` — where `ToolExecutionContext` is constructed, set `ctx` field
- [x] Update `engine/modules/toolResolver.ts` — any `agentContext` → `ctx` references
- [x] Update all tool files that access `context.agentContext?.userId` → `context.ctx.userId` (no optional chaining — ctx is always present):
  - [x] `tools/cron.ts`
  - [x] `tools/signal.ts`
  - [x] `tools/send-file.ts`
  - [x] `tools/signalSubscribeToolBuild.ts`
  - [x] `tools/signalUnsubscribeToolBuild.ts`
  - [x] `tools/topologyToolBuild.ts`
  - [x] `tools/permanentAgentToolBuild.ts`
  - [x] `tools/exposeCreateToolBuild.ts`
  - [x] `tools/sessionHistoryToolBuild.ts`
  - [x] `tools/channelSendTool.ts`, `tools/channelHistoryTool.ts`, `tools/channelMemberTool.ts`, `tools/channelCreateTool.ts`
  - [x] `tools/skillToolBuild.ts`
  - [x] `tools/agentCompactTool.ts`, `tools/agentResetTool.ts`
  - [x] `tools/sendUserMessageTool.ts`
  - [x] `tools/image-generation.ts`, `tools/mermaid-png.ts`
  - [x] `tools/background.ts`
  - [x] `tools/permissions.ts`
- [x] Update app tool files:
  - [x] `apps/appExecute.ts` — remove `?.userId` optional chaining, use `ctx.userId`
  - [x] `apps/appRuleToolBuild.ts`
  - [x] `apps/appInstallToolBuild.ts`
  - [x] `apps/appToolExecutorBuild.ts`
- [x] Update RLM files:
  - [x] `modules/rlm/rlmExecute.ts`
  - [x] `modules/rlm/rlmRestore.ts`
- [x] Update plugin tool files:
  - [x] `plugins/shell/processTools.ts` — `toolContext.agentContext?.userId` → `toolContext.ctx.userId`
- [x] Run tests — must pass before next task

### Task 4: Update all tool test files
- [x] Update all `.spec.ts` files that mock `ToolExecutionContext` — change `agentContext:` → `ctx:` in mock objects
  - [x] `tools/signalSubscribeToolBuild.spec.ts`
  - [x] `tools/signalUnsubscribeToolBuild.spec.ts`
  - [x] `tools/topologyToolBuild.spec.ts`
  - [x] `tools/sessionHistoryToolBuild.spec.ts`
  - [x] `tools/permanentAgentToolBuild.spec.ts`
  - [x] `tools/signalEventsCsvToolBuild.spec.ts`
  - [x] `tools/signal.spec.ts`
  - [x] `tools/image-generation.spec.ts`
  - [x] `tools/sendUserMessageTool.spec.ts`
  - [x] `tools/mermaid-png.spec.ts`
  - [x] `tools/channelSendTool.spec.ts`, `tools/channelHistoryTool.spec.ts`, `tools/channelMemberTool.spec.ts`, `tools/channelCreateTool.spec.ts`
  - [x] `tools/background.spec.ts`
  - [x] `tools/skillToolBuild.spec.ts`
  - [x] `tools/permissions.spec.ts`
  - [x] `tools/agentCompactTool.spec.ts`, `tools/agentResetTool.spec.ts`
  - [x] `apps/appExecute.spec.ts`, `apps/appRuleToolBuild.spec.ts`, `apps/appInstallToolBuild.spec.ts`, `apps/appToolExecutorBuild.spec.ts`
  - [x] `modules/rlm/rlmTool.spec.ts`, `modules/rlm/rlmExecute.spec.ts`, `modules/rlm/rlmRestore.spec.ts`
  - [x] `modules/toolResolver.spec.ts`
  - [x] `plugins/shell/tool.spec.ts`, `plugins/shell/processTools.spec.ts`
  - [x] `plugins/monty-python/tool.spec.ts`
  - [x] `plugins/database/__tests__/plugin.spec.ts`
  - [x] `engine/agents/agent.spec.ts`, `engine/agents/agentSystem.spec.ts`
  - [x] `engine/modules/monty/montyPythonTypeFromSchemaRuntime.spec.ts`
- [x] Run tests — must pass before next task

### Task 5: Standardize variable name to `ctx`
- [x] Rename all remaining `agentContext` variables → `ctx` across engine code
- [x] Rename all `targetAgentContext` variables → `targetCtx`
- [x] Rename all `memberContext`, `leaderContext`, etc. → `memberCtx`, `leaderCtx` in channels
- [x] Update all callers of `contextForAgentId` to use `ctx` variable name
- [x] Run tests — must pass before next task

### Task 6: Make userId required in SignalSource
- [x] Update `signalTypes.ts` — remove `?` from `userId` on all `SignalSource` variants
- [x] Update `signals.ts` — remove fallback resolution logic (userId is always present)
- [x] Update `delayedSignals.ts` — remove optional userId handling
- [x] Update all signal creation sites to always provide userId
- [x] Update signal-related tests
- [x] Run tests — must pass before next task

### Task 7: Make userId required in CronTaskDefinition
- [x] Update `cronTypes.ts` — make `userId` required (not optional) in `CronTaskDefinition` and `CronTaskContext`
- [x] Update `cronTypes.ts` — make `agentId` required where appropriate
- [x] Update `databaseTypes.ts` — change `CronTaskDbRecord.userId` from `string | null` → `string`
- [x] Update `cronTasksRepository.ts` — adjust queries/types for required userId
- [x] Update `crons.ts` facade — remove fallback resolution (`task.userId ?? targetAgentContext?.userId`)
- [x] Update cron-related tests
- [x] Run tests — must pass before next task

### Task 8: Add userId to heartbeat tasks (DB migration + repository)
- [x] Create new migration to add `user_id TEXT NOT NULL` column to `tasks_heartbeat` table
- [x] Update `databaseTypes.ts` — add `userId: string` to `HeartbeatTaskDbRecord` and related types
- [x] Update `heartbeatTasksRepository.ts` — include userId in CRUD operations
- [x] Update `heartbeats.ts` facade — use userId from task record directly (no more runtime resolution)
- [x] Update heartbeat-related tests
- [x] Run tests — must pass before next task

### Task 9: Make userId required in remaining entity types
- [x] Update `ProcessCreateInput` — make `userId` required
- [x] Update `processes.ts` facade — ensure userId always provided
- [x] Audit all remaining types in `databaseTypes.ts` for optional userId — make required
- [x] Update any remaining optional userId in entity types across engine code
- [x] Run tests — must pass before next task

### Task 10: Update repositories to accept ctx as first parameter
- [x] Define a lightweight `Context` import in storage layer (or import from `@/types`)
- [x] Update `signalEventsRepository.ts` — `findMany(ctx, options)` with required ctx
- [x] Update `signalSubscriptionsRepository.ts` — `findMatching(ctx, signalType)`, `findByUserAndAgent(ctx)`
- [x] Update `delayedSignalsRepository.ts` — `findMany(ctx, options)` with required ctx
- [x] Update `channelsRepository.ts` — `findMany(ctx, options)` with required ctx
- [x] Update `channelMessagesRepository.ts` — scoped methods take ctx
- [x] Update `exposeEndpointsRepository.ts` — `findMany(ctx, options)` with required ctx
- [x] Update `processesRepository.ts` — `findMany(ctx, options)` with required ctx
- [x] Update `cronTasksRepository.ts` — scoped methods take ctx
- [x] Update `heartbeatTasksRepository.ts` — scoped methods take ctx
- [x] Keep system-level queries (e.g., scheduler loading all tasks) without ctx requirement
- [x] Update all repository callers in engine facades to pass ctx
- [x] Update repository tests
- [x] Run tests — must pass before next task

### Task 11: Verify acceptance criteria
- [x] Verify `AgentContext` is fully gone — no references remain
- [x] Verify `ctx` is the standard variable name (no `agentContext` variables)
- [x] Verify userId is not optional in any entity type
- [x] Verify all repositories accept ctx for scoped queries
- [x] Verify heartbeat tasks have userId
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`)
- [x] Run type checker (`yarn typecheck`)
- [x] Fix any lint/type issues

### Task 12: Update documentation
- [x] Update any relevant docs in `/doc/` referencing AgentContext
- [x] Add mermaid diagram showing Context flow through the system

## Technical Details

### Context class (unchanged shape, new name)
```typescript
// engine/agents/context.ts
export class Context {
    readonly agentId: string;
    readonly userId: string;
    constructor(agentId: string, userId: string) {
        this.agentId = agentId;
        this.userId = userId;
    }
}
```

### Repository method signature pattern
```typescript
// Scoped query — ctx required as first param
async findMany(ctx: Context, options?: FindManyOptions): Promise<Record[]>

// System-level query — no ctx (for schedulers loading all tasks)
async findAll(options?: FindAllOptions): Promise<Record[]>
```

### Variable naming convention
```typescript
// Always use "ctx" for Context instances
const ctx = new Context(agentId, userId);

// When multiple contexts exist, use descriptive prefix
const targetCtx = await agentSystem.contextForAgentId(targetAgentId);
```

### ToolExecutionContext change
```typescript
export type ToolExecutionContext<State = Record<string, unknown>> = {
    ctx: Context;  // was: agentContext: AgentContext
    // ... other fields unchanged
};
```

### Migration for heartbeat tasks
```sql
ALTER TABLE tasks_heartbeat ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
-- Then update existing rows with resolved userId from target agents
```

## Post-Completion

**Manual verification:**
- Verify agent execution flow works end-to-end with new Context naming
- Verify cron/heartbeat tasks fire correctly with required userId
- Verify signal delivery scopes correctly by userId
