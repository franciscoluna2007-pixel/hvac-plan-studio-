"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  Copy,
  FlipHorizontal2,
  Link2,
  Minimize2,
  Minus,
  Plus,
  Route,
  RotateCcw,
  RotateCw,
  Scissors,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  contextWheelActionPosition,
  nextContextWheelActionIndex,
  planContextWheelCaption,
  type PlanContextWheelKind,
} from "./contextActionWheel";

type CommonActionWheelProps = {
  label: string;
  x: number;
  y: number;
  layout?: "wheel" | "strip";
  onDelete: () => void;
  onClose: () => void;
};

export type IconActionWheelProps = CommonActionWheelProps & {
  variant?: "icon";
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onMirror: () => void;
  onCompact: () => void;
  onDuplicate: () => void;
};

export type RunActionWheelProps = CommonActionWheelProps & {
  variant: "run";
  labelAvailable: boolean;
  splitActive: boolean;
  onLabelSmaller: () => void;
  onLabelLarger: () => void;
  onResetLabel: () => void;
  onExtendA: () => void;
  onExtendB: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
};

export type FittingActionWheelProps = CommonActionWheelProps & {
  variant: "fitting";
  onInspectConnections: () => void;
  onEditProperties: () => void;
  onDuplicate: () => void;
};

export type PlanActionWheelProps =
  | IconActionWheelProps
  | RunActionWheelProps
  | FittingActionWheelProps;

type WheelAction = {
  id: string;
  label: string;
  shortLabel: string;
  icon: typeof X;
  run: () => void;
  danger?: boolean;
  center?: boolean;
  disabled?: boolean;
  pressed?: boolean;
};

function actionsFor(props: PlanActionWheelProps): WheelAction[] {
  if (props.variant === "run") {
    return [
      {
        id: "label-smaller",
        label: "Make duct label smaller",
        shortLabel: "Label -",
        icon: Minus,
        run: props.onLabelSmaller,
        disabled: !props.labelAvailable,
      },
      {
        id: "label-larger",
        label: "Make duct label larger",
        shortLabel: "Label +",
        icon: Plus,
        run: props.onLabelLarger,
        disabled: !props.labelAvailable,
      },
      {
        id: "label-reset",
        label: "Reset duct label size and position",
        shortLabel: "Reset",
        icon: RotateCcw,
        run: props.onResetLabel,
        disabled: !props.labelAvailable,
      },
      {
        id: "extend-b",
        label: "Continue drawing from endpoint B",
        shortLabel: "Extend B",
        icon: Route,
        run: props.onExtendB,
      },
      {
        id: "split",
        label: props.splitActive ? "Cancel duct run split mode" : "Split this duct run",
        shortLabel: props.splitActive ? "Splitting" : "Split",
        icon: Scissors,
        run: props.onSplit,
        pressed: props.splitActive,
      },
      {
        id: "extend-a",
        label: "Continue drawing from endpoint A",
        shortLabel: "Extend A",
        icon: Route,
        run: props.onExtendA,
      },
      {
        id: "duplicate",
        label: "Copy connected supply assembly and place it with the mouse",
        shortLabel: "Copy & place",
        icon: Copy,
        run: props.onDuplicate,
      },
      {
        id: "delete",
        label: "Delete duct run",
        shortLabel: "Delete",
        icon: Trash2,
        run: props.onDelete,
        danger: true,
      },
      {
        id: "close",
        label: "Close run actions",
        shortLabel: "Close",
        icon: X,
        run: props.onClose,
        center: true,
      },
    ].filter((action) => !action.disabled);
  }

  if (props.variant === "fitting") {
    return [
      {
        id: "inspect-connections",
        label: "Inspect fitting connections",
        shortLabel: "Ports",
        icon: Link2,
        run: props.onInspectConnections,
      },
      {
        id: "edit-properties",
        label: "Open fitting properties",
        shortLabel: "Edit",
        icon: Settings2,
        run: props.onEditProperties,
      },
      {
        id: "duplicate",
        label: "Copy connected supply assembly and place it with the mouse",
        shortLabel: "Copy & place",
        icon: Copy,
        run: props.onDuplicate,
      },
      {
        id: "delete",
        label: "Delete fitting",
        shortLabel: "Delete",
        icon: Trash2,
        run: props.onDelete,
        danger: true,
      },
      {
        id: "close",
        label: "Close fitting actions",
        shortLabel: "Close",
        icon: X,
        run: props.onClose,
        center: true,
      },
    ];
  }

  return [
    {
      id: "rotate-left",
      label: "Rotate left 15 degrees",
      shortLabel: "-15°",
      icon: RotateCcw,
      run: props.onRotateLeft,
    },
    {
      id: "rotate-right",
      label: "Rotate right 15 degrees",
      shortLabel: "+15°",
      icon: RotateCw,
      run: props.onRotateRight,
    },
    {
      id: "mirror",
      label: "Mirror icon",
      shortLabel: "Mirror",
      icon: FlipHorizontal2,
      run: props.onMirror,
    },
    {
      id: "compact",
      label: "Use compact icon and label sizes",
      shortLabel: "Compact",
      icon: Minimize2,
      run: props.onCompact,
    },
    {
      id: "duplicate",
      label: "Copy icon and place it with the mouse",
      shortLabel: "Copy & place",
      icon: Copy,
      run: props.onDuplicate,
    },
    {
      id: "delete",
      label: "Delete icon",
      shortLabel: "Delete",
      icon: Trash2,
      run: props.onDelete,
      danger: true,
    },
    {
      id: "close",
      label: "Close icon actions",
      shortLabel: "Close",
      icon: X,
      run: props.onClose,
      center: true,
    },
  ];
}

export default function SymbolActionWheel(props: PlanActionWheelProps) {
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const kind: PlanContextWheelKind = props.variant ?? "icon";
  const caption = planContextWheelCaption(kind);
  const actions = actionsFor(props);
  const perimeterActionCount = actions.filter((action) => !action.center).length;
  const safeFocusIndex = Math.min(focusIndex, Math.max(0, actions.length - 1));

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    const currentIndex = actionRefs.current.findIndex(
      (button) => button === document.activeElement,
    );
    if (event.key === "Escape") {
      event.preventDefault();
      props.onClose();
      return;
    }
    const nextIndex = nextContextWheelActionIndex(
      currentIndex,
      event.key,
      actions.length,
    );
    if (nextIndex === null) return;
    event.preventDefault();
    setFocusIndex(nextIndex);
    actionRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      className={`symbol-action-wheel ${props.layout === "strip" ? "compact-strip" : "radial-wheel"}`}
      role="toolbar"
      aria-label={`${caption} actions for ${props.label}`}
      data-wheel-variant={kind}
      data-wheel-layout={props.layout ?? "wheel"}
      data-canvas-ui
      onKeyDown={handleKeyDown}
      style={{ left: props.x, top: props.y } as CSSProperties}
    >
      <span className="symbol-action-wheel-caption" aria-hidden="true">
        {caption}
      </span>
      {actions.map(
        (
          {
            id,
            label: actionLabel,
            shortLabel,
            icon: Icon,
            run,
            danger,
            center,
            disabled,
            pressed,
          },
          index,
        ) => {
          const perimeterIndex = actions
            .slice(0, index)
            .filter((action) => !action.center).length;
          const position = center
            ? { left: 50, top: 50 }
            : contextWheelActionPosition(
                perimeterIndex,
                perimeterActionCount,
              );
          return (
            <button
              type="button"
              key={id}
              ref={(button) => {
                actionRefs.current[index] = button;
              }}
              className={`symbol-wheel-action action-${id}${
                danger ? " danger" : ""
              }${center ? " center" : ""}${pressed ? " active" : ""}`}
              aria-label={actionLabel}
              aria-pressed={pressed}
              title={actionLabel}
              disabled={disabled}
              tabIndex={safeFocusIndex === index ? 0 : -1}
              onFocus={() => setFocusIndex(index)}
              onClick={run}
              style={props.layout === "strip" ? undefined : {
                left: `${position.left}%`,
                top: `${position.top}%`,
              }}
            >
              <Icon size={17} aria-hidden="true" />
              <small>{shortLabel}</small>
            </button>
          );
        },
      )}
    </div>
  );
}
