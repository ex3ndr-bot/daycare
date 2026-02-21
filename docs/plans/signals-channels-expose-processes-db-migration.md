# Migrate Signals, Channels, Expose, Processes to DB Storage

## Overview
Move the four remaining file-based subsystems (Signals, Channels, Expose, Processes) to SQLite-backed repositories with mandatory `userId` scoping. This follows the same repository pattern established by the cron/heartbeat migration: write-through cache, AsyncLock per entity, Prisma-style CRUD methods.

Each subsystem currently stores state as JSON/JSONL files on disk with no strict user scoping. After migration:
- All records live in SQLite tables
- Every record has a mandatory `user_id` column
- Repositories provide `findById()`, `findMany()`, `create()`, `update()`, `delete()`
- File-based storage code is removed
- Import migrations preserve existing data

## Implementation Status (2026-02-21)

- [x] Added DB row/record types for signals, channels, expose, and processes in `databaseTypes.ts`
- [x] Added repositories + unit tests for signals/channels/expose/processes persistence
- [x] Added migrations and import migrations (`20260222_*`) with migration tests
- [x] Wired `Storage` and `Engine` to new repositories
- [x] Migrated facades (`Signals`, `DelayedSignals`, `Channels`, `Exposes`, `Processes`) off file-based persistence
- [x] Updated tools/IPC/agent callsites for async subscription APIs and user-scoped create paths
- [x] Removed `channelStore.ts` and replaced name logic with `channelNameNormalize.ts`
- [x] Updated internal docs in `doc/` to describe new SQLite persistence and relationships
- [x] Typecheck passes (`yarn typecheck`)
- [x] Full tests pass (`yarn test`)
- [ ] Repo-wide lint baseline still has unrelated pre-existing diagnostics outside this migration scope

## Context (from discovery)

### Current storage mechanisms
| System | Files | userId? |
|--------|-------|---------|
| **Signals** | `signals/events.jsonl` (append), `signals/delayed.json`, in-memory subscriptions Map | Optional on source, present on subscriptions |
| **Channels** | `channels/{name}/channel.json` + `channels/{name}/history.jsonl` | None (agentId on members) |
| **Expose** | `expose/endpoints/{id}.json` | None (global) |
| **Processes** | `processes/{id}/record.json` + `sandbox.json` + `process.log` | None (plugin owner only) |

### Existing patterns to follow
- `CronTasksRepository` / `HeartbeatTasksRepository` in `sources/storage/`
- `databaseTypes.ts` for row/record type pairs
- Migration files in `sources/storage/migrations/`
- `_migrations.ts` for ordered migration registry

### Key files affected
- `sources/storage/databaseTypes.ts` - new row/record types
- `sources/storage/storage.ts` - new repository instances
- `sources/storage/migrations/_migrations.ts` - new migration entries
- `sources/engine/signals/signals.ts` - rewrite to use repository
- `sources/engine/signals/delayedSignals.ts` - rewrite to use repository
- `sources/engine/channels/channels.ts` - rewrite to use repository
- `sources/engine/channels/channelStore.ts` - **delete** (replaced by repository)
- `sources/engine/expose/exposes.ts` - rewrite to use repository
- `sources/engine/processes/processes.ts` - rewrite to use repository
- `sources/engine/engine.ts` - wire repositories into facades

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility during import migrations

## Testing Strategy
- **Unit tests**: required for every task
- Use in-memory SQLite (`:memory:`) for repository tests
- Test both success and error scenarios
- Run `yarn test` after each task

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with + prefix
- Document issues/blockers with ! prefix
- Update plan if implementation deviates from original scope

---

## Phase 1: Signals (simplest - events are append-only, subscriptions are small)

### Task 1: Add signal DB types to `databaseTypes.ts`
- [ ] Add `DatabaseSignalEventRow` type (id, user_id, type, source, data, created_at)
- [ ] Add `SignalEventDbRecord` type (camelCase mirror)
- [ ] Add `DatabaseSignalSubscriptionRow` type (id, user_id, agent_id, pattern, silent, created_at, updated_at)
- [ ] Add `SignalSubscriptionDbRecord` type (camelCase mirror)
- [ ] Add `DatabaseDelayedSignalRow` type (id, user_id, type, deliver_at, source, data, repeat_key, created_at, updated_at)
- [ ] Add `DelayedSignalDbRecord` type (camelCase mirror)
- [ ] Run typecheck - must pass before next task

### Task 2: Create `signalEventsRepository.ts`
- [ ] Implement `SignalEventsRepository` class with write-through cache pattern
- [ ] `create(record)` - insert signal event row
- [ ] `findMany(options: { userId?, type?, limit?, offset? })` - list with filtering
- [ ] `findRecent(limit?: number)` - last N events (default 200, max 1000)
- [ ] Write tests for create and findMany/findRecent (success + filtering)
- [ ] Write tests for userId scoping
- [ ] Run tests - must pass before next task

### Task 3: Create `signalSubscriptionsRepository.ts`
- [ ] Implement `SignalSubscriptionsRepository` class with write-through cache
- [ ] `create(record)` - insert subscription (upsert on userId+agentId+pattern)
- [ ] `delete(userId, agentId, pattern)` - remove subscription
- [ ] `findByUserAndAgent(userId, agentId, pattern)` - single lookup
- [ ] `findMany()` - list all subscriptions
- [ ] `findMatching(signalType, userId?)` - find subscriptions matching a signal type+user
- [ ] Write tests for CRUD operations
- [ ] Write tests for pattern matching integration
- [ ] Run tests - must pass before next task

### Task 4: Create `delayedSignalsRepository.ts`
- [ ] Implement `DelayedSignalsRepository` class with write-through cache
- [ ] `create(record)` - insert delayed signal (upsert on type+repeatKey)
- [ ] `findDue(now: number)` - find signals where deliverAt <= now
- [ ] `findMany()` - list all delayed signals
- [ ] `delete(id)` - remove after delivery
- [ ] `deleteByRepeatKey(type, repeatKey)` - cancel by repeat key
- [ ] Write tests for CRUD + due-time queries
- [ ] Run tests - must pass before next task

### Task 5: Create migration `20260222_add_signals.ts`
- [ ] Create `signals_events` table (id TEXT PK, user_id TEXT NOT NULL, type TEXT NOT NULL, source TEXT NOT NULL (JSON), data TEXT, created_at INTEGER NOT NULL)
- [ ] Create `signals_subscriptions` table (id TEXT PK, user_id TEXT NOT NULL, agent_id TEXT NOT NULL, pattern TEXT NOT NULL, silent INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(user_id, agent_id, pattern))
- [ ] Create `signals_delayed` table (id TEXT PK, user_id TEXT NOT NULL, type TEXT NOT NULL, deliver_at INTEGER NOT NULL, source TEXT NOT NULL (JSON), data TEXT, repeat_key TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)
- [ ] Add indexes: signals_events(user_id), signals_events(type), signals_events(created_at), signals_delayed(deliver_at), signals_subscriptions(user_id, agent_id)
- [ ] Register in `_migrations.ts`
- [ ] Write migration tests
- [ ] Run tests - must pass before next task

### Task 6: Create import migration `20260222_import_signals.ts`
- [ ] Read existing `signals/events.jsonl` and insert into `signals_events` (resolve userId from signal source or default to owner user)
- [ ] Read existing `signals/delayed.json` and insert into `signals_delayed`
- [ ] Use `INSERT OR IGNORE` for idempotency
- [ ] Write import migration tests with fixture data
- [ ] Run tests - must pass before next task

### Task 7: Wire `Signals` facade to repositories
- [ ] Change `Signals` constructor to accept repositories instead of configDir
- [ ] Rewrite `generate()` to use `signalEventsRepository.create()`
- [ ] Rewrite `subscribe()`/`unsubscribe()` to use `signalSubscriptionsRepository`
- [ ] Rewrite `listAll()`/`listRecent()` to use `signalEventsRepository`
- [ ] Rewrite `listSubscriptions()` to use repository
- [ ] Load subscriptions from DB on startup (restore in-memory pattern matching cache if needed for performance)
- [ ] Update `engine.ts` to wire repositories from Storage
- [ ] Update existing tests in `signals.spec.ts`
- [ ] Run tests - must pass before next task

### Task 8: Wire `DelayedSignals` facade to repository
- [ ] Change constructor to accept `DelayedSignalsRepository`
- [ ] Rewrite `schedule()` to use repository create/upsert
- [ ] Rewrite `cancel()` to use repository delete
- [ ] Rewrite `list()` to use repository findMany
- [ ] Rewrite tick/poll to use `findDue()`
- [ ] Remove file I/O (atomicWrite, fs.readFile for delayed.json)
- [ ] Update existing tests in `delayedSignals.spec.ts`
- [ ] Run tests - must pass before next task

### Task 9: Clean up signal file-based code
- [ ] Remove `ensureDir()` from Signals (no more signals/ directory needed)
- [ ] Remove JSONL append logic
- [ ] Remove `events.jsonl` and `delayed.json` file references
- [ ] Verify all signal tools still work (generate, subscribe, unsubscribe, events_csv)
- [ ] Verify IPC endpoints still work
- [ ] Run full test suite - must pass before next task

---

## Phase 2: Channels

### Task 10: Add channel DB types to `databaseTypes.ts`
- [ ] Add `DatabaseChannelRow` (id, user_id, name, leader, created_at, updated_at)
- [ ] Add `ChannelDbRecord` (camelCase mirror)
- [ ] Add `DatabaseChannelMemberRow` (id, channel_id, user_id, agent_id, username, joined_at)
- [ ] Add `ChannelMemberDbRecord` (camelCase mirror)
- [ ] Add `DatabaseChannelMessageRow` (id, channel_id, user_id, sender_username, text, mentions, created_at)
- [ ] Add `ChannelMessageDbRecord` (camelCase mirror)
- [ ] Run typecheck - must pass before next task

### Task 11: Create `channelsRepository.ts`
- [ ] Implement `ChannelsRepository` class with write-through cache
- [ ] `create(record)` - insert channel with initial leader member
- [ ] `findByName(name)` - lookup by normalized name
- [ ] `findMany(options?: { userId? })` - list channels, optionally filtered by userId
- [ ] `delete(id)` - cascade delete channel + members + messages
- [ ] `addMember(channelId, member)` - insert member row
- [ ] `removeMember(channelId, agentId)` - delete member row
- [ ] `findMembers(channelId)` - list channel members
- [ ] Write tests for channel CRUD
- [ ] Write tests for member operations
- [ ] Write tests for userId scoping
- [ ] Run tests - must pass before next task

### Task 12: Create `channelMessagesRepository.ts`
- [ ] Implement `ChannelMessagesRepository` class (no cache needed - append-heavy)
- [ ] `create(record)` - insert message
- [ ] `findRecent(channelId, limit?: number)` - last N messages (default 50, max 500)
- [ ] Write tests for create and findRecent
- [ ] Run tests - must pass before next task

### Task 13: Create migration `20260222_add_channels.ts`
- [ ] Create `channels` table (id TEXT PK, user_id TEXT NOT NULL, name TEXT NOT NULL UNIQUE, leader TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)
- [ ] Create `channel_members` table (id INTEGER PK AUTOINCREMENT, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, user_id TEXT NOT NULL, agent_id TEXT NOT NULL, username TEXT NOT NULL, joined_at INTEGER NOT NULL, UNIQUE(channel_id, agent_id))
- [ ] Create `channel_messages` table (id TEXT PK, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, user_id TEXT NOT NULL, sender_username TEXT NOT NULL, text TEXT NOT NULL, mentions TEXT NOT NULL (JSON array), created_at INTEGER NOT NULL)
- [ ] Add indexes: channels(user_id), channels(name), channel_members(channel_id), channel_messages(channel_id, created_at)
- [ ] Register in `_migrations.ts`
- [ ] Write migration tests
- [ ] Run tests - must pass before next task

### Task 14: Create import migration `20260222_import_channels.ts`
- [ ] Scan `channels/{name}/channel.json` files
- [ ] Insert channel records (resolve userId from leader agentId -> agent -> userId, default to owner)
- [ ] Insert member records from channel.members array
- [ ] Read `channels/{name}/history.jsonl` and insert message records
- [ ] Use `INSERT OR IGNORE` for idempotency
- [ ] Write import tests with fixture data
- [ ] Run tests - must pass before next task

### Task 15: Wire `Channels` facade to repositories
- [ ] Change constructor to accept repositories instead of configDir
- [ ] Rewrite `load()` to load from DB
- [ ] Rewrite `create()`, `delete()`, `get()`, `list()` to use `channelsRepository`
- [ ] Rewrite `addMember()`, `removeMember()` to use repository
- [ ] Rewrite `send()` to use `channelMessagesRepository.create()`
- [ ] Rewrite `getHistory()` to use `channelMessagesRepository.findRecent()`
- [ ] Remove dependency on `channelStore.ts`
- [ ] Update `engine.ts` wiring
- [ ] Update existing tests in `channels.spec.ts`
- [ ] Run tests - must pass before next task

### Task 16: Clean up channel file-based code
- [ ] Delete `channelStore.ts` and `channelStore.spec.ts`
- [ ] Remove `ensureDir()` and file I/O from Channels
- [ ] Verify all channel tools still work (create, send, history, add/remove member)
- [ ] Verify IPC endpoints still work
- [ ] Verify topology tool includes channels
- [ ] Run full test suite - must pass before next task

---

## Phase 3: Expose

### Task 17: Add expose DB types to `databaseTypes.ts`
- [ ] Add `DatabaseExposeEndpointRow` (id, user_id, target, provider, domain, mode, auth, created_at, updated_at)
- [ ] Add `ExposeEndpointDbRecord` (camelCase mirror with parsed target/auth objects)
- [ ] Run typecheck - must pass before next task

### Task 18: Create `exposeEndpointsRepository.ts`
- [ ] Implement `ExposeEndpointsRepository` class with write-through cache
- [ ] `create(record)` - insert endpoint
- [ ] `findById(id)` - lookup by id
- [ ] `findMany(options?: { userId? })` - list endpoints, optionally filtered
- [ ] `update(id, data)` - update endpoint fields (auth toggle, domain changes)
- [ ] `delete(id)` - remove endpoint
- [ ] Write tests for CRUD operations
- [ ] Write tests for userId scoping
- [ ] Run tests - must pass before next task

### Task 19: Create migration `20260222_add_expose.ts`
- [ ] Create `expose_endpoints` table (id TEXT PK, user_id TEXT NOT NULL, target TEXT NOT NULL (JSON), provider TEXT NOT NULL, domain TEXT NOT NULL, mode TEXT NOT NULL, auth TEXT (JSON, nullable), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)
- [ ] Add indexes: expose_endpoints(user_id), expose_endpoints(domain)
- [ ] Register in `_migrations.ts`
- [ ] Write migration tests
- [ ] Run tests - must pass before next task

### Task 20: Create import migration `20260222_import_expose.ts`
- [ ] Scan `expose/endpoints/{id}.json` files
- [ ] Insert endpoint records (resolve userId: default to owner user since expose has no user context)
- [ ] Use `INSERT OR IGNORE` for idempotency
- [ ] Write import tests with fixture data
- [ ] Run tests - must pass before next task

### Task 21: Wire `Exposes` facade to repository
- [ ] Change constructor to accept `ExposeEndpointsRepository`
- [ ] Rewrite `start()` to load from DB instead of scanning directory
- [ ] Rewrite `create()` to use `repository.create()` instead of atomicWrite
- [ ] Rewrite `update()` to use `repository.update()`
- [ ] Rewrite `remove()` to use `repository.delete()` instead of fs.rm
- [ ] Rewrite `list()` to use `repository.findMany()`
- [ ] Keep proxy logic unchanged (ExposeProxy stays as-is)
- [ ] Keep provider registration unchanged (runtime, not persisted)
- [ ] Update `engine.ts` wiring
- [ ] Update existing tests in `exposes.spec.ts`
- [ ] Run tests - must pass before next task

### Task 22: Clean up expose file-based code
- [ ] Remove `ensureDir()` and file I/O from Exposes
- [ ] Remove atomicWrite imports for endpoint persistence
- [ ] Verify all expose tools still work (create, list, update, remove)
- [ ] Verify topology tool includes expose
- [ ] Run full test suite - must pass before next task

---

## Phase 4: Processes (most complex - runtime state + log files)

### Task 23: Add process DB types to `databaseTypes.ts`
- [ ] Add `DatabaseProcessRow` (id, user_id, name, command, cwd, home, env, package_managers, allowed_domains, allow_local_binding, permissions, owner, keep_alive, desired_state, status, pid, boot_time_ms, restart_count, restart_failure_count, next_restart_at, settings_path, log_path, created_at, updated_at, last_started_at, last_exited_at)
- [ ] Add `ProcessDbRecord` (camelCase mirror with parsed JSON fields)
- [ ] Run typecheck - must pass before next task

### Task 24: Create `processesRepository.ts`
- [ ] Implement `ProcessesRepository` class with write-through cache
- [ ] `create(record)` - insert process record
- [ ] `findById(id)` - lookup by id
- [ ] `findMany(options?: { userId?, ownerId? })` - list with filtering
- [ ] `update(id, data)` - partial update (status, pid, restart counts, desired state, etc.)
- [ ] `delete(id)` - remove process record
- [ ] `deleteByOwner(ownerType, ownerId)` - bulk delete by plugin owner
- [ ] JSON columns: env, packageManagers, allowedDomains, permissions, owner
- [ ] Write tests for CRUD operations
- [ ] Write tests for owner filtering and userId scoping
- [ ] Run tests - must pass before next task

### Task 25: Create migration `20260222_add_processes.ts`
- [ ] Create `processes` table with all columns from ProcessDbRecord
- [ ] JSON columns: env, package_managers, allowed_domains, permissions, owner
- [ ] Add indexes: processes(user_id), processes(owner)
- [ ] Register in `_migrations.ts`
- [ ] Write migration tests
- [ ] Run tests - must pass before next task

### Task 26: Create import migration `20260222_import_processes.ts`
- [ ] Scan `processes/{id}/record.json` files
- [ ] Parse ProcessRecord (version 2 format)
- [ ] Insert process records (resolve userId: lookup owner plugin -> agent -> userId, default to owner user)
- [ ] Keep log_path and settings_path as-is (still on disk)
- [ ] Use `INSERT OR IGNORE` for idempotency
- [ ] Write import tests with fixture data
- [ ] Run tests - must pass before next task

### Task 27: Wire `Processes` facade to repository
- [ ] Change constructor to accept `ProcessesRepository` instead of baseDir for records
- [ ] Keep `baseDir` for log files only (processes still need log files on disk)
- [ ] Rewrite `load()` to read from DB instead of scanning directory
- [ ] Rewrite `create()` to use `repository.create()` + still create log dir
- [ ] Rewrite `get()`/`list()`/`listByOwner()` to use repository
- [ ] Rewrite `stop()` to use `repository.update()` for desiredState
- [ ] Rewrite `remove()`/`removeByOwner()` to use `repository.delete()`
- [ ] Rewrite internal state updates (pid, status, restartCount) to use repository
- [ ] Keep sandbox.json generation (runtime config, regenerated on start)
- [ ] Keep child process spawning/monitoring unchanged
- [ ] Update `engine.ts` wiring
- [ ] Update existing tests in `processes.spec.ts`
- [ ] Run tests - must pass before next task

### Task 28: Clean up process file-based code
- [ ] Remove `record.json` read/write from Processes
- [ ] Remove atomicWrite for process records
- [ ] Keep log file creation (still on disk)
- [ ] Keep sandbox.json writing (runtime, regenerated)
- [ ] Verify all process tools still work (start, list, get, stop, stop_all)
- [ ] Verify process lifecycle (keepAlive restart, boot time detection)
- [ ] Run full test suite - must pass before next task

---

## Phase 5: Final integration

### Task 29: Wire all repositories into Storage facade
- [ ] Add `signalEvents`, `signalSubscriptions`, `delayedSignals` repository fields to `Storage`
- [ ] Add `channels`, `channelMessages` repository fields to `Storage`
- [ ] Add `exposeEndpoints` repository field to `Storage`
- [ ] Add `processes` repository field to `Storage`
- [ ] Initialize all repositories in Storage constructor
- [ ] Run tests - must pass before next task

### Task 30: Verify acceptance criteria
- [ ] All four subsystems read/write from SQLite
- [ ] Every record has a mandatory userId
- [ ] Import migrations preserve existing file data
- [ ] All existing tests pass
- [ ] All tools work (signals: generate/subscribe/unsubscribe/events_csv; channels: create/send/history/members; expose: create/list/update/remove; processes: start/list/get/stop)
- [ ] IPC endpoints work for all four
- [ ] Topology tool includes all four
- [ ] Run linter (`yarn lint`) - all issues fixed
- [ ] Run typecheck (`yarn typecheck`) - passes
- [ ] Run full test suite (`yarn test`) - passes

### Task 31: Update documentation
- [ ] Update `doc/internals/signals.md` - DB storage, userId scoping
- [ ] Update `doc/internals/agent-group-channels.md` - DB storage, userId scoping
- [ ] Update `doc/internals/expose.md` - DB storage, userId scoping
- [ ] Update `doc/STORAGE.md` - new tables in storage inventory
- [ ] Add mermaid diagrams for new DB relationships

---

## Technical Details

### DB Schema Summary

```sql
-- Signals
CREATE TABLE signals_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    source TEXT NOT NULL,        -- JSON: SignalSource
    data TEXT,                   -- JSON: arbitrary payload
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_signals_events_user ON signals_events(user_id);
CREATE INDEX idx_signals_events_type ON signals_events(type);
CREATE INDEX idx_signals_events_created ON signals_events(created_at);

CREATE TABLE signals_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    pattern TEXT NOT NULL,
    silent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_id, agent_id, pattern)
);
CREATE INDEX idx_signals_subs_user_agent ON signals_subscriptions(user_id, agent_id);

CREATE TABLE signals_delayed (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    deliver_at INTEGER NOT NULL,
    source TEXT NOT NULL,        -- JSON: SignalSource
    data TEXT,                   -- JSON: arbitrary payload
    repeat_key TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_signals_delayed_deliver ON signals_delayed(deliver_at);

-- Channels
CREATE TABLE channels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    leader TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_channels_user ON channels(user_id);

CREATE TABLE channel_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    username TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    UNIQUE(channel_id, agent_id)
);
CREATE INDEX idx_channel_members_channel ON channel_members(channel_id);

CREATE TABLE channel_messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    sender_username TEXT NOT NULL,
    text TEXT NOT NULL,
    mentions TEXT NOT NULL,      -- JSON: string[]
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_channel_messages_channel_time ON channel_messages(channel_id, created_at);

-- Expose
CREATE TABLE expose_endpoints (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target TEXT NOT NULL,        -- JSON: ExposeTarget
    provider TEXT NOT NULL,
    domain TEXT NOT NULL,
    mode TEXT NOT NULL,
    auth TEXT,                   -- JSON: ExposeEndpointAuth | null
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_expose_user ON expose_endpoints(user_id);

-- Processes
CREATE TABLE processes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    cwd TEXT NOT NULL,
    home TEXT,
    env TEXT NOT NULL,           -- JSON: Record<string, string>
    package_managers TEXT NOT NULL, -- JSON: SandboxPackageManager[]
    allowed_domains TEXT NOT NULL, -- JSON: string[]
    allow_local_binding INTEGER NOT NULL DEFAULT 0,
    permissions TEXT NOT NULL,   -- JSON: SessionPermissions
    owner TEXT,                  -- JSON: ProcessOwner | null
    keep_alive INTEGER NOT NULL DEFAULT 0,
    desired_state TEXT NOT NULL DEFAULT 'running',
    status TEXT NOT NULL DEFAULT 'running',
    pid INTEGER,
    boot_time_ms INTEGER,
    restart_count INTEGER NOT NULL DEFAULT 0,
    restart_failure_count INTEGER NOT NULL DEFAULT 0,
    next_restart_at INTEGER,
    settings_path TEXT NOT NULL,
    log_path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_started_at INTEGER,
    last_exited_at INTEGER
);
CREATE INDEX idx_processes_user ON processes(user_id);
```

### userId Resolution Strategy for Import Migrations
1. **Signals**: Extract userId from `signal.source.userId` if present; fall back to owner user
2. **Channels**: Resolve leader agentId -> agent record -> userId; fall back to owner user
3. **Expose**: No user context exists; assign all to owner user
4. **Processes**: Resolve owner plugin -> plugin agent -> userId; fall back to owner user

### What stays on disk
- **Process log files**: `processes/{id}/process.log` (append-only, too large for DB)
- **Process sandbox.json**: Runtime config regenerated on each start (not persisted state)
- **Tunnel provider state**: Runtime only, managed by plugins

### What gets deleted
- `signals/events.jsonl` (after import)
- `signals/delayed.json` (after import)
- `channels/{name}/channel.json` (after import)
- `channels/{name}/history.jsonl` (after import)
- `expose/endpoints/{id}.json` (after import)
- `processes/{id}/record.json` (after import)
- `channelStore.ts` + `channelStore.spec.ts`

## Post-Completion
*Items requiring manual verification after all code changes*

**Manual verification:**
- Start engine with existing file-based data, verify import migration runs cleanly
- Create signal, verify it appears in DB with correct userId
- Create channel, send messages, verify all in DB
- Create expose endpoint, verify DB record
- Start a process, verify record in DB, log file on disk
- Multi-user scenario: verify records are scoped to correct userId
- Dashboard: verify all four pages still load and show data
