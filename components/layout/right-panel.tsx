export function RightPanel() {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="text-sm font-semibold">Detalle</span>
        <span className="text-xs text-muted-foreground">/ HEO</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* Codex Loop */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
              Codex Loop
            </h3>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <ol className="flex flex-col gap-2">
              {["Problema", "Hipótesis", "Solución", "Validación"].map(
                (step, i) => (
                  <li key={step} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-[13px] text-foreground/70">
                      {step}
                    </span>
                  </li>
                ),
              )}
            </ol>
          </div>
        </section>

        {/* Money Code */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
              Código del Dinero
            </h3>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums text-foreground/40">
                --
              </span>
              <span className="text-xs text-foreground/30">/ 100</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-0 rounded-full bg-emerald-500/50" />
            </div>
          </div>
        </section>

        {/* 5 Whys */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
              5 Whys
            </h3>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs font-medium tabular-nums text-muted-foreground"
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-center text-xs text-muted-foreground">
          Selecciona una tarjeta para ver detalles
        </p>
      </div>
    </aside>
  );
}
