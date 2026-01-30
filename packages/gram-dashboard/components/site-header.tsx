import { RefreshCw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  onRefresh: () => void;
  loading: boolean;
  connected: boolean;
  lastUpdated: Date | null;
  error?: string | null;
};

export function SiteHeader({ onRefresh, loading, connected, lastUpdated, error }: SiteHeaderProps) {
  const statusLabel = connected ? "Live" : "Offline";

  return (
    <div className="border-b bg-background/80 backdrop-blur">
      <header className="flex h-14 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <div className="flex flex-1 items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">Engine Overview</h1>
            <p className="text-xs text-muted-foreground">Monitor the Grambot runtime, providers, and sessions.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden w-48 items-center md:flex">
              <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions"
                className="h-9 pl-8"
                aria-label="Search sessions"
              />
            </div>
            <Badge
              variant={connected ? "default" : "outline"}
              className={cn(connected ? "bg-emerald-500 text-white" : "text-muted-foreground")}
            >
              {statusLabel}
            </Badge>
            <Button onClick={onRefresh} disabled={loading} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-xs text-muted-foreground lg:px-6">
        <span>{lastUpdated ? `Last synced ${lastUpdated.toLocaleTimeString()}` : "Awaiting first sync"}</span>
        {error ? (
          <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-destructive">
            {error}
          </span>
        ) : (
          <span>Streaming engine events from local socket</span>
        )}
      </div>
    </div>
  );
}
