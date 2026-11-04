"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/topbar";
import { RightPanel } from "@/components/layout/right-panel";
import { CommandDock } from "@/components/console/command-dock";
import { SentinelProvider } from "@/lib/state/sentinel-store";
import { DockProvider } from "@/components/console/dock/dock-context";
import { ToastProvider } from "@/components/ui/toast";

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

      {/* The dock is the single operational copilot surface — no separate
          upper terminal. */}
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
    <ToastProvider>
      <SentinelProvider>
        <DockProvider>
          <DashboardShell>{children}</DashboardShell>
        </DockProvider>
      </SentinelProvider>
    </ToastProvider>
  );
}
