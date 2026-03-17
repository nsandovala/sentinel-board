import { AppSidebar } from "@/components/layout/app-sidebar";
import { RightPanel } from "@/components/layout/right-panel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark flex h-screen flex-col bg-background text-foreground font-sans">
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />

        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Board topbar */}
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-5">
            <h1 className="text-[13px] font-medium text-foreground/70">
              Board
            </h1>
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-muted-foreground">en línea</span>
            </div>
          </header>

          <div className="flex-1 overflow-hidden">{children}</div>
        </main>

        <RightPanel />
      </div>
    </div>
  );
}
