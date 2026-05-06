"use client";

import { useCallback, type MouseEvent } from "react";
import { Copy } from "lucide-react";
import { useToast } from "@/components/ui/toast";

function CmdDurationTokens({ text }: { text: string }) {
  const match = text.match(/^(\d+)(\s+)(.+)$/);
  if (match) {
    return (
      <>
        <span className="sentinel-cmd-num">{match[1]}</span>
        <span className="sentinel-cmd-muted">{match[2]}</span>
        <span className="sentinel-cmd-id">{match[3]}</span>
      </>
    );
  }

  return <span className="sentinel-cmd-str">{text}</span>;
}

function CommandHighlighted({ command }: { command: string }) {
  const normalized = command.trim();

  const move = normalized.match(/^(move|mover)(\s+)(["'])([\s\S]*?)\3(\s+to\s+|\s+a\s+)(.+)$/i);
  if (move) {
    return (
      <>
        <span className="sentinel-cmd-kw">{move[1]}</span>
        <span className="sentinel-cmd-muted">{move[2]}</span>
        <span className="sentinel-cmd-str">
          {move[3]}
          {move[4]}
          {move[3]}
        </span>
        <span className="sentinel-cmd-muted">{move[5]}</span>
        <span className="sentinel-cmd-id">{move[6]}</span>
      </>
    );
  }

  const focus = normalized.match(/^(focus)(\s+)(["'])([\s\S]*?)\3$/i);
  if (focus) {
    return (
      <>
        <span className="sentinel-cmd-kw">{focus[1]}</span>
        <span className="sentinel-cmd-muted">{focus[2]}</span>
        <span className="sentinel-cmd-arg">
          {focus[3]}
          {focus[4]}
          {focus[3]}
        </span>
      </>
    );
  }

  const score = normalized.match(/^(score)(\s+)(["'])([\s\S]*?)\3$/i);
  if (score) {
    return (
      <>
        <span className="sentinel-cmd-kw">{score[1]}</span>
        <span className="sentinel-cmd-muted">{score[2]}</span>
        <span className="sentinel-cmd-arg">
          {score[3]}
          {score[4]}
          {score[3]}
        </span>
      </>
    );
  }

  const analyze = normalized.match(/^(analyze)(\s+)(backlog)$/i);
  if (analyze) {
    return (
      <>
        <span className="sentinel-cmd-kw">{analyze[1]}</span>
        <span className="sentinel-cmd-muted">{analyze[2]}</span>
        <span className="sentinel-cmd-arg">{analyze[3]}</span>
      </>
    );
  }

  const register = normalized.match(/^(registrar)(\s+)(.+?)(\s+en\s+)(.+)$/i);
  if (register) {
    return (
      <>
        <span className="sentinel-cmd-kw">{register[1]}</span>
        <span className="sentinel-cmd-muted">{register[2]}</span>
        <CmdDurationTokens text={register[3]} />
        <span className="sentinel-cmd-muted">{register[4]}</span>
        <span className="sentinel-cmd-arg">{register[5]}</span>
      </>
    );
  }

  return <span className="sentinel-cmd-target">{normalized}</span>;
}

export function CommandSnippetBlock({ command }: { command: string }) {
  const { toast } = useToast();

  const handleCopy = useCallback(
    async (event: MouseEvent) => {
      try {
        await navigator.clipboard.writeText(command);
        toast("Comando copiado", "success", event);
      } catch {
        toast("No se pudo copiar el comando", "error", event);
      }
    },
    [command, toast],
  );

  return (
    <div className="sentinel-command-snippet-host">
      <pre className="sentinel-command-snippet sentinel-command-snippet--syntax">
        <code>
          <CommandHighlighted command={command} />
        </code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="sentinel-command-snippet-copy"
        aria-label="Copiar comando"
        title="Copiar comando"
      >
        <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      </button>
    </div>
  );
}
