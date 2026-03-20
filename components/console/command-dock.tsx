"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

import { CommandInput } from "./command-input";
import { CommandLog } from "./command-log";
import { CommandSuggestions } from "./command-suggestions";
import { FocusTimer } from "./focus-timer";
import { QuickActions } from "./quick-actions";

import { parseCommand } from "@/lib/console/command-parser";
import { executeCommandWithDispatch } from "@/lib/console/command-executor";
import { mockSuggestions } from "@/lib/console/mock-events";
import { createEvent } from "@/lib/state/sentinel-reducer";

import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";

export function CommandDock() {
  const [expanded, setExpanded] = useState(false);
  const state = useSentinel();
  const dispatch = useSentinelDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Focus timer tick
  useEffect(() => {
    if (state.focusSession.state === "running") {
      intervalRef.current = setInterval(() => {
        dispatch({ type: "TICK_FOCUS" });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.focusSession.state, dispatch]);

  const handleCommand = useCallback(
    (input: string) => {
      const parsed = parseCommand(input);
      const result = executeCommandWithDispatch(parsed, state.cards, state.projects, dispatch);

      if (!result.success) {
        dispatch({ type: "ADD_EVENT", event: createEvent("system", result.message) });
      }
    },
    [state.cards, state.projects, dispatch],
  );

  const handleFocusStart = useCallback(() => {
    dispatch({ type: "START_FOCUS" });
  }, [dispatch]);

  const handleFocusEnd = useCallback(() => {
    dispatch({ type: "END_FOCUS" });
  }, [dispatch]);

  return (
    <div className="flex shrink-0 flex-col border-t border-border bg-sidebar">
      {/* Collapsed bar */}
      <div className="flex h-10 items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground/80"
          aria-label={expanded ? "Colapsar Command Dock" : "Expandir Command Dock"}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="flex-1">
          <CommandInput
            onSubmit={handleCommand}
            onFocus={() => !expanded && setExpanded(true)}
          />
        </div>

        <div className="shrink-0 pr-4">
          <FocusTimer
            session={state.focusSession}
            onStart={handleFocusStart}
            onEnd={handleFocusEnd}
          />
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-border/50 px-4 pb-3 pt-2">
          <div className="flex max-h-44 flex-col overflow-hidden">
            <CommandLog />
          </div>

          <div className="flex w-56 flex-col gap-4">
            <CommandSuggestions
              suggestions={mockSuggestions}
              onSelect={handleCommand}
            />
            <QuickActions onAction={handleCommand} />
          </div>
        </div>
      )}
    </div>
  );
}
