"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Wrench } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchEngineStatus, type EngineStatus } from "@/lib/engine-client";

export default function ToolsPage() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEngineStatus();
      setStatus(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tools = status?.tools ?? [];
  const categories = useMemo(() => {
    const grouped = new Map<string, number>();
    tools.forEach((tool) => {
      const bucket = tool.split(".")[0] ?? "core";
      grouped.set(bucket, (grouped.get(bucket) ?? 0) + 1);
    });
    return Array.from(grouped.entries());
  }, [tools]);

  return (
    <DashboardShell
      title="Tools"
      subtitle="Runtime tool inventory registered with the engine."
      toolbar={
        <Button onClick={() => void refresh()} disabled={loading} className="gap-2">
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      }
      status={
        <>
          <span>{lastUpdated ? `Last synced ${lastUpdated.toLocaleTimeString()}` : "Awaiting first sync"}</span>
          {error ? (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-destructive">
              {error}
            </span>
          ) : (
            <span>{tools.length} tools available</span>
          )}
        </>
      }
    >
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardDescription>Total tools</CardDescription>
                <CardTitle className="text-2xl">{tools.length}</CardTitle>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wrench className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Utility modules ready for task execution.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Categories</CardDescription>
              <CardTitle className="text-2xl">{categories.length || 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Grouped by namespace prefix.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Coverage</CardDescription>
              <CardTitle className="text-xl">{tools.length ? "Loaded" : "Empty"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Tooling availability snapshot.</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tool registry</CardTitle>
            <CardDescription>Available tool identifiers and namespaces.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {tools.length ? (
              tools.map((tool) => (
                <div key={tool} className="rounded-lg border bg-background/60 px-4 py-3">
                  <div className="text-sm font-medium text-foreground">{tool}</div>
                  <div className="text-xs text-muted-foreground">Namespace: {tool.split(".")[0] ?? "core"}</div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                No tools registered.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
