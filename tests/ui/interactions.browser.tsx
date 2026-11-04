import { act, StrictMode, useState } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { TopBar } from "@/components/layout/topbar";
import { CreateTaskModal } from "@/components/modals/create-task-modal";
import { DockProvider, useDock } from "@/components/console/dock/dock-context";
import { SentinelProvider, useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";
import type { SearchResponse } from "@/types/knowledge";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
  var uiTestResult: { passed: number; failed: number; cases: { name: string; error?: string }[] } | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// All API traffic is intercepted in this harness; no real services or data.
const projects = [
  { id: "p1", name: "Fixture One", slug: "one", status: "active" },
  { id: "p2", name: "Fixture Two", slug: "two", status: "active" },
];
const calls: { url: URL; signal?: AbortSignal | null; body?: string; method: string }[] = [];
let searchData: SearchResponse;
let searchFailure = false;
let searchHeld = false;
let currentRoot: Root | null = null;
const host = document.getElementById("fixture")!;
const originalFetch = window.fetch;
const originalGetItem = Storage.prototype.getItem;
const originalSetItem = Storage.prototype.setItem;
const originalHeight = window.innerHeight;
const consoleErrors: string[] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => {
  consoleErrors.push(args.map(String).join(" "));
  originalError(...args);
};

window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  calls.push({ url, signal: init?.signal, body: init?.body?.toString(), method: init?.method ?? "GET" });
  if (url.origin !== location.origin) throw new Error("External requests forbidden");
  if (url.pathname === "/api/search") {
    if (searchHeld) {
      await new Promise<void>((_, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener("abort", abort, { once: true });
      });
    }
    if (searchFailure) throw new Error("Fixture search failure");
    return Response.json(searchData);
  }
  if (url.pathname === "/api/projects") return Response.json({ ok: true, projects });
  if (url.pathname === "/api/events") return Response.json({ ok: true, events: [] });
  if (url.pathname === "/api/knowledge") return Response.json({ ok: true, knowledge: [] });
  if (url.pathname === "/api/tasks") return Response.json({ ok: true, tasks: [] });
  if (/^\/api\/tasks\/[^/]+\/comments$/.test(url.pathname)) return Response.json({ ok: true, comments: [] });
  throw new Error("Unexpected fixture request: " + url.pathname);
};

function StateProbe() {
  const s = useSentinel();
  const dispatch = useSentinelDispatch();
  return <>
    <output id="state">{JSON.stringify({ project: s.selectedProjectId, card: s.selectedCardId, view: s.activeView })}</output>
    <button id="project-one" onClick={() => dispatch({ type: "SELECT_PROJECT", projectId: "p1" })}>Project one</button>
    <button id="refresh-projects" onClick={() => dispatch({ type: "HYDRATE", cards: [], projects: [...s.projects] })}>Refresh projects</button>
  </>;
}
function DockProbe() {
  const d = useDock();
  return <>
    <output id="dock">{JSON.stringify({ hydrated: d.hydrated, state: d.dockState, mode: d.dockMode, height: d.expandedHeight, effective: d.effectiveHeight })}</output>
    <button id="collapse" onClick={d.toggleCollapsed}>Collapse</button>
    <button id="explicit-collapse" onClick={() => d.setDockState("collapsed")}>Explicit collapse</button>
    <button id="size" onClick={d.toggleSize}>Size</button>
    <button id="mode" onClick={() => d.setDockMode("agents")}>Mode</button>
    <button id="height" onClick={() => d.setExpandedHeight(9999)}>Height</button>
  </>;
}
function ModalFixture() {
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<string | null>("p1");
  return <>
    <button id="open-modal" onClick={() => setOpen(true)}>Open</button>
    <button id="default-project" onClick={() => setProject("p2")}>Default two</button>
    <button id="default-none" onClick={() => setProject(null)}>Default none</button>
    <CreateTaskModal open={open} onOpenChange={setOpen} defaultProjectId={project} />
  </>;
}
function app(modal = false) {
  return <StrictMode><SentinelProvider><DockProvider>
    {modal ? <ModalFixture /> : <TopBar />}
    <StateProbe /><DockProbe />
  </DockProvider></SentinelProvider></StrictMode>;
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const node = host.querySelector<T>(selector);
  assert(node, "Missing element: " + selector);
  return node;
}
const state = () => JSON.parse(el("#state").textContent!) as { project: string | null; card: string | null; view: string };
const dock = () => JSON.parse(el("#dock").textContent!) as { hydrated: boolean; state: string; mode: string; height: number };
const searchCalls = () => calls.filter(c => c.url.pathname === "/api/search");
const expanded = () => el('[role="combobox"]').getAttribute("aria-expanded") === "true";
const selection = () => el('[role="combobox"]').getAttribute("aria-activedescendant");
async function wait(ms = 290) { await act(async () => { await new Promise(r => setTimeout(r, ms)); }); }
async function click(selector: string) { await act(async () => { el(selector).click(); }); }
async function key(selector: string, value: string) {
  await act(async () => { el(selector).dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })); });
}
async function input(selector: string, value: string) {
  await act(async () => {
    const node = el<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
    const proto = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
async function outside() {
  await act(async () => {
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}
function cards(count: number, projectId = "p1"): SearchResponse {
  return { ok: true, cards: Array.from({ length: count }, (_, i) => ({
    id: "c" + i, projectId, title: "Fixture card " + i, status: "qa", priority: "medium", type: "task", tags: [],
  })), knowledge: [], total: { cards: count, knowledge: 0 } };
}
async function mount(modal = false) {
  currentRoot = createRoot(host);
  await act(async () => { currentRoot!.render(app(modal)); });
}
async function query(value = "fixture") {
  await act(async () => { el('[role="combobox"]').focus(); });
  await input('[role="combobox"]', value);
  await wait();
}
async function cleanup() {
  if (currentRoot) await act(async () => { currentRoot!.unmount(); });
  currentRoot = null;
  host.innerHTML = "";
  Storage.prototype.getItem = originalGetItem;
  Storage.prototype.setItem = originalSetItem;
  localStorage.clear();
  Object.defineProperty(window, "innerHeight", { value: originalHeight, configurable: true });
  history.replaceState(null, "", "/");
  calls.length = 0;
  consoleErrors.length = 0;
  searchData = cards(3);
  searchFailure = false;
  searchHeld = false;
}

const cases: { name: string; run: () => Promise<void> }[] = [];
function test(name: string, run: () => Promise<void>) { cases.push({ name, run }); }

test("Search: empty/whitespace stays closed; debounce uses trimmed query", async () => {
  await mount();
  assert(!expanded(), "Empty search must be closed");
  await input('[role="combobox"]', "   ");
  assert(!expanded(), "Whitespace must not open search");
  await input('[role="combobox"]', " fixture ");
  assert(expanded(), "Active query must immediately open");
  assert(searchCalls().length === 0, "Request must be debounced");
  await wait();
  assert(searchCalls().length === 1 && searchCalls()[0].url.searchParams.get("q") === "fixture", "One trimmed query");
  assert(host.querySelectorAll('[role="option"]').length === 3, "Three results rendered");
});
test("Keyboard wraps; Enter focuses the card without losing global scope", async () => {
  await mount(); await query();
  await key('[role="combobox"]', "ArrowUp");
  assert(selection()?.endsWith("-2"), "Up wraps to last result");
  await key('[role="combobox"]', "ArrowDown");
  assert(selection()?.endsWith("-0"), "Down wraps to first result");
  await key('[role="combobox"]', "Enter");
  assert(state().card === "c0" && state().project === null && state().view === "board", "Global card navigation");
  assert(new URL(location.href).searchParams.get("card") === "c0", "Deep link updated");
  assert(!expanded() && el<HTMLInputElement>('[role="combobox"]').value === "", "Navigation clears/closes search");
});
test("Mouse navigation switches a filtered project for a cross-project result", async () => {
  searchData = cards(2, "p2");
  await mount(); await click("#project-one"); await query();
  assert(searchCalls().at(-1)!.url.searchParams.get("projectId") === "p1", "Project passed to API");
  await act(async () => { el('#sentinel-search-result-1').dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
  assert(selection()?.endsWith("-1"), "Mouse updates active item");
  await click("#sentinel-search-result-1");
  assert(state().project === "p2" && state().card === "c1", "Cross-project focus preserved");
});
test("Dismissal remains closed on unrelated renders; focus reopens; Escape clears/blurs", async () => {
  await mount(); await query(); await outside();
  assert(!expanded(), "Outside click dismisses");
  await click("#collapse");
  assert(!expanded(), "Unrelated state must not reopen");
  await act(async () => { el('[role="combobox"]').focus(); });
  assert(expanded(), "Input focus reopens");
  await key('[role="combobox"]', "Escape");
  assert(!expanded() && document.activeElement !== el('[role="combobox"]'), "Escape closes and blurs");
  assert(el<HTMLInputElement>('[role="combobox"]').value === "", "Escape clears query");
});
test("Result shrink clamps permanently, expansion keeps selection; clear resets results", async () => {
  await mount(); await query();
  await key('[role="combobox"]', "ArrowUp");
  searchData = cards(1); await query("one");
  assert(selection()?.endsWith("-0"), "Shrinking clamps");
  searchData = cards(3); await query("three");
  assert(selection()?.endsWith("-0"), "Expansion must not resurrect stale index");
  await click('[aria-label="Limpiar busqueda"]');
  assert(!expanded(), "Clear closes inactive search");
  await input('[role="combobox"]', "again");
  assert(host.querySelectorAll('[role="option"]').length === 0, "Old results were reset");
  await wait();
});
test("Filters: parameters/chips, Escape focus, outside dismissal and clear", async () => {
  await mount();
  await click('[aria-controls="sentinel-filter-popover"]');
  await input("#sentinel-filter-status", "qa");
  await input("#sentinel-filter-priority", "high");
  await input("#sentinel-filter-tag", "fixture-tag");
  await wait();
  const params = searchCalls().at(-1)!.url.searchParams;
  assert(params.get("status") === "qa" && params.get("priority") === "high" && params.get("tag") === "fixture-tag", "All filter params sent");
  assert(host.querySelectorAll('[aria-label^="Quitar filtro de"]').length === 3, "Three chips");
  await key("#sentinel-filter-tag", "Escape");
  assert(!host.querySelector("#sentinel-filter-popover"), "Escape closes filters");
  assert(document.activeElement === el('[aria-controls="sentinel-filter-popover"]'), "Focus returned to trigger");
  await click('[aria-controls="sentinel-filter-popover"]'); await outside();
  assert(!host.querySelector("#sentinel-filter-popover"), "Outside closes filters");
  await click('[aria-controls="sentinel-filter-popover"]');
  await click('[aria-label="Limpiar filtros"]');
  assert(!expanded() && !host.querySelector("#sentinel-filter-popover"), "Clearing filters closes both inactive views");
});
test("Knowledge result: linked task focuses; unlinked entry only dismisses", async () => {
  const entry = { id: "k", title: "Fixture document", slug: "fixture", category: "note" as const, status: "published" as const,
    tags: [], body: "Fixture only", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
  searchData = { ok: true, cards: [], knowledge: [entry], total: { cards: 0, knowledge: 1 } };
  await mount(); await query(); await click("#sentinel-search-result-0");
  assert(!expanded() && state().card === null && el<HTMLInputElement>('[role="combobox"]').value === "fixture", "Unlinked entry does not navigate or clear");
  searchData = { ...searchData, knowledge: [{ ...entry, projectId: "p2", sourceTaskId: "linked" }] };
  await query("linked");
  await key('[role="combobox"]', "Enter");
  assert(state().card === "linked", "Linked knowledge focuses source task");
});
test("Failed search stops loading and shows empty results", async () => {
  searchFailure = true;
  await mount(); await query();
  assert(host.textContent?.includes("Sin resultados.") && !host.textContent?.includes("Buscando..."), "Failure state");
});
test("Rapid edits cancel debounce; unmount aborts active fetch", async () => {
  searchHeld = true;
  await mount();
  await input('[role="combobox"]', "first"); await input('[role="combobox"]', "last");
  await wait();
  assert(searchCalls().length === 1 && searchCalls()[0].url.searchParams.get("q") === "last", "Only final debounce requested");
  const signal = searchCalls()[0].signal!;
  await act(async () => { currentRoot!.unmount(); }); currentRoot = null;
  assert(signal.aborted, "Unmount aborts search");
});
test("Modal: draft survives close; reopening/default change resets only project; submit navigation", async () => {
  await mount(true); await click("#open-modal");
  await input("#ct-title", "  Fixture task  "); await input("#ct-desc", "Fixture body");
  await input("#ct-proj", "p2"); await input("#ct-type", "bug"); await input("#ct-prio", "high");
  await click('[aria-label="Cerrar"]'); await click("#open-modal");
  assert(el<HTMLInputElement>("#ct-title").value === "  Fixture task  ", "Draft title retained");
  assert(el<HTMLSelectElement>("#ct-proj").value === "p1", "Reopen restores default project");
  assert(el<HTMLSelectElement>("#ct-type").value === "bug" && el<HTMLSelectElement>("#ct-prio").value === "high", "Type/priority retained");
  await click("#default-project");
  assert(el<HTMLSelectElement>("#ct-proj").value === "p2", "Open default change applied");
  await act(async () => { el("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  const created = JSON.parse(calls.find(c => c.method === "POST" && c.url.pathname === "/api/tasks")!.body!);
  assert(created.title === "Fixture task" && created.projectId === "p2" && created.type === "bug" && created.priority === "high", "Correct persisted payload");
  assert(state().view === "board" && state().card === created.id, "Created task selected");
  await click("#open-modal");
  assert(el<HTMLInputElement>("#ct-title").value === "" && el<HTMLInputElement>("#ct-desc").value === "", "Successful submit resets text");
});
test("Modal: fallback and projects refresh preserve the previous reset semantics", async () => {
  await mount(true); await click("#default-none"); await click("#open-modal");
  assert(el<HTMLSelectElement>("#ct-proj").value === "p1", "First project fallback");
  await input("#ct-proj", "p2"); await input("#ct-title", "Draft");
  assert(el<HTMLSelectElement>("#ct-proj").value === "p2", "Typing must not reset manual selection");
  await click("#refresh-projects");
  assert(el<HTMLSelectElement>("#ct-proj").value === "p1" && el<HTMLInputElement>("#ct-title").value === "Draft", "Project refresh resets project, not draft");
});
test("Dock: valid stored state/mode/height hydrate and restore after collapse", async () => {
  localStorage.setItem("sentinel:dock-state", "expanded");
  localStorage.setItem("sentinel:dock-mode", "agents");
  localStorage.setItem("sentinel:dock-height", "9999");
  await mount();
  const max = Math.max(360, Math.min(Math.round(innerHeight * .55), 760));
  assert(dock().hydrated && dock().state === "expanded" && dock().mode === "agents" && dock().height === max, "Hydrated preferences clamped");
  await click("#collapse"); assert(dock().state === "collapsed", "Collapsed");
  await click("#collapse"); assert(dock().state === "expanded", "Restores persisted expanded state");
  await click("#size"); assert(dock().state === "compact", "Size toggle");
  await click("#size"); assert(dock().state === "expanded", "Size restore");
  assert(localStorage.getItem("sentinel:dock-state") === "expanded", "State persisted");
  await click("#mode"); await click("#height");
  assert(localStorage.getItem("sentinel:dock-height") === String(max), "Height persisted");
  Object.defineProperty(window, "innerHeight", { value: 400, configurable: true });
  await act(async () => { window.dispatchEvent(new Event("resize")); });
  assert(dock().height === 360, "Resize respects minimum");
});
test("Dock: explicit collapse also preserves the initially stored open state", async () => {
  localStorage.setItem("sentinel:dock-state", "expanded");
  await mount(); await click("#explicit-collapse"); await click("#collapse");
  assert(dock().state === "expanded", "Explicit setter must preserve last-open state");
});
test("Dock: invalid storage falls back; remount rereads preferences", async () => {
  localStorage.setItem("sentinel:dock-state", "invalid");
  localStorage.setItem("sentinel:dock-mode", "invalid");
  localStorage.setItem("sentinel:dock-height", "NaN");
  await mount();
  assert(dock().hydrated && dock().state === "collapsed" && dock().mode === "command", "Invalid preferences fallback");
  await click("#collapse"); assert(dock().state === "compact", "Default last-open state");
  await act(async () => { currentRoot!.unmount(); }); currentRoot = null;
  localStorage.setItem("sentinel:dock-state", "expanded");
  await mount();
  assert(dock().state === "expanded", "A new provider rereads storage");
});
test("Dock: blocked storage remains usable", async () => {
  Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
  Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
  await mount();
  assert(dock().hydrated && dock().state === "collapsed", "Hydrated even without storage");
  await click("#collapse"); await click("#mode");
  assert(dock().state === "compact" && dock().mode === "agents", "In-memory controls still work");
});
test("Dock SSR hydration has identical first render and no recoverable errors", async () => {
  const fixture = <StrictMode><DockProvider><DockProbe /></DockProvider></StrictMode>;
  localStorage.setItem("sentinel:dock-state", "expanded");
  host.innerHTML = renderToString(fixture);
  assert(!dock().hydrated && dock().state === "collapsed", "Server snapshot is stable");
  const errors: string[] = [];
  await act(async () => { currentRoot = hydrateRoot(host, fixture, { onRecoverableError: e => errors.push(String(e)) }); });
  assert(dock().hydrated && dock().state === "expanded", "Client preferences applied after hydration");
  assert(errors.length === 0, errors.join("\n"));
});

async function run() {
  const results: { name: string; error?: string }[] = [];
  for (const item of cases) {
    await cleanup();
    try {
      await item.run();
      assert(consoleErrors.length === 0, "React errors: " + consoleErrors.join("\n"));
      results.push({ name: item.name });
    } catch (e) {
      results.push({ name: item.name, error: e instanceof Error ? e.stack : String(e) });
    }
  }
  await cleanup();
  window.fetch = originalFetch;
  console.error = originalError;
  globalThis.uiTestResult = { passed: results.filter(r => !r.error).length, failed: results.filter(r => r.error).length, cases: results };
  document.getElementById("results")!.textContent = JSON.stringify(globalThis.uiTestResult, null, 2);
}
void run();
