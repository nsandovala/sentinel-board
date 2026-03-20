"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { RightPanel } from "@/components/layout/right-panel";
import { CommandDock } from "@/components/console/command-dock";
import { SentinelProvider, useSentinel } from "@/lib/state/sentinel-store";

function TopBar() {
  const { activeView } = useSentinel();
  const viewLabels: Record<string, string> = {
    board: "Board",
    timeline: "Timeline",
    backlog: "Backlog",
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
      <h1 className="text-sm font-semibold text-foreground">
        {viewLabels[activeView] ?? "Board"}
      </h1>
      <span className="text-xs text-muted-foreground">/</span>
      <span className="text-xs text-muted-foreground">Sentinel Board</span>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex h-7 w-48 items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="text-xs text-muted-foreground">Buscar...</span>
        </div>

        <div className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filtrar
        </div>

        <div className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-violet-500/15 text-violet-400 transition-colors hover:bg-violet-500/25">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </div>
      </div>
    </header>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark flex h-screen flex-col bg-background text-foreground font-sans">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />

        <main className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 overflow-hidden">{children}</div>
        </main>

        <RightPanel />
      </div>

      <CommandDock />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SentinelProvider>
      <DashboardShell>{children}</DashboardShell>
    </SentinelProvider>
  );
}
