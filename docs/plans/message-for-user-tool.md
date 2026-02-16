# Message-for-User Tool

## Overview
Add a `send_user_message` tool that allows background agents to send user-facing messages through the foreground agent's channel. Unlike `send_agent_message` (which delivers internal system messages that the foreground agent treats as internal updates), `send_user_message` forces the foreground agent to present the content to the user. The content arrives as raw/internal data that the foreground agent reformats into a user-friendly message.

- **Problem:** Background agents currently can only send system messages via `send_agent_message`, which the foreground agent treats as internal updates and may ignore or not relay to the user.
- **Solution:** A new tool + message tag (`<message_for_user>`) that explicitly instructs the foreground agent to relay the content to the user.
- **Integration:** Follows existing patterns — tool in `tools/`, message builder in `messages/`, prompt update in `SYSTEM.md`.

## Context
- Tool registration: `engine.ts:351-387` registers core tools via `this.modules.tools.register()`
- Existing pattern: `send_agent_message` in `background.ts` posts `system_message` to target agent
- System message handling: `agent.ts:626-663` — `handleSystemMessage()` converts non-silent system messages into regular messages that trigger inference
- Message format: `messageBuildSystemText.ts` wraps text in `<system_message>` XML tags
- Tool filtering: `toolListContextBuild.ts:20-23` — `BACKGROUND_TOOL_DENYLIST` controls which tools background agents cannot use
- System prompt: `SYSTEM.md:51` explains system messages as "internal agent updates, not user requests"
- Agent inbox types: `agentTypes.ts:85-90` defines `AgentInboxSystemMessage`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Testing Strategy
- **Unit tests**: required for every task
- Pure functions (`messageBuildUserFacing`, tool builder) get dedicated test files

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add `messageBuildUserFacing` function
- [x] Create `packages/daycare/sources/engine/messages/messageBuildUserFacing.ts` — builds `<message_for_user origin="agentId">content</message_for_user>` XML wrapper (mirrors `messageBuildSystemText` pattern)
- [x] Create `packages/daycare/sources/engine/messages/messageIsUserFacing.ts` — detects `<message_for_user>` tag in message text (returns `{ text: string, origin: string } | null`)
- [x] Write tests for `messageBuildUserFacing` (success + edge cases: empty text, missing origin)
- [x] Write tests for `messageIsUserFacing` (match, no match, malformed)
- [x] Run tests — must pass before next task

### Task 2: Add `send_user_message` tool
- [x] Create `packages/daycare/sources/engine/modules/tools/sendUserMessageTool.ts` — follows `buildSendAgentMessageTool` pattern:
  - Schema: `{ text: string }` (required) — the raw/internal data to relay
  - Resolves target to foreground agent (same logic as `send_agent_message` default target)
  - Posts as `system_message` but wraps text using `messageBuildUserFacing()` so the content arrives inside `<message_for_user>` tags
  - Non-silent so it triggers inference on the foreground agent
- [x] Add to `BACKGROUND_TOOL_DENYLIST` inverted: ensure `send_user_message` is NOT in the denylist (available to background agents). Also add it to `BACKGROUND_TOOL_DENYLIST` for... actually, this tool should be background-only, so add it to a foreground filter or handle in tool filtering
- [x] Register tool in `engine.ts` alongside other core tools
- [x] Write tests for `sendUserMessageTool` (tool result format, error cases)
- [x] Run tests — must pass before next task

### Task 3: Update tool filtering — background-only
- [x] In `toolListContextBuild.ts`, add `send_user_message` to a foreground denylist (new `FOREGROUND_TOOL_DENYLIST` set, or inline filter for `agentKind === "foreground"`)
- [x] Write test for tool filtering (verify `send_user_message` excluded for foreground, included for background)
- [x] Run tests — must pass before next task

### Task 4: Update system prompt (`SYSTEM.md`)
- [x] Add documentation for `<message_for_user>` tag in the Messages section — explain that when the agent receives `<message_for_user origin="agentId">content</message_for_user>`, it MUST present the content to the user in a user-friendly way (rephrase/reformat the internal data)
- [x] Add documentation for `send_user_message` tool in the Agents section for background agents — explain it's for sending user-facing information through the foreground agent
- [x] Run tests — must pass before next task

### Task 5: Verify acceptance criteria
- [x] Verify background agent can use `send_user_message` to send data to foreground agent
- [x] Verify foreground agent cannot access `send_user_message` tool
- [x] Verify the message arrives with `<message_for_user>` tags and triggers inference
- [x] Run full test suite (unit tests)
- [x] Run linter — all issues must be fixed

### Task 6: [Final] Update documentation
- [x] Update `doc/` with relevant changes if needed
- [x] Create mermaid diagram showing the message flow

## Technical Details

### Message format
```xml
<message_for_user origin="agentId">
Raw internal data that needs to be presented to the user.
Could contain structured info, status updates, results, etc.
</message_for_user>
```

### Tool schema
```typescript
Type.Object({
  text: Type.String({ minLength: 1 })
}, { additionalProperties: false })
```

### Flow
```
Background Agent → send_user_message("task completed, 3 files modified: a.ts, b.ts, c.ts")
  → wraps in <message_for_user origin="bgAgentId">...</message_for_user>
  → posts as system_message (non-silent) to foreground agent
  → foreground agent inference triggered
  → prompt instructs: "present this to the user in a friendly way"
  → foreground agent sends user-friendly message via connector
```

### Files touched
- **New:** `messageBuildUserFacing.ts`, `messageIsUserFacing.ts`, `sendUserMessageTool.ts` + their `.spec.ts` files
- **Modified:** `engine.ts` (register tool), `toolListContextBuild.ts` (foreground filter), `SYSTEM.md` (prompt docs)

## Post-Completion
- Manual verification: test with a real background agent sending `send_user_message` and verify the foreground agent relays to user
- Verify prompt wording produces good user-facing reformatting behavior
