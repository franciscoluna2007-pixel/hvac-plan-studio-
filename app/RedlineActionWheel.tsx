"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ClipboardList,
  Columns3,
  Copy,
  FileQuestion,
  Group,
  RotateCcw,
  RotateCw,
  Rows3,
  Save,
  Scaling,
  Shrink,
  SquarePen,
  Trash2,
  Ungroup,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

export type RedlineSelectionAction =
  | "duplicate"
  | "scale-down"
  | "scale-up"
  | "edit-text"
  | "rotate-left"
  | "rotate-right"
  | "group"
  | "ungroup"
  | "align-left"
  | "align-center"
  | "align-right"
  | "distribute-horizontal"
  | "distribute-vertical"
  | "save-detail"
  | "create-rfi-draft"
  | "create-punch-draft"
  | "delete";

export type RedlineActionWheelProps = {
  x: number;
  y: number;
  layout?: "wheel" | "strip";
  selectedAnnotationIds: readonly string[];
  grouped: boolean;
  label?: string;
  canDuplicate?: boolean;
  canRotate?: boolean;
  canGroup?: boolean;
  canUngroup?: boolean;
  canAlign?: boolean;
  canDistribute?: boolean;
  canEditText?: boolean;
  autoFocus?: boolean;
  onAction: (
    action: RedlineSelectionAction,
    annotationIds: readonly string[],
  ) => void;
  onClose: () => void;
};

type WheelAction = {
  id: RedlineSelectionAction;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
};

const CONTROL_TARGET_STYLE = {
  minWidth: 44,
  minHeight: 44,
} satisfies CSSProperties;

function perimeterPosition(index: number, count: number) {
  if (count <= 0) return { left: 50, top: 50 };
  const innerCount = count > 9 ? Math.ceil(count * 0.4) : count;
  const onInnerRing = index < innerCount;
  const ringIndex = onInnerRing ? index : index - innerCount;
  const ringCount = onInnerRing ? innerCount : count - innerCount;
  const angle = -Math.PI / 2 + (ringIndex * Math.PI * 2) / ringCount;
  const radiusPercent = count > 9
    ? (onInnerRing ? 28 : 46)
    : 43;
  return {
    left: 50 + Math.cos(angle) * radiusPercent,
    top: 50 + Math.sin(angle) * radiusPercent,
  };
}

function nextActionIndex(
  currentIndex: number,
  key: string,
  actionCount: number,
) {
  if (!actionCount) return null;
  if (key === "Home") return 0;
  if (key === "End") return actionCount - 1;
  if (key === "ArrowRight" || key === "ArrowDown") {
    return (Math.max(0, currentIndex) + 1) % actionCount;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return (
      (currentIndex < 0 ? 0 : currentIndex - 1 + actionCount) % actionCount
    );
  }
  return null;
}

function singleSelectionActions(
  props: RedlineActionWheelProps,
): WheelAction[] {
  return [
    {
      id: "scale-down",
      label: "Make selected redline smaller",
      shortLabel: "Smaller",
      icon: Shrink,
    },
    {
      id: "scale-up",
      label: "Make selected redline larger",
      shortLabel: "Larger",
      icon: Scaling,
    },
    ...(props.canEditText
      ? [{
          id: "edit-text" as const,
          label: "Edit selected redline text",
          shortLabel: "Edit text",
          icon: SquarePen,
        }]
      : []),
    {
      id: "rotate-left",
      label: "Rotate redline left 15 degrees",
      shortLabel: "-15°",
      icon: RotateCcw,
      disabled: props.canRotate === false,
    },
    {
      id: "rotate-right",
      label: "Rotate redline right 15 degrees",
      shortLabel: "+15°",
      icon: RotateCw,
      disabled: props.canRotate === false,
    },
    {
      id: "duplicate",
      label: "Duplicate redline",
      shortLabel: "Copy",
      icon: Copy,
      disabled: props.canDuplicate === false,
    },
    {
      id: "save-detail",
      label: "Save selected redline as My Detail",
      shortLabel: "Save",
      icon: Save,
    },
    {
      id: "create-rfi-draft",
      label: "Create RFI draft from selected redline",
      shortLabel: "RFI",
      icon: FileQuestion,
    },
    {
      id: "create-punch-draft",
      label: "Create punch-list draft from selected redline",
      shortLabel: "Punch",
      icon: ClipboardList,
    },
    {
      id: "delete",
      label: "Delete selected redline",
      shortLabel: "Delete",
      icon: Trash2,
      danger: true,
    },
  ];
}

function multipleSelectionActions(
  props: RedlineActionWheelProps,
): WheelAction[] {
  return [
    {
      id: "scale-down",
      label: "Make selected redlines smaller",
      shortLabel: "Smaller",
      icon: Shrink,
    },
    {
      id: "scale-up",
      label: "Make selected redlines larger",
      shortLabel: "Larger",
      icon: Scaling,
    },
    {
      id: "duplicate",
      label: "Duplicate selected redlines",
      shortLabel: "Copy",
      icon: Copy,
      disabled: props.canDuplicate === false,
    },
    props.grouped
      ? {
          id: "ungroup",
          label: "Ungroup selected redlines",
          shortLabel: "Ungroup",
          icon: Ungroup,
          disabled: props.canUngroup === false,
        }
      : {
          id: "group",
          label: "Group selected redlines",
          shortLabel: "Group",
          icon: Group,
          disabled: props.canGroup === false,
        },
    {
      id: "align-left",
      label: "Align selected redlines left",
      shortLabel: "Left",
      icon: AlignLeft,
      disabled: props.canAlign === false,
    },
    {
      id: "align-center",
      label: "Align selected redlines to center",
      shortLabel: "Center",
      icon: AlignCenter,
      disabled: props.canAlign === false,
    },
    {
      id: "align-right",
      label: "Align selected redlines right",
      shortLabel: "Right",
      icon: AlignRight,
      disabled: props.canAlign === false,
    },
    {
      id: "distribute-horizontal",
      label: "Distribute selected redlines horizontally",
      shortLabel: "Across",
      icon: Columns3,
      disabled: props.canDistribute === false,
    },
    {
      id: "distribute-vertical",
      label: "Distribute selected redlines vertically",
      shortLabel: "Down",
      icon: Rows3,
      disabled: props.canDistribute === false,
    },
    {
      id: "save-detail",
      label: "Save selected redlines as My Detail",
      shortLabel: "Save",
      icon: Save,
    },
    {
      id: "create-rfi-draft",
      label: "Create RFI draft from selected redlines",
      shortLabel: "RFI",
      icon: FileQuestion,
    },
    {
      id: "create-punch-draft",
      label: "Create punch-list draft from selected redlines",
      shortLabel: "Punch",
      icon: ClipboardList,
    },
    {
      id: "delete",
      label: "Delete selected redlines",
      shortLabel: "Delete",
      icon: Trash2,
      danger: true,
    },
  ];
}

export default function RedlineActionWheel(props: RedlineActionWheelProps) {
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const selectedCount = props.selectedAnnotationIds.length;
  const actions = (
    selectedCount === 1
      ? singleSelectionActions(props)
      : multipleSelectionActions(props)
  ).filter((action) => !action.disabled);
  useEffect(() => {
    if (!props.autoFocus || !selectedCount) return;
    const frame = window.requestAnimationFrame(() => {
      actionRefs.current[0]?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [props.autoFocus, selectedCount]);
  if (!selectedCount) return null;
  const safeFocusIndex = Math.min(
    focusIndex,
    Math.max(0, actions.length),
  );
  const selectionLabel =
    props.label ||
    `${selectedCount} selected redline${selectedCount === 1 ? "" : "s"}`;
  const layout = props.layout ?? "wheel";

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      props.onClose();
      return;
    }
    const currentIndex = actionRefs.current.findIndex(
      (button) => button === document.activeElement,
    );
    const nextIndex = nextActionIndex(
      currentIndex,
      event.key,
      actions.length + 1,
    );
    if (nextIndex === null) return;
    event.preventDefault();
    setFocusIndex(nextIndex);
    actionRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      className={`redline-selection-wheel${layout === "strip" ? " is-strip" : ""}`}
      role="toolbar"
      aria-label={`Redline actions for ${selectionLabel}`}
      aria-orientation={layout === "strip" ? "horizontal" : undefined}
      data-selection-scope="redlines-only"
      data-selection-count={selectedCount}
      data-action-count={actions.length}
      data-canvas-ui
      onKeyDown={handleKeyDown}
      onWheel={layout === "strip" ? (event) => event.stopPropagation() : undefined}
      style={layout === "wheel"
        ? {
            left: props.x,
            top: props.y,
            transform: "translate(-50%, -50%)",
          } satisfies CSSProperties
        : undefined}
    >
      <span className="redline-selection-wheel-caption" aria-hidden="true">
        {layout === "strip" ? "Redline actions" : "Redline actions only"}
      </span>
      {actions.map((action, index) => {
        const position = perimeterPosition(index, actions.length);
        const Icon = action.icon;
        return (
          <button
            type="button"
            key={action.id}
            ref={(button) => {
              actionRefs.current[index] = button;
            }}
            className={`redline-wheel-action action-${action.id}${
              action.danger ? " danger" : ""
            }`}
            aria-label={action.label}
            title={action.label}
            tabIndex={safeFocusIndex === index ? 0 : -1}
            onFocus={(event) => {
              setFocusIndex(index);
              if (layout === "strip") {
                event.currentTarget.scrollIntoView({
                  block: "nearest",
                  inline: "nearest",
                });
              }
            }}
            onClick={() =>
              props.onAction(action.id, props.selectedAnnotationIds)
            }
            style={{
              ...CONTROL_TARGET_STYLE,
              ...(layout === "wheel"
                ? {
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                  }
                : {}),
            }}
          >
            <Icon size={17} aria-hidden="true" />
            <small>{action.shortLabel}</small>
          </button>
        );
      })}
      <button
        type="button"
        ref={(button) => {
          actionRefs.current[actions.length] = button;
        }}
        className="redline-wheel-action action-close center"
        aria-label="Close redline actions"
        title="Close redline actions"
        tabIndex={safeFocusIndex === actions.length ? 0 : -1}
        onFocus={(event) => {
          setFocusIndex(actions.length);
          if (layout === "strip") {
            event.currentTarget.scrollIntoView({
              block: "nearest",
              inline: "nearest",
            });
          }
        }}
        onClick={props.onClose}
        style={{
          ...CONTROL_TARGET_STYLE,
          ...(layout === "wheel" ? { left: "50%", top: "50%" } : {}),
        }}
      >
        <X size={18} aria-hidden="true" />
        <small>Close</small>
      </button>
    </div>
  );
}
