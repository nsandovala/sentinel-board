"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

interface ToastAnchor {
  x: number;
  y: number;
}

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
  anchor?: ToastAnchor;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, event?: ReactMouseEvent) => void;
}

const ToastCtx = createContext<ToastContextValue>({ toast: () => {} });

const DURATION_MS = 1800;

export function useToast() {
  return useContext(ToastCtx);
}

function ToastItem({ entry, onDone }: { entry: ToastEntry; onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 180);
    }, DURATION_MS);
    return () => clearTimeout(timerRef.current);
  }, [onDone]);

  const accent =
    entry.variant === "error"
      ? "border-red-500/20 text-red-300/85"
      : entry.variant === "success"
        ? "border-emerald-500/20 text-emerald-300/85"
        : "border-white/8 text-foreground/85";

  const positioned = Boolean(entry.anchor);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        ...(positioned
          ? { position: "fixed", left: entry.anchor!.x, top: entry.anchor!.y, transform: "translateX(-50%)" }
          : {}),
      }}
      className={cn(
        "pointer-events-none z-[9999] w-fit whitespace-nowrap rounded-lg border border-white/[0.06] px-3 py-1.5 text-[12px] font-medium tracking-[-0.01em] shadow-[0_4px_24px_oklch(0_0_0/0.4)] transition-all duration-180",
        "bg-[oklch(0.13_0.005_285/0.75)] backdrop-blur-xl backdrop-saturate-150",
        accent,
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
      )}
    >
      {entry.message}
    </div>
  );
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "default", event?: ReactMouseEvent) => {
      const id = ++nextId;

      let anchor: ToastAnchor | undefined;
      if (event) {
        const el = (event.currentTarget ?? event.target) as HTMLElement;
        const rect = el.getBoundingClientRect();
        anchor = { x: rect.left + rect.width / 2, y: rect.bottom + 6 };
      }

      setToasts((prev) => [...prev, { id, message, variant, anchor }]);
    },
    [],
  );

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const anchored = toasts.filter((t) => t.anchor);
  const floating = toasts.filter((t) => !t.anchor);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}

      {anchored.map((entry) => (
        <ToastItem key={entry.id} entry={entry} onDone={() => remove(entry.id)} />
      ))}

      {floating.length > 0 && (
        <div className="pointer-events-none fixed bottom-24 right-5 z-[9999] flex flex-col items-end gap-2">
          {floating.map((entry) => (
            <ToastItem key={entry.id} entry={entry} onDone={() => remove(entry.id)} />
          ))}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
