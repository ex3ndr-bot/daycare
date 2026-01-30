"use client";

import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ title, subtitle, toolbar, status, children }: DashboardShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="border-b bg-background/80 backdrop-blur">
          <header className="flex min-h-14 items-center gap-2 px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-1 h-4" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
              ) : null}
            </div>
            {toolbar ? <div className="ml-auto flex items-center gap-2">{toolbar}</div> : null}
          </header>
          {status ? (
            <div className={cn("flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-xs text-muted-foreground", "lg:px-6")}>
              {status}
            </div>
          ) : null}
        </div>
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
