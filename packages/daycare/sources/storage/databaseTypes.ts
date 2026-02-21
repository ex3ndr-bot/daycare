import type {
    AgentDescriptor,
    AgentLifecycleState,
    AgentTokenEntry,
    AgentTokenStats,
    ExecGateDefinition,
    SessionPermissions
} from "@/types";

export type DatabaseAgentRow = {
    id: string;
    user_id: string;
    type: AgentDescriptor["type"];
    descriptor: string;
    active_session_id: string | null;
    permissions: string;
    tokens: string | null;
    stats: string;
    lifecycle: AgentLifecycleState;
    created_at: number;
    updated_at: number;
};

export type DatabaseSessionRow = {
    id: string;
    agent_id: string;
    inference_session_id: string | null;
    created_at: number;
    reset_message: string | null;
};

export type DatabaseSessionHistoryRow = {
    id: number;
    session_id: string;
    type: string;
    at: number;
    data: string;
};

export type AgentDbRecord = {
    id: string;
    userId: string;
    type: AgentDescriptor["type"];
    descriptor: AgentDescriptor;
    activeSessionId: string | null;
    permissions: SessionPermissions;
    tokens: AgentTokenEntry | null;
    stats: AgentTokenStats;
    lifecycle: AgentLifecycleState;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseCronTaskRow = {
    id: string;
    task_uid: string;
    user_id: string | null;
    name: string;
    description: string | null;
    schedule: string;
    prompt: string;
    agent_id: string | null;
    gate: string | null;
    enabled: number;
    delete_after_run: number;
    last_run_at: number | null;
    created_at: number;
    updated_at: number;
};

export type CronTaskDbRecord = {
    id: string;
    taskUid: string;
    userId: string | null;
    name: string;
    description: string | null;
    schedule: string;
    prompt: string;
    agentId: string | null;
    gate: ExecGateDefinition | null;
    enabled: boolean;
    deleteAfterRun: boolean;
    lastRunAt: number | null;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseHeartbeatTaskRow = {
    id: string;
    title: string;
    prompt: string;
    gate: string | null;
    last_run_at: number | null;
    created_at: number;
    updated_at: number;
};

export type HeartbeatTaskDbRecord = {
    id: string;
    title: string;
    prompt: string;
    gate: ExecGateDefinition | null;
    lastRunAt: number | null;
    createdAt: number;
    updatedAt: number;
};

export type DatabaseUserRow = {
    id: string;
    is_owner: number;
    created_at: number;
    updated_at: number;
};

export type DatabaseUserConnectorKeyRow = {
    id: number;
    user_id: string;
    connector_key: string;
};

export type UserDbRecord = {
    id: string;
    isOwner: boolean;
    createdAt: number;
    updatedAt: number;
};

export type UserConnectorKeyDbRecord = {
    id: number;
    userId: string;
    connectorKey: string;
};

export type UserWithConnectorKeysDbRecord = UserDbRecord & {
    connectorKeys: UserConnectorKeyDbRecord[];
};

export type SessionDbRecord = {
    id: string;
    agentId: string;
    inferenceSessionId: string | null;
    createdAt: number;
    resetMessage: string | null;
};

export type CreateUserInput = {
    id?: string;
    isOwner?: boolean;
    createdAt?: number;
    updatedAt?: number;
    connectorKey?: string;
};

export type UpdateUserInput = {
    isOwner?: boolean;
    createdAt?: number;
    updatedAt?: number;
};

export type CreateSessionInput = {
    agentId: string;
    inferenceSessionId?: string | null;
    createdAt?: number;
    resetMessage?: string | null;
};

export type CreateAgentInput = {
    record: AgentDbRecord;
    session?: Omit<CreateSessionInput, "agentId">;
};
