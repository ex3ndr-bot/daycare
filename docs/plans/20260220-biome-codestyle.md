# Biome Code Style Setup

## Overview
Install Biome as the unified formatter and linter for the daycare monorepo. Adopts the holdmybeer config (4-space indent, 120 char lines, double quotes, semicolons, no trailing commas) adapted for daycare paths. Reformats all 674+ existing TypeScript files in one shot.

## Context
- **Reference config:** `~/Developer/holdmybeer/biome.json` (Biome 2.4.2)
- **Current state:** No formatter/linter; 2-space indentation; manual style enforcement
- **Scope:** All `packages/*` workspaces (daycare, daycare-dashboard, daycare-factory)
- **Package manager:** Yarn 1.x monorepo

## Development Approach
- Complete each task fully before moving to the next
- **CRITICAL: all tests must pass before starting next task**
- The bulk reformat commit should be isolated so git blame remains useful

## Implementation Steps

### Task 1: Install Biome and add config
- [ ] Add `@biomejs/biome` 2.4.2 as a root devDependency (`yarn add -D -W @biomejs/biome@2.4.2`)
- [ ] Create `biome.json` at repo root, adapted from holdmybeer:
  ```json
  {
      "$schema": "https://biomejs.dev/schemas/2.4.2/schema.json",
      "vcs": {
          "enabled": true,
          "clientKind": "git",
          "useIgnoreFile": true
      },
      "formatter": {
          "enabled": true,
          "indentStyle": "space",
          "indentWidth": 4,
          "lineWidth": 120
      },
      "javascript": {
          "formatter": {
              "quoteStyle": "double",
              "semicolons": "always",
              "trailingCommas": "none"
          }
      },
      "linter": {
          "enabled": true,
          "rules": {
              "recommended": true,
              "complexity": {
                  "noForEach": "off"
              },
              "style": {
                  "noNonNullAssertion": "off",
                  "useNodejsImportProtocol": "error"
              },
              "suspicious": {
                  "noExplicitAny": "warn"
              }
          }
      },
      "files": {
          "includes": [
              "packages/*/sources/**/*.ts",
              "packages/*/sources/**/*.tsx"
          ]
      }
  }
  ```
- [ ] Add root scripts to `package.json`:
  - `"lint": "biome check"`
  - `"lint:fix": "biome check --write"`
- [ ] Verify `yarn lint` runs without crashing (lint errors expected at this stage)

### Task 2: Bulk reformat all files
- [ ] Run `yarn lint:fix` to reformat all TypeScript files (2→4 space indent, quote style, etc.)
- [ ] Run `yarn typecheck` — must pass (formatting is type-safe)
- [ ] Run `yarn test` — must pass (formatting doesn't change behavior)
- [ ] Commit the bulk reformat as an isolated commit (e.g., `style: reformat codebase with biome`)

### Task 3: Fix linter errors
- [ ] Run `yarn lint` and review remaining lint errors/warnings
- [ ] Fix auto-fixable issues with `yarn lint:fix` (if any remain after task 2)
- [ ] Triage remaining manual lint errors — fix straightforward ones, add biome-ignore comments for false positives or intentional patterns
- [ ] Suppress rules at file level if a pattern is used broadly (e.g., if `noExplicitAny` warns in too many places, leave as warning)
- [ ] Run `yarn typecheck` — must pass
- [ ] Run `yarn test` — must pass
- [ ] Commit lint fixes separately from the bulk reformat

### Task 4: Verify and document
- [ ] Run final `yarn lint` — should be clean (0 errors, warnings acceptable)
- [ ] Run `yarn test` — full suite passes
- [ ] Run `yarn typecheck` — passes
- [ ] Update `CLAUDE.md` / `AGENTS.md` to mention Biome:
  - Add `yarn lint` / `yarn lint:fix` to Build/Test/Development Commands section
  - Note that Biome enforces formatting (4-space indent, 120 char lines)
- [ ] Update `doc/` if there's a development guide that references code style

## Technical Details
- **Biome version:** 2.4.2 (matches holdmybeer)
- **File scope:** `packages/*/sources/**/*.ts` and `*.tsx` (covers all workspace source dirs)
- **VCS integration:** Uses `.gitignore` to skip `node_modules`, `dist`, etc.
- **Git blame preservation:** Isolated reformat commit can be added to `.git-blame-ignore-revs` if desired

## Post-Completion
- Consider adding a `.git-blame-ignore-revs` file with the bulk reformat commit hash so `git blame` skips it
- CI pipeline could add `yarn lint` as a check (if/when CI exists)
- Editor integration: team members can install the Biome VS Code/Cursor extension for format-on-save
