# Multiuser Filesystem Isolation

## Context

The codebase has a per-user directory system (`UserHome` under `<dataDir>/users/<userId>/`) but many code paths still reference a global `<configDir>/workspace` directory. This means:
- `config.workspaceDir` and `config.filesDir` exist on `Config` and are used throughout
- `permissionBuildDefault()` grants write access to global `~/.daycare/*.md` knowledge files
- Non-user agents (cron, heartbeat, permanent) fall back to global paths when they have no `UserHome`
- The memory plugin stores at `<workspaceDir>/memory` (global)
- `Apps` discovers from both global and per-user dirs
- `skillListUser()` always includes `~/.agents/skills`
- Generated images save to `<workingDir>/files/` instead of a dedicated downloads dir
- Connector-received files save via `FileStore` rooted at `userHome.desktop`

**Goal:** Remove the global workspace concept entirely. Every agent must have a `userId` and `UserHome`. Received files and generated images go to `<home>/downloads/`. Simplify `FileStore` — just save files to disk, no metadata JSON sidecars.

## Implementation Plan

### Task 1: Remove the memory plugin

Delete `sources/plugins/memory/` entirely (5 files: README.md, plugin.json, plugin.ts, store.ts, tool.ts). Plugins auto-discover via `plugin.json` so no registry to update.

Remove `memoryPath` from:
- `UserHome.knowledgePaths()` and `AgentPromptFilesPaths` type (`sources/engine/users/userHome.ts`)
- `agentPromptPathsResolve()` (`sources/engine/agents/ops/agentPromptPathsResolve.ts`)
- `agentPromptFilesEnsure()` (`sources/engine/agents/ops/agentPromptFilesEnsure.ts`)
- `permissionBuildDefault()` and `permissionBuildUser()` write paths
- `userHomeEnsure()` and `userHomeMigrate()` if they create/migrate the file
- `DEFAULT_MEMORY_PATH` from `sources/paths.ts`

Update tests referencing `memoryPath`.

### Task 2: Add `downloads` to `UserHome`

- Add `readonly downloads: string` to `UserHome` class → `path.join(this.home, "downloads")`
- Add `mkdir` in `userHomeEnsure()`
- Add `downloads` to `permissionBuildUser()` write/read paths
- Update `permissionBuildUser.spec.ts`

### Task 3: Simplify `FileStore` and route to `userHome.downloads`

Simplify `FileStore` — it's an internal utility for saving received/generated files. Remove metadata JSON sidecars and `get(id)` lookup. The filename pattern `<id>__<name>` is self-describing.

- `sources/files/store.ts`:
  - Remove `Config` constructor overload — only accept `basePath: string`
  - Remove `get(id)`, `metadataPath()`, `writeMetadata()` — no more JSON sidecar files
  - `saveBuffer` and `saveFromPath` return just `{ id, name, path, mimeType, size }` (derive from fs, no sidecar)
  - Remove `source` and `createdAt` from `StoredFile` type (unnecessary metadata)
- `sources/files/types.ts`: Simplify `StoredFile` — remove `source`, `createdAt`; or merge `StoredFile` and `FileReference` into one type
- `sources/engine/modules/tools/send-file.ts` line 163: Remove `fileStore.get(fileId)` path — `send_file` tool should resolve files by path only (the `fileId` param can be removed or resolved by scanning the downloads dir)
- `sources/engine/modules/say/sayFileResolve.ts` line 99: Remove `fileStorePathLookup` that calls `fileStore.get()` — just resolve the file by path directly
- `sources/engine/agents/agent.ts` line 106: Change `new FileStore(this.userHome.desktop)` → `new FileStore(this.userHome.downloads)`
- `sources/engine/engine.ts` line 131: Keep a system-level `FileStore` at `path.join(dataDir, "files")` for providers (image generation scratch area); agents no longer use it
- `sources/engine/modules/tools/image-generation.ts`: Save generated images to `toolContext.fileStore` (now downloads dir) instead of `<workingDir>/files/`
- `commands/doctor.ts` and `commands/add.ts`: Use `new FileStore(path.join(config.dataDir, "validate"))`

### Task 4: Require `userId` on all agents — remove `defaultPermissions` fallbacks

- `sources/engine/agents/agent.ts` line 119: Make `userHome` required (not optional). Throw if null.
- Line 132-134: Always use `permissionBuildUser(userHome)`, remove `permissionClone(defaultPermissions)` fallback
- Line 148: Pass `permissionBuildUser(userHome)` to `agentDescriptorWrite` instead of `config.defaultPermissions`
- Lines 372-375: Replace heartbeat `permissionMergeDefault(permissions, defaultPermissions)` with `permissionBuildUser(userHome)` as base
- `AgentSystem.resolveUserIdForDescriptor()`: Ensure it always returns a userId (fall back to owner)
- Update `permanentAgentToolBuild.ts` lines 109, 127, 140: Use `permissionBuildUser(agentSystem.userHomeForUserId(ownerUserId))` instead of `config.defaultPermissions`

### Task 5: Remove `config.defaultPermissions`

- Remove `defaultPermissions` from `Config` type (`configTypes.ts`) and `configResolve.ts`
- `sources/engine/cron/crons.ts` + `cronScheduler.ts`: Replace `defaultPermissions: SessionPermissions` with a `resolveDefaultPermissions` callback that resolves owner's `UserHome` at runtime
- `sources/engine/heartbeat/heartbeats.ts` + `heartbeatScheduler.ts`: Same pattern
- Make `AgentSystem.ownerUserIdEnsure()` public (currently private) so cron/heartbeat can resolve owner
- `sources/engine/agents/ops/agentDescriptorWrite.ts`: Remove `configDefaultPermissionsResolve` helper and the `Config`-based overload — always require explicit permissions
- `sources/engine/engine.ts` lines 361, 615: Replace `ensureWorkspaceDir(defaultPermissions.workingDir)` with `userHomeEnsure(ownerUserHome)` at startup
- Line 650: Remove `defaultPermissions` from config equality check

### Task 6: Remove `config.workspaceDir` and `config.filesDir`

- Remove both fields from `Config` type (`configTypes.ts`)
- Remove `resolveWorkspaceDir()` from `sources/engine/permissions.ts`
- Remove computation from `configResolve.ts`
- Remove `workspaceDir` from `AssistantSettings` in `settings.ts`
- Remove `permissionBuildDefault()` entirely (and its spec) — all callers now use `permissionBuildUser()`
- Remove `DEFAULT_SOUL_PATH`, `DEFAULT_USER_PATH`, `DEFAULT_AGENTS_PATH`, `DEFAULT_TOOLS_PATH` from `paths.ts`
- Update `agentPromptPathsResolve()` to require `UserHome` — remove `dataDir` and `DEFAULT_*` fallbacks
- Update `agentPromptFilesEnsure()` — remove default parameters
- Remove `filesDir`/`workspaceDir` from `engine.ts` config reload equality check

### Task 7: Remove global apps discovery

- `sources/engine/apps/appManager.ts`: Remove `appsDir` from `AppsOptions`, only scan `<usersDir>/<userId>/apps/`
- `engine.ts` line 354: `new Apps({ usersDir: config.usersDir })` instead of passing global `appsDir`
- `agentAppFolderPathResolve.ts`: Remove `workspaceDir` fallback — require `appsDir` from `UserHome`
- `agentSystemPromptSectionPermissions.ts` line 24: Remove `config.workspaceDir` fallback

### Task 8: Remove global skills root

- `sources/engine/skills/skillListUser.ts`: Remove `DEFAULT_USER_SKILLS_ROOT` from roots, make `userRoot` required
- Remove `DEFAULT_USER_SKILLS_ROOT` from `paths.ts`

### Task 9: Clean up permanent agent workspace resolution

- `permanentAgentToolBuild.ts` line 90: Anchor relative `workspaceDir` to user's `userHome.home` instead of `config.workspaceDir`
- Remove or refactor the local `resolveWorkspaceDir()` function (line 210)

### Task 10: Decouple migration from removed config fields

- `userHomeMigrate.ts`: Accept explicit `legacyPaths: { filesDir: string; appsDir: string }` instead of reading `config.workspaceDir`/`config.filesDir`
- At call site in `engine.ts`, compute legacy paths from raw settings:
  ```typescript
  const legacyWorkspace = computeLegacyWorkspace(config.configDir, config.settings.assistant);
  await userHomeMigrate(config, storage, {
      filesDir: path.join(legacyWorkspace, "files"),
      appsDir: path.join(legacyWorkspace, "apps")
  });
  ```

### Task 11: Update all test specs

~40 test files reference `workspaceDir`, `filesDir`, or `defaultPermissions` in config setup. These need updating to use `UserHome` and `permissionBuildUser()` instead. Key files:
- `configResolve.spec.ts`, `engine.spec.ts`, `agent.spec.ts`, `agentSystem.spec.ts`
- All `permissions/*.spec.ts` files
- `cronScheduler.spec.ts`, `heartbeatScheduler.spec.ts`
- `permanentAgentToolBuild.spec.ts`, `topologyToolBuild.spec.ts`
- `storage.spec.ts`, `storageUpgrade.spec.ts`
- All `agentOps/*.spec.ts` files

### Task 12: Final cleanup and docs

- Grep for any remaining `workspaceDir` in config contexts, `DEFAULT_*_PATH`, `resolveWorkspaceDir`
- Run full test suite, linter, typecheck
- Update plugin READMEs and `doc/PLUGINS.md` if they reference global workspace

## Target Directory Layout

```
<dataDir> (~/.daycare)
├── daycare.db
├── files/                        ← system scratch (provider temp files)
├── users/
│   ├── .migrated
│   └── <userId>/
│       ├── skills/
│       ├── apps/<app-id>/
│       │   ├── APP.md, PERMISSIONS.md, data/, state.json
│       └── home/
│           ├── desktop/          ← agent workingDir
│           ├── downloads/        ← FileStore root (received files + generated images)
│           ├── documents/
│           ├── developer/
│           └── knowledge/
│               ├── SOUL.md, USER.md, AGENTS.md, TOOLS.md
```

## Key Removals

- `Config.workspaceDir`, `Config.filesDir`, `Config.defaultPermissions`
- `resolveWorkspaceDir()`, `ensureWorkspaceDir()` from `engine/permissions.ts`
- `permissionBuildDefault()` and its spec
- `DEFAULT_SOUL_PATH`, `DEFAULT_USER_PATH`, `DEFAULT_AGENTS_PATH`, `DEFAULT_TOOLS_PATH`, `DEFAULT_MEMORY_PATH`, `DEFAULT_USER_SKILLS_ROOT` from `paths.ts`
- `AssistantSettings.workspaceDir`
- `FileStore(Config)` constructor overload, `get()`, metadata JSON sidecars, `StoredFile.source`/`createdAt`
- Entire `plugins/memory/` directory
- Global `appsDir` in `Apps` class

## Verification

1. `yarn typecheck` — must pass (no references to removed fields)
2. `yarn test` — all tests pass
3. `yarn lint` — clean
4. Grep for `workspaceDir` in non-test `.ts` files — only `SessionPermissions.workspaceDir` (per-user) should remain
5. Grep for `DEFAULT_.*_PATH` — should find none
6. Grep for `resolveWorkspaceDir` — should find none
