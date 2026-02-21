# Agent Group Channels

This document describes group channel support for Daycare agents.

## Overview

Channels provide shared group messaging between agents using `@username` mentions.

- Permanent agents now support optional `username` in their descriptor.
- Channels are persisted in SQLite `channels`.
- Channel members are persisted in SQLite `channel_members`.
- Channel messages are persisted in SQLite `channel_messages`.
- A designated leader agent always receives channel messages.
- Mentioned members receive targeted channel signal deliveries.

## Data Model

- `Channel`: `{ id, name, leader, members, createdAt, updatedAt }`
- `ChannelMember`: `{ agentId, username, joinedAt }`
- `ChannelMessage`: `{ id, channelName, senderUsername, text, mentions, createdAt }`

## Signal Flow

Channel delivery uses signal inbox events with signal type:

- `channel.<channelName>:message`

The signal payload includes:

- `channelName`
- `messageId`
- `senderUsername`
- `text`
- `mentions`
- `createdAt`
- `history` (recent messages for context formatting)

## Storage Layout

```mermaid
erDiagram
  channels ||--o{ channel_members : has
  channels ||--o{ channel_messages : has
  channels {
    string id PK
    string user_id
    string name
    string leader
    int created_at
    int updated_at
  }
  channel_members {
    int id PK
    string channel_id FK
    string user_id
    string agent_id
    string username
    int joined_at
  }
  channel_messages {
    string id PK
    string channel_id FK
    string user_id
    string sender_username
    string text
    string mentions
    int created_at
  }
```

## Wiring

```mermaid
graph LR
  AgentA[Agent sender] -->|channel_send| ChannelsFacade[Channels facade]
  ChannelsFacade -->|insert| ChannelMessages[(channel_messages)]
  ChannelsFacade -->|update| ChannelsTable[(channels)]
  ChannelsFacade -->|upsert| Members[(channel_members)]
  ChannelsFacade -->|signal: channel.dev:message| Leader[Leader agent]
  ChannelsFacade -->|signal: channel.dev:message| Mentioned[Mentioned members]
  Mentioned -->|formatted system message| AgentLoop[Agent inference loop]
  Leader -->|routing decisions| AgentLoop
```
