"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { Terminal } from "lucide-react";

interface CommandInputProps {
  onSubmit: (value: string) => void;
  onFocus?: () => void;
}

export function CommandInput({ onSubmit, onFocus }: CommandInputProps) {
  const [value, setValue] = useState("");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && value.trim()) {
        onSubmit(value.trim());
        setValue("");
      }
    },
    [value, onSubmit],
  );

  return (
    <div className="flex items-center gap-2.5 px-4">
      <Terminal className="h-3.5 w-3.5 shrink-0 text-violet-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder="Escribe un comando… ej: mover tarea a producción"
        className="h-9 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
      />
    </div>
  );
}
