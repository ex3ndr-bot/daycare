"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Monitor, RefreshCw } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { fetchProcesses, type ManagedProcess } from "@/lib/engine-client";

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ManagedProcess[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchProcesses();
      setProcesses(items);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load processes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ordered = useMemo(
    () => [...processes].sort((a, b) => b.updatedAt - a.updatedAt),
    [processes]
  );
  const runningCount = useMemo(
    () => processes.filter((item) => item.status === "running").length,
    [processes]
  );
  const keepAliveCount = useMemo(
    () => processes.filter((item) => item.keepAlive).length,
    [processes]
  );

  return (
    <DashboardShell
      title="Processes"
      subtitle="Monitor durable background processes managed by the runtime."
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
            <span>{processes.length} processes tracked</span>
          )}
        </>
      }
    >
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-primary/10 via-card to-card/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardDescription>Total processes</CardDescription>
                <CardTitle className="text-2xl">{processes.length}</CardTitle>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Monitor className="h-5 w-5" />
              </div>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-accent/10 via-card to-card/80">
            <CardHeader>
              <CardDescription>Running</CardDescription>
              <CardTitle className="text-2xl">{runningCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-secondary/30 via-card to-card/80">
            <CardHeader>
              <CardDescription>Keep-alive enabled</CardDescription>
              <CardTitle className="text-2xl">{keepAliveCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Managed processes</CardTitle>
            <CardDescription>Runtime process state including PID, restart count, and log file path.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PID</TableHead>
                  <TableHead>Restarts</TableHead>
                  <TableHead>Log file</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered.length ? (
                  ordered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === "running" ? "default" : "secondary"}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.pid ?? "-"}</TableCell>
                      <TableCell>{item.restartCount}</TableCell>
                      <TableCell className="max-w-[320px] truncate font-mono text-xs">
                        {item.logPath}
                      </TableCell>
                      <TableCell>{formatTimestamp(item.updatedAt)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No managed processes found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }
  return new Date(value).toLocaleString();
}
