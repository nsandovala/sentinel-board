import { projects } from "@/lib/mock/projects";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark flex h-screen flex-col bg-background text-foreground font-sans">
      {/* Topbar */}
      <header className="flex h-11 shrink-0 items-center border-b border-border px-4">
        <span className="text-sm font-semibold tracking-tight">
          Sentinel Board
        </span>
      </header>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — proyectos */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
          <div className="px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Proyectos
            </span>
          </div>
          <ScrollArea className="flex-1">
            <nav className="flex flex-col gap-0.5 px-2 pb-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate">{project.name}</span>
                </div>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Board central */}
        <main className="flex-1 overflow-hidden">{children}</main>

        {/* Panel derecho — HEO */}
        <aside className="flex w-72 shrink-0 flex-col items-center justify-center border-l border-border bg-background">
          <p className="text-sm font-medium text-muted-foreground">
            HEO Panel
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            próximamente
          </p>
        </aside>
      </div>
    </div>
  );
}
