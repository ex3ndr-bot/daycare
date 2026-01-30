export type EngineStatus = {
  plugins?: string[];
  connectors?: { id: string; loadedAt: string }[];
  inferenceProviders?: { id: string; label?: string }[];
  imageProviders?: { id: string; label?: string }[];
  tools?: string[];
};

export type CronTask = {
  id?: string;
  everyMs?: number;
  once?: boolean;
  message?: string;
  action?: string;
};

export type Session = {
  sessionId: string;
  source?: string;
  lastMessage?: string;
};

export type EngineEvent = {
  type: string;
  payload?: {
    status?: EngineStatus;
    cron?: CronTask[];
  };
};

type EngineStatusResponse = {
  status: EngineStatus;
};

type CronResponse = {
  tasks?: CronTask[];
};

type SessionsResponse = {
  sessions?: Session[];
};

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchEngineStatus() {
  const data = await fetchJSON<EngineStatusResponse>("/api/v1/engine/status");
  return data.status ?? {};
}

export async function fetchCronTasks() {
  const data = await fetchJSON<CronResponse>("/api/v1/engine/cron/tasks");
  return data.tasks ?? [];
}

export async function fetchSessions() {
  const data = await fetchJSON<SessionsResponse>("/api/v1/engine/sessions");
  return data.sessions ?? [];
}
