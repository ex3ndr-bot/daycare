# Unified Topology Tool

## Overview
Replace three separate listing tools (`list_agents`, `heartbeat_list`, and the missing cron/signal list tools) with a single `topology` tool that returns a complete snapshot of the running system. The model always gets the full picture before making any changes.

The tool returns short summaries for each section — enough to identify items and understand wiring, not full prompts/configs.

Items belonging to the calling agent are marked with `(You)` so the model immediately knows which agents, cron tasks, and signal subscriptions are its own. The caller's agent ID comes from `toolContext.agent.id`.

## Context (from discovery)

**Files involved:**
- `packages/daycare/sources/engine/modules/tools/agentListToolBuild.ts` — current `list_agents` tool (to be removed)
- `packages/daycare/sources/engine/modules/tools/heartbeat.ts` — contains `buildHeartbeatListTool` (to be removed from this file)
- `packages/daycare/sources/engine/modules/tools/cron.ts` — no list tool exists yet
- `packages/daycare/sources/engine/modules/tools/signal.ts` — no subscription list exists
- `packages/daycare/sources/engine/engine.ts` — tool registration (lines 297-323)

**Data sources (facades):**
- `agentList(config)` → agents from disk (id, type, name, lifecycle, updatedAt)
- `toolContext.heartbeats.listTasks()` → `HeartbeatDefinition[]` (id, title, lastRunAt)
- `toolContext.agentSystem.crons.listTasks()` → `CronTaskWithPaths[]` (id, name, schedule, enabled)
- `toolContext.agentSystem.signals.listSubscriptions()` → `SignalSubscription[]` (agentId, pattern, silent)

**Patterns:**
- Tools are `ToolDefinition` objects with `tool` (name, description, parameters) + `execute`
- File naming: `domainVerbFile.ts` exporting `domainVerbFunction()`
- TypeBox for parameter schemas
- Return `{ toolMessage, files: [] }`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change

## Testing Strategy
- **Unit tests**: test the topology tool output formatting (mock the facade data sources)
- Existing tests for removed tools should be deleted

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Create `topologyToolBuild.ts` with the unified topology tool
- [x] Create `packages/daycare/sources/engine/modules/tools/topologyToolBuild.ts`
- [x] Define empty TypeBox parameter schema (no args needed)
- [x] Implement `topologyToolBuild(): ToolDefinition` that gathers all four data sources:
  - Agents: call `agentList(config)`, map to `{ id, type, label, lifecycle }`
  - Crons: call `crons.listTasks()`, map to `{ id, name, schedule, enabled, agentId }`
  - Heartbeats: call `heartbeats.listTasks()`, map to `{ id, title, lastRunAt }`
  - Signal subscriptions: call `signals.listSubscriptions()`, map to `{ agentId, pattern, silent }`
- [x] Mark items belonging to the caller with `(You)` using `toolContext.agent.id`:
  - Agents: append `(You)` when `entry.agentId === callerAgentId`
  - Cron tasks: append `(You)` when `cron.agentId === callerAgentId`
  - Signal subscriptions: append `(You)` when `sub.agentId === callerAgentId`
  - Heartbeats: no `agentId` field, no marking
- [x] Format text output in sections:
  ```
  ## Agents (N)
  abc123 (You) type=user label="Telegram / John" lifecycle=active
  def456 type=permanent name=monitor lifecycle=active

  ## Cron Tasks (N)
  daily-report: Daily Report schedule="0 9 * * *" enabled=true (You)
  cleanup: Cleanup schedule="0 0 * * 0" enabled=true

  ## Heartbeat Tasks (N)
  check-health: Health Check lastRun=2025-01-15T10:00:00Z

  ## Signal Subscriptions (N)
  agent=abc123 pattern=build:* silent=true (You)
  agent=def456 pattern=deploy:done silent=false
  ```
- [x] Include structured `details` with all four arrays (include `isYou: boolean` flag in each item)
- [x] The tool needs `crons: Crons` and `signals: Signals` as parameters (similar to how `buildCronTool(crons)` works), since these aren't on `ToolExecutionContext.heartbeats` — check what's available on `ToolExecutionContext`
- [x] Write tests for `topologyToolBuild` covering: empty state, populated state, mixed sections, `(You)` markers on caller-owned items
- [x] Run tests — must pass before next task

### Task 2: Register the new tool and remove old listing tools from engine.ts
- [x] In `engine.ts`: add `import { topologyToolBuild } from` and register `this.modules.tools.register("core", topologyToolBuild(...))`
- [x] Remove registration of `buildHeartbeatListTool()` (line 305)
- [x] Remove registration of `agentListToolBuild()` (line 309)
- [x] Update the debug log string to replace `agent_listing` and `heartbeat` entries with `topology`
- [x] Run tests — must pass before next task

### Task 3: Remove the old tool files/exports
- [x] Delete `packages/daycare/sources/engine/modules/tools/agentListToolBuild.ts` entirely
- [x] Remove `buildHeartbeatListTool` function from `heartbeat.ts` (keep other heartbeat tools: run, add, remove)
- [x] Remove the `listSchema` in `heartbeat.ts` if no longer used
- [x] Delete any existing test file for `agentListToolBuild.spec.ts` if present
- [x] Remove any imports of deleted tools from other files (grep for references)
- [x] Run tests — must pass before next task

### Task 4: Verify acceptance criteria
- [x] Verify the `topology` tool returns agents, crons, heartbeats, and signal subscriptions
- [x] Verify `list_agents` and `heartbeat_list` tools no longer exist
- [x] Run full test suite (`yarn test`)
- [x] Run type-check (`yarn typecheck`)
- [x] Run linter if available (no lint script is configured in this repo)

### Task 5: [Final] Update documentation
- [x] Update `ACTORS.md` if the tool change affects agent wiring documentation (not required: no actor/signal topology change)
- [x] Add/update doc in `doc/` if topology tool warrants a mention

## Technical Details

**Tool name:** `topology`

**Parameters:** none (empty object schema)

**Caller identification:** `toolContext.agent.id` provides the calling agent's ID. Items belonging to the caller are marked `(You)` in text output and `isYou: true` in details.

**Output format (text):**
```
## Agents (3)
abc123 (You) type=user label="Telegram / John" lifecycle=active
def456 type=permanent name=monitor lifecycle=active
ghi789 type=system tag=cron lifecycle=active

## Cron Tasks (2)
daily-report: Daily Report schedule="0 9 * * *" enabled=true (You)
cleanup: Cleanup schedule="0 0 * * 0" enabled=true

## Heartbeat Tasks (1)
check-health: Health Check lastRun=2025-01-15T10:00:00Z

## Signal Subscriptions (2)
agent=abc123 pattern=build:* silent=true (You)
agent=def456 pattern=deploy:done silent=false
```

**Output format (details):**
```typescript
{
  callerAgentId: string,
  agents: Array<{ id, type, label, lifecycle, isYou }>,
  crons: Array<{ id, name, schedule, enabled, agentId, isYou }>,
  heartbeats: Array<{ id, title, lastRunAt }>,
  signalSubscriptions: Array<{ agentId, pattern, silent, isYou }>
}
```

**Dependencies needed by the tool builder function:**
- `crons: Crons` — for `listTasks()`
- `signals: Signals` — for `listSubscriptions()`
- Agent list and heartbeats are accessed via `toolContext` in the execute function

## Post-Completion

**Manual verification:**
- Start the agent and call the `topology` tool to verify real output
- Confirm old tool names are not available to the model
