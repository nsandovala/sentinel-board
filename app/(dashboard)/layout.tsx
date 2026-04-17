"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/topbar";
import { RightPanel } from "@/components/layout/right-panel";
import { CommandDock } from "@/components/console/command-dock";
import { SentinelProvider } from "@/lib/state/sentinel-store";
import { ToastProvider } from "@/components/ui/toast";
import { useTerminal } from "@/lib/terminal/use-terminal";

const TerminalPanel = dynamic(
  () => import("@/components/terminal/terminal-panel").then((m) => m.TerminalPanel),
  { ssr: false },
);

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [showTerminal, setShowTerminal] = useState(false);
  const { setTerminal, handle, state: terminalState } = useTerminal();

  const onTerminalReady = useCallback(
    (term: import("@xterm/xterm").Terminal) => {
      setTerminal(term);
    },
    [setTerminal],
  );

  const onTerminalDispose = useCallback(() => {
    setTerminal(null);
  }, [setTerminal]);

  return (
    <div className="dark flex h-screen flex-col bg-background text-foreground font-sans">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />

        <main className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            showTerminal={showTerminal}
            onToggleTerminal={() => setShowTerminal((v) => !v)}
          />
          <div className="flex-1 overflow-hidden">{children}</div>
        </main>

        <RightPanel />
      </div>

      {showTerminal && (
        <TerminalPanel
          onTerminalReady={onTerminalReady}
          onTerminalDispose={onTerminalDispose}
          executeCommand={handle.executeCommand}
          status={terminalState.status}
          provider={terminalState.provider}
        />
      )}
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
        <DashboardShell>{children}</DashboardShell>
      </SentinelProvider>
    </ToastProvider>
  );
}
