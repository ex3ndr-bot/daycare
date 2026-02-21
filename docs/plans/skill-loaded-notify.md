# Skill Loaded Connector Notification

## Overview
When an agent loads a skill via the `skill` tool, send a user-facing notification message through the connector (Telegram, WhatsApp, etc.) so the user sees that a skill was activated. Only applies to user-type agents that have a direct connector.

## Context
- Skill tool: `sources/engine/modules/tools/skillToolBuild.ts`
- Connector target resolution: `agentDescriptorTargetResolve()`
- Pattern: same as `send-file.ts` - resolve target, get connector, sendMessage

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Small, focused change in a single file

## Implementation Steps

### Task 1: Add connector notification to skill tool
- [ ] Import `agentDescriptorTargetResolve` in `skillToolBuild.ts`
- [ ] After skill resolves successfully, resolve connector target from agent descriptor
- [ ] If user-type agent, get connector and send a formatted notification message
- [ ] Send notification for both embedded and sandbox modes
- [ ] Write tests for the notification logic
- [ ] Run tests - must pass

### Task 2: Verify and lint
- [ ] Run full test suite
- [ ] Run linter
