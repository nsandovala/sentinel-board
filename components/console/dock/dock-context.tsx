"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DockMode } from "./dock-mode-tabs";

/**
 * Single source of truth for the operational dock's surface state.
 *
 * The dock is the only copilot/terminal surface of Sentinel Board. Both the
 * topbar "HEO Copilot" button and the dock itself read/write this context so
 * there is exactly one dock, one state machine, no parallel terminals.
 *
 * Three explicit states:
 *  - collapsed: minimal bar (~48px)
 *  - compact:   tabs + output + input at a short fixed height (~280px)
 *  - expanded:  full panel, user-resizable, persisted height (~45-55vh)
 */

export type DockState = "collapsed" | "compact" | "expanded";

export const DOCK_COLLAPSED_HEIGHT = 48;
export const DOCK_COMPACT_HEIGHT = 280;
export const DOCK_EXPANDED_MIN = 360;
export const DOCK_EXPANDED_HARD_CAP = 760;
const DOCK_EXPANDED_VH = 0.55;

const LS_HEIGHT = "sentinel:dock-height";
const LS_STATE = "sentinel:dock-state";
const LS_MODE = "sentinel:dock-mode";

const VALID_STATES: DockState[] = ["collapsed", "compact", "expanded"];
const VALID_MODES: DockMode[] = ["command", "analyze", "focus", "agents"];

export function getExpandedMax(): number {
  if (typeof window === "undefined") return DOCK_EXPANDED_HARD_CAP;
  return Math.min(
    Math.round(window.innerHeight * DOCK_EXPANDED_VH),
    DOCK_EXPANDED_HARD_CAP,
  );
}

export function clampExpandedHeight(height: number): number {
  const max = Math.max(DOCK_EXPANDED_MIN, getExpandedMax());
  return Math.min(Math.max(Math.round(height), DOCK_EXPANDED_MIN), max);
}

function defaultExpandedHeight(): number {
  if (typeof window === "undefined") return DOCK_EXPANDED_MIN;
  return clampExpandedHeight(Math.round(window.innerHeight * 0.5));
}

interface DockController {
  /** True once localStorage has been read — avoids first-paint flicker. */
  hydrated: boolean;
  dockState: DockState;
  dockMode: DockMode;
  /** Height applied only in the `expanded` state. */
  expandedHeight: number;
  /** Effective pixel height for the current state. */
  effectiveHeight: number;
  setDockMode: (mode: DockMode) => void;
  setDockState: (state: DockState) => void;
  setExpandedHeight: (height: number) => void;
  /** Topbar button + header chevron: collapsed <-> last open state. */
  toggleCollapsed: () => void;
  /** Header maximize/restore: compact <-> expanded. */
  toggleSize: () => void;
  /** Last AI provider observed from an analyze run; null until one runs. */
  lastProvider: string | null;
  setLastProvider: (provider: string | null) => void;
}

const DockCtx = createContext<DockController | null>(null);

export function DockProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [dockState, setDockStateRaw] = useState<DockState>("collapsed");
  const [dockMode, setDockModeRaw] = useState<DockMode>("command");
  const [expandedHeight, setExpandedHeightRaw] = useState<number>(DOCK_EXPANDED_MIN);
  const [lastProvider, setLastProvider] = useState<string | null>(null);

  // Remembers whether the last open state was compact or expanded so the
  // collapsed -> open toggle restores the user's previous choice.
  const lastOpenRef = useRef<Exclude<DockState, "collapsed">>("compact");

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedState = window.localStorage.getItem(LS_STATE);
      if (storedState && (VALID_STATES as string[]).includes(storedState)) {
        setDockStateRaw(storedState as DockState);
        if (storedState !== "collapsed") {
          lastOpenRef.current = storedState as Exclude<DockState, "collapsed">;
        }
      }

      const storedMode = window.localStorage.getItem(LS_MODE);
      if (storedMode && (VALID_MODES as string[]).includes(storedMode)) {
        setDockModeRaw(storedMode as DockMode);
      }

      const storedHeight = Number(window.localStorage.getItem(LS_HEIGHT));
      setExpandedHeightRaw(
        Number.isFinite(storedHeight) && storedHeight > 0
          ? clampExpandedHeight(storedHeight)
          : defaultExpandedHeight(),
      );
    } catch {
      setExpandedHeightRaw(defaultExpandedHeight());
    }
    setHydrated(true);
  }, []);

  // Re-clamp expanded height when the viewport changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setExpandedHeightRaw((h) => clampExpandedHeight(h));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const persist = useCallback((key: string, value: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* localStorage unavailable (private mode, quota) — non-fatal. */
    }
  }, []);

  const setDockState = useCallback(
    (next: DockState) => {
      setDockStateRaw(next);
      if (next !== "collapsed") lastOpenRef.current = next;
      persist(LS_STATE, next);
    },
    [persist],
  );

  const setDockMode = useCallback(
    (mode: DockMode) => {
      setDockModeRaw(mode);
      persist(LS_MODE, mode);
    },
    [persist],
  );

  const setExpandedHeight = useCallback(
    (height: number) => {
      const clamped = clampExpandedHeight(height);
      setExpandedHeightRaw(clamped);
      persist(LS_HEIGHT, String(clamped));
    },
    [persist],
  );

  const toggleCollapsed = useCallback(() => {
    setDockStateRaw((current) => {
      const next: DockState =
        current === "collapsed" ? lastOpenRef.current : "collapsed";
      if (next !== "collapsed") lastOpenRef.current = next;
      persist(LS_STATE, next);
      return next;
    });
  }, [persist]);

  const toggleSize = useCallback(() => {
    setDockStateRaw((current) => {
      const next: DockState = current === "expanded" ? "compact" : "expanded";
      lastOpenRef.current = next;
      persist(LS_STATE, next);
      return next;
    });
  }, [persist]);

  const effectiveHeight =
    dockState === "collapsed"
      ? DOCK_COLLAPSED_HEIGHT
      : dockState === "compact"
        ? DOCK_COMPACT_HEIGHT
        : expandedHeight;

  const value = useMemo<DockController>(
    () => ({
      hydrated,
      dockState,
      dockMode,
      expandedHeight,
      effectiveHeight,
      setDockMode,
      setDockState,
      setExpandedHeight,
      toggleCollapsed,
      toggleSize,
      lastProvider,
      setLastProvider,
    }),
    [
      hydrated,
      dockState,
      dockMode,
      expandedHeight,
      effectiveHeight,
      setDockMode,
      setDockState,
      setExpandedHeight,
      toggleCollapsed,
      toggleSize,
      lastProvider,
    ],
  );

  return <DockCtx.Provider value={value}>{children}</DockCtx.Provider>;
}

export function useDock(): DockController {
  const ctx = useContext(DockCtx);
  if (!ctx) {
    throw new Error("useDock must be used within a DockProvider");
  }
  return ctx;
}
