"use client";

import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import {
  Copy,
  FlipHorizontal2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";

type SymbolActionWheelProps = {
  label: string;
  x: number;
  y: number;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onMirror: () => void;
  onCompact: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export default function SymbolActionWheel({
  label,
  x,
  y,
  onRotateLeft,
  onRotateRight,
  onMirror,
  onCompact,
  onDuplicate,
  onDelete,
  onClose,
}: SymbolActionWheelProps) {
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const actions = [
    {
      id: "rotate-left",
      label: "Rotate left 15 degrees",
      shortLabel: "−15°",
      icon: RotateCcw,
      run: onRotateLeft,
    },
    {
      id: "rotate-right",
      label: "Rotate right 15 degrees",
      shortLabel: "+15°",
      icon: RotateCw,
      run: onRotateRight,
    },
    {
      id: "mirror",
      label: "Mirror icon",
      shortLabel: "Mirror",
      icon: FlipHorizontal2,
      run: onMirror,
    },
    {
      id: "duplicate",
      label: "Duplicate icon",
      shortLabel: "Copy",
      icon: Copy,
      run: onDuplicate,
    },
    {
      id: "compact",
      label: "Use compact icon and label sizes",
      shortLabel: "Compact",
      icon: Minimize2,
      run: onCompact,
    },
    {
      id: "delete",
      label: "Delete icon",
      shortLabel: "Delete",
      icon: Trash2,
      run: onDelete,
      danger: true,
    },
    {
      id: "close",
      label: "Close icon actions",
      shortLabel: "Close",
      icon: X,
      run: onClose,
      center: true,
    },
  ];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    const currentIndex = actionRefs.current.findIndex((button) => button === document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = actions.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : ["ArrowRight", "ArrowDown"].includes(event.key)
          ? (Math.max(0, currentIndex) + 1) % actions.length
          : (currentIndex <= 0 ? lastIndex : currentIndex - 1);
    actionRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      className="symbol-action-wheel"
      role="toolbar"
      aria-label={`Actions for ${label}`}
      data-canvas-ui
      onKeyDown={handleKeyDown}
      style={{ left: x, top: y } as CSSProperties}
    >
      <span className="symbol-action-wheel-caption" aria-hidden="true">ICON</span>
      {actions.map(({ id, label: actionLabel, shortLabel, icon: Icon, run, danger, center }, index) => (
        <button
          type="button"
          key={id}
          ref={(button) => { actionRefs.current[index] = button; }}
          className={`symbol-wheel-action action-${id}${danger ? " danger" : ""}${center ? " center" : ""}`}
          aria-label={actionLabel}
          title={actionLabel}
          onClick={run}
        >
          <Icon size={17} aria-hidden="true" />
          <small>{shortLabel}</small>
        </button>
      ))}
    </div>
  );
}
