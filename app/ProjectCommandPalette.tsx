"use client";

import { KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Command, Search, X } from "lucide-react";

export type ProjectCommand = {
  id: string;
  label: string;
  detail: string;
  group: "Project" | "Draw" | "Systems" | "Review" | "Field" | "Navigate";
  shortcut?: string;
  keywords?: string;
  disabled?: boolean;
  recommended?: boolean;
  run: () => void;
};

type Props = {
  open: boolean;
  commands: ProjectCommand[];
  onClose: () => void;
};

export default function ProjectCommandPalette({ open, commands, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands.filter((command) => !command.disabled && command.recommended).slice(0, 6);
    return commands.filter((command) => !command.disabled &&
      `${command.label} ${command.detail} ${command.group} ${command.keywords || ""}`.toLowerCase().includes(normalized));
  }, [commands, query]);
  const activeCursor = Math.min(cursor, Math.max(0, visible.length - 1));

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  function close() {
    setQuery("");
    setCursor(0);
    onClose();
  }

  function execute(command?: ProjectCommand) {
    if (!command || command.disabled) return;
    command.run();
    close();
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !paletteRef.current) return;
    const focusable = Array.from(paletteRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <div className="command-palette-overlay" role="dialog" aria-modal="true" aria-label="Find a tool" onKeyDown={handleDialogKeyDown}>
    <button className="command-palette-dismiss" aria-label="Close tool search" tabIndex={-1} aria-hidden="true" onClick={close} />
    <section ref={paletteRef} className="command-palette">
      <header>
        <span><Command size={18} /></span>
        <div><strong>Find a tool</strong><small>Start with a common action or type what you need</small></div>
        <button aria-label="Close tool search" onClick={close}><X size={18} /></button>
      </header>
      <label className="command-palette-search">
        <Search size={19} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((current) => Math.min(visible.length - 1, current + 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((current) => Math.max(0, current - 1));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              execute(visible[activeCursor]);
            }
          }}
          placeholder="Try “draw supply,” “check plan,” or “materials”…"
        />
        <kbd>ESC</kbd>
      </label>
      <div className="command-palette-results">
        {visible.map((command, index) => <button
          key={command.id}
          className={index === activeCursor ? "active" : ""}
          disabled={command.disabled}
          onMouseEnter={() => setCursor(index)}
          onClick={() => execute(command)}
        >
          <span>{command.group.slice(0, 1)}</span>
          <div><strong>{command.label}</strong><small>{command.detail}</small></div>
          {command.shortcut ? <kbd>{command.shortcut}</kbd> : <ArrowRight size={16} />}
        </button>)}
        {!visible.length && <div className="command-palette-empty"><Search size={22} /><strong>No matching tool</strong><span>Try “supply,” “check,” “materials,” or a system name.</span></div>}
      </div>
      <footer><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><b>Type to search every tool</b></footer>
    </section>
  </div>;
}
