"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type EngineStatus = {
  plugins?: string[];
  connectors?: { id: string; loadedAt: string }[];
  inferenceProviders?: { id: string; label?: string }[];
  imageProviders?: { id: string; label?: string }[];
  tools?: string[];
};

type CronTask = {
  id?: string;
  everyMs?: number;
  once?: boolean;
  message?: string;
  action?: string;
};

type Session = {
  sessionId: string;
  source?: string;
  lastMessage?: string;
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

type EngineEvent = {
  type: string;
  payload?: {
    status?: EngineStatus;
    cron?: CronTask[];
  };
};

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export default function Dashboard() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [cron, setCron] = useState<CronTask[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    const data = await fetchJSON<EngineStatusResponse>("/api/v1/engine/status");
    setStatus(data.status ?? null);
  }, []);

  const fetchCron = useCallback(async () => {
    const data = await fetchJSON<CronResponse>("/api/v1/engine/cron/tasks");
    setCron(data.tasks ?? []);
  }, []);

  const fetchSessions = useCallback(async () => {
    const data = await fetchJSON<SessionsResponse>("/api/v1/engine/sessions");
    setSessions(data.sessions ?? []);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchStatus(), fetchCron(), fetchSessions()]);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refresh failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchCron, fetchSessions, fetchStatus]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const source = new EventSource("/api/v1/engine/events");

    source.onopen = () => {
      setConnected(true);
    };

    source.onerror = () => {
      setConnected(false);
    };

    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as EngineEvent;
      if (payload.type === "init") {
        setStatus(payload.payload?.status ?? null);
        setCron(payload.payload?.cron ?? []);
        void fetchSessions();
        return;
      }

      switch (payload.type) {
        case "session.created":
        case "session.updated":
          void fetchSessions();
          break;
        case "cron.task.added":
        case "cron.started":
          void fetchCron();
          break;
        case "plugin.loaded":
        case "plugin.unloaded":
          void fetchStatus();
          break;
        default:
          break;
      }
    };

    return () => {
      source.close();
    };
  }, [fetchCron, fetchSessions, fetchStatus]);

  const pluginCount = status?.plugins?.length ?? 0;
  const sessionCount = sessions.length;
  const statusLabel = connected ? "Live" : "Offline";
  const statusVariant = connected ? "default" : "outline";

  const connectorTiles = useMemo(
    () =>
      status?.connectors?.map((connector) => ({
        title: connector.id,
        meta: new Date(connector.loadedAt).toLocaleTimeString()
      })) ?? [],
    [status?.connectors]
  );

  const providerTiles = useMemo(
    () =>
      status?.inferenceProviders?.map((provider) => ({
        title: provider.id,
        meta: provider.label ?? ""
      })) ?? [],
    [status?.inferenceProviders]
  );

  const imageTiles = useMemo(
    () =>
      status?.imageProviders?.map((provider) => ({
        title: provider.id,
        meta: provider.label ?? ""
      })) ?? [],
    [status?.imageProviders]
  );

  const pluginTiles = useMemo(
    () => status?.plugins?.map((plugin) => ({ title: plugin, meta: "loaded" })) ?? [],
    [status?.plugins]
  );

  const toolTiles = useMemo(
    () => status?.tools?.map((tool) => ({ title: tool, meta: "tool" })) ?? [],
    [status?.tools]
  );

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.12),transparent_45%)]" />
      <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12 lg:py-16">
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-8 shadow-glow backdrop-blur lg:p-12">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Grambot Dashboard</p>
              <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Engine pulse, memory, and flow.
              </h1>
              <p className="text-base text-muted-foreground sm:text-lg">
                Live status for plugins, sessions, connectors, and cron tasks — proxied directly from the local engine
                socket.
              </p>
              {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void refreshAll()} disabled={loading}>
                  <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
                  Refresh
                </Button>
                <Badge variant={statusVariant} className={connected ? "bg-emerald-500 text-white" : ""}>
                  {statusLabel}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {lastUpdated ? `Last synced ${lastUpdated.toLocaleTimeString()}` : "Awaiting first sync"}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-background/70">
                  <CardHeader className="p-4">
                    <CardDescription>Engine</CardDescription>
                    <CardTitle className="text-2xl">{pluginCount}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-xs text-muted-foreground">
                    Plugins loaded
                  </CardContent>
                </Card>
                <Card className="bg-background/70">
                  <CardHeader className="p-4">
                    <CardDescription>Sessions</CardDescription>
                    <CardTitle className="text-2xl">{sessionCount}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-xs text-muted-foreground">
                    Active threads
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <InfoCard title="Plugins" description="Loaded modules and their current state.">
            <TileGrid items={pluginTiles} empty="None detected." />
          </InfoCard>
          <InfoCard title="Connectors" description="Active connector endpoints.">
            <TileGrid items={connectorTiles} empty="No connectors online." />
          </InfoCard>
          <InfoCard title="Inference" description="LLM providers in rotation.">
            <TileGrid items={providerTiles} empty="No inference providers." />
          </InfoCard>
          <InfoCard title="Image Generation" description="Available image providers.">
            <TileGrid items={imageTiles} empty="No image providers." />
          </InfoCard>
          <InfoCard title="Tools" description="Runtime tool inventory.">
            <TileGrid items={toolTiles} empty="No tools registered." />
          </InfoCard>
          <InfoCard title="Cron Tasks" description="Scheduled work from the engine.">
            <ListGrid
              items={cron}
              empty="No cron tasks scheduled."
              renderItem={(task) => (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">{task.id ?? "task"}</div>
                  <div className="text-xs text-muted-foreground">
                    Every {task.everyMs ?? 0}ms · {task.once ? "once" : "repeat"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {task.message ?? task.action ?? "custom"}
                  </div>
                </div>
              )}
            />
          </InfoCard>
        </section>

        <InfoCard title="Sessions" description="Recent conversation threads.">
          <ListGrid
            items={sessions}
            empty="No sessions yet."
            renderItem={(session) => (
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">{session.sessionId}</div>
                <div className="text-xs text-muted-foreground">{session.source ?? "unknown"}</div>
                <div className="text-xs text-muted-foreground">{session.lastMessage ?? "No message"}</div>
              </div>
            )}
          />
        </InfoCard>
      </main>
    </div>
  );
}

function InfoCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card/80">
      <CardHeader>
        <CardTitle className="font-display text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Separator className="mb-4" />
        {children}
      </CardContent>
    </Card>
  );
}

function TileGrid({ items, empty }: { items: { title: string; meta?: string }[]; empty: string }) {
  if (items.length === 0) {
    return <EmptyState label={empty} />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={`${item.title}-${item.meta}`} className="rounded-lg border bg-background/60 px-4 py-3">
          <div className="text-sm font-medium text-foreground">{item.title}</div>
          <div className="text-xs text-muted-foreground">{item.meta}</div>
        </div>
      ))}
    </div>
  );
}

function ListGrid<T>({
  items,
  empty,
  renderItem
}: {
  items: T[];
  empty: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) {
    return <EmptyState label={empty} />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-lg border bg-background/60 px-4 py-3"
        >
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">{label}</div>;
}
