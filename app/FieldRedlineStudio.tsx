"use client";

import {
  ArrowRight,
  Check,
  Circle,
  Cloud,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Highlighter,
  Lasso,
  Library,
  Lock,
  MousePointer2,
  Palette,
  Pencil,
  Redo2,
  Save,
  Square,
  Type,
  Undo2,
  Unlock,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type {
  RedlineFavorite,
  RedlineLayer,
  RedlineMyDetail,
  RedlineStyle,
} from "./redlineDomain";

export type FieldRedlineTool =
  | "select"
  | "pen"
  | "highlight"
  | "erase"
  | "arrow"
  | "rectangle"
  | "circle"
  | "cloud"
  | "text"
  | "lasso";

export type RedlineExportScope = "current-sheet" | "selected-area";
export type RedlineExportFormat = "png" | "jpg" | "pdf";
export type RedlineExportQuality = "standard" | "4k";
export type RedlineIssueDraftKind = "rfi" | "punch";

export type RedlineStudioDialogState =
  | {
      kind: "details";
      mode: "save";
      name: string;
    }
  | {
      kind: "details";
      mode: "place";
      query: string;
      detailId: string;
    }
  | {
      kind: "export";
      scope: RedlineExportScope;
      format: RedlineExportFormat;
      quality: RedlineExportQuality;
    }
  | {
      kind: "issue-draft";
      issueKind: RedlineIssueDraftKind;
      title: string;
      note: string;
    }
  | {
      kind: "text";
      text: string;
      annotationId?: string;
    };

export type FieldRedlineStudioProps = {
  open: boolean;
  jobName: string;
  sheetLabel: string;
  activeTool: FieldRedlineTool;
  style: RedlineStyle;
  layer: RedlineLayer;
  favorites: readonly RedlineFavorite[];
  myDetails: readonly RedlineMyDetail[];
  selectedAnnotationCount: number;
  statusMessage?: string;
  stylePanelOpen: boolean;
  dialog: RedlineStudioDialogState | null;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: FieldRedlineTool) => void;
  onStyleChange: (style: RedlineStyle) => void;
  onApplyStyleToSelection: (style: RedlineStyle) => void;
  onLayerChange: (layer: RedlineLayer) => void;
  onStylePanelOpenChange: (open: boolean) => void;
  onFavoriteUse: (favorite: RedlineFavorite) => void;
  onFavoriteAssign: (
    slotIndex: number,
    tool: FieldRedlineTool,
    style: RedlineStyle,
  ) => void;
  onDialogChange: (dialog: RedlineStudioDialogState | null) => void;
  onDialogConfirm: (dialog: RedlineStudioDialogState) => void;
  onDetailPreviewChange?: (detail: RedlineMyDetail | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDone: () => void;
};

type ToolDefinition = {
  id: FieldRedlineTool;
  label: string;
  icon: LucideIcon;
};

const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "pen", label: "Pen", icon: Pencil },
  { id: "highlight", label: "Highlight", icon: Highlighter },
  { id: "erase", label: "Erase", icon: Eraser },
  { id: "arrow", label: "Arrow", icon: ArrowRight },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "cloud", label: "Cloud", icon: Cloud },
  { id: "text", label: "Text", icon: Type },
  { id: "lasso", label: "Area select", icon: Lasso },
] as const;

const CONTROL_TARGET_STYLE = {
  minWidth: 44,
  minHeight: 44,
} satisfies CSSProperties;

const FORM_CONTROL_STYLE = {
  minHeight: 44,
} satisfies CSSProperties;

const TABBABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isDrawableTool(tool: FieldRedlineTool) {
  return !["select", "erase", "lasso"].includes(tool);
}

function favoriteTool(favorite: RedlineFavorite): FieldRedlineTool {
  if (favorite.kind === "ink") return "pen";
  if (favorite.kind === "highlighter") return "highlight";
  return favorite.kind;
}

function favoriteDescription(favorite: RedlineFavorite) {
  const tool = favoriteTool(favorite);
  const toolLabel =
    TOOL_DEFINITIONS.find((definition) => definition.id === tool)?.label ||
    favorite.label;
  return `${favorite.label} · ${toolLabel}`;
}

function dialogTitle(dialog: RedlineStudioDialogState) {
  if (dialog.kind === "export") return "Export redlines";
  if (dialog.kind === "text") {
    return dialog.annotationId ? "Edit text redline" : "Add text redline";
  }
  if (dialog.kind === "issue-draft") {
    return dialog.issueKind === "rfi"
      ? "Create RFI draft"
      : "Create punch-list draft";
  }
  return dialog.mode === "save" ? "Save to My Details" : "Place My Detail";
}

function dialogPrimaryLabel(dialog: RedlineStudioDialogState) {
  if (dialog.kind === "export") return "Export";
  if (dialog.kind === "text") {
    return dialog.annotationId ? "Update text" : "Add text";
  }
  if (dialog.kind === "issue-draft") return "Create draft";
  return dialog.mode === "save" ? "Save detail" : "Place detail";
}

function StudioDialog({
  title,
  primaryLabel,
  primaryDisabled,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() => {
      const focusTarget =
        panelRef.current?.querySelector<HTMLElement>("[data-autofocus]") ||
        panelRef.current?.querySelector<HTMLElement>(TABBABLE_SELECTOR);
      focusTarget?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR) || [],
    );
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

  return (
    <div className="redline-dialog-scrim" data-canvas-ui>
      <section
        ref={panelRef}
        className="redline-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <header>
          <div>
            <small>FIELD REDLINE STUDIO</small>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            aria-label={`Close ${title}`}
            title={`Close ${title}`}
            onClick={onCancel}
            style={CONTROL_TARGET_STYLE}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="redline-dialog-body">{children}</div>
        <footer>
          <button
            type="button"
            onClick={onCancel}
            style={CONTROL_TARGET_STYLE}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={primaryDisabled}
            onClick={onConfirm}
            style={CONTROL_TARGET_STYLE}
          >
            <Check size={17} aria-hidden="true" />
            {primaryLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function DetailsDialogBody({
  dialog,
  details,
  selectedAnnotationCount,
  onDialogChange,
  onPreviewChange,
}: {
  dialog: Extract<RedlineStudioDialogState, { kind: "details" }>;
  details: readonly RedlineMyDetail[];
  selectedAnnotationCount: number;
  onDialogChange: (dialog: RedlineStudioDialogState) => void;
  onPreviewChange?: (detail: RedlineMyDetail | null) => void;
}) {
  if (dialog.mode === "save") {
    return (
      <>
        <p>
          Save the {selectedAnnotationCount} selected redline
          {selectedAnnotationCount === 1 ? "" : "s"} as one reusable field
          detail.
        </p>
        <label htmlFor="redline-detail-name">
          Detail name
          <input
            id="redline-detail-name"
            data-autofocus
            type="text"
            value={dialog.name}
            placeholder="Example: FIELD VERIFY BEFORE FABRICATION"
            onChange={(event) =>
              onDialogChange({ ...dialog, name: event.currentTarget.value })
            }
            style={FORM_CONTROL_STYLE}
          />
        </label>
        <aside className="redline-dialog-notice">
          My Details contains redlines only. It does not copy runs, CFM, sizes,
          fittings, connections, approvals, or project IDs.
        </aside>
      </>
    );
  }

  const normalizedQuery = dialog.query.trim().toLocaleLowerCase();
  const filteredDetails = normalizedQuery
    ? details.filter((detail) =>
        detail.name.toLocaleLowerCase().includes(normalizedQuery),
      )
    : details;

  return (
    <>
      <p>
        Choose a saved detail, then move its transparent preview onto the sheet
        before placing it.
      </p>
      <label htmlFor="redline-detail-search">
        Find a detail
        <input
          id="redline-detail-search"
          data-autofocus
          type="search"
          value={dialog.query}
          placeholder="Search My Details"
          onChange={(event) =>
            onDialogChange({ ...dialog, query: event.currentTarget.value })
          }
          style={FORM_CONTROL_STYLE}
        />
      </label>
      <fieldset className="redline-details-list">
        <legend>My Details</legend>
        {filteredDetails.map((detail) => (
          <label
            key={detail.id}
            style={{
              ...CONTROL_TARGET_STYLE,
              display: "flex",
              alignItems: "center",
            }}
          >
            <input
              type="radio"
              name="redline-detail"
              value={detail.id}
              checked={dialog.detailId === detail.id}
              onChange={() => {
                onDialogChange({ ...dialog, detailId: detail.id });
                onPreviewChange?.(detail);
              }}
            />
            <span>
              <strong>{detail.name}</strong>
              <small>
                {detail.annotations.length} redline
                {detail.annotations.length === 1 ? "" : "s"} ·{" "}
                {Math.round(detail.defaultExtent.width * 100)}% ×{" "}
                {Math.round(detail.defaultExtent.height * 100)}% of sheet
              </small>
            </span>
          </label>
        ))}
        {!filteredDetails.length ? (
          <p>
            {details.length
              ? "No saved detail matches this search."
              : "No details saved yet. Select redlines and choose Save in the redline action wheel."}
          </p>
        ) : null}
      </fieldset>
    </>
  );
}

function ExportDialogBody({
  dialog,
  selectedAnnotationCount,
  onDialogChange,
}: {
  dialog: Extract<RedlineStudioDialogState, { kind: "export" }>;
  selectedAnnotationCount: number;
  onDialogChange: (dialog: RedlineStudioDialogState) => void;
}) {
  return (
    <>
      <p>
        Export a clean view without selection handles, action wheels, previews,
        or temporary controls.
      </p>
      <fieldset className="redline-choice-grid">
        <legend>Area</legend>
        <label
          style={{
            ...CONTROL_TARGET_STYLE,
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            type="radio"
            name="redline-export-scope"
            value="current-sheet"
            checked={dialog.scope === "current-sheet"}
            onChange={() =>
              onDialogChange({ ...dialog, scope: "current-sheet" })
            }
          />
          Current sheet
        </label>
        <label
          aria-disabled={!selectedAnnotationCount}
          style={{
            ...CONTROL_TARGET_STYLE,
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            type="radio"
            name="redline-export-scope"
            value="selected-area"
            checked={dialog.scope === "selected-area"}
            disabled={!selectedAnnotationCount}
            onChange={() =>
              onDialogChange({ ...dialog, scope: "selected-area" })
            }
          />
          Selected area
        </label>
      </fieldset>
      <fieldset className="redline-choice-grid">
        <legend>File type</legend>
        {(["png", "jpg", "pdf"] as const).map((format) => (
          <label
            key={format}
            style={{
              ...CONTROL_TARGET_STYLE,
              display: "flex",
              alignItems: "center",
            }}
          >
            <input
              type="radio"
              name="redline-export-format"
              value={format}
              checked={dialog.format === format}
              onChange={() => onDialogChange({ ...dialog, format })}
            />
            {format.toUpperCase()}
          </label>
        ))}
      </fieldset>
      <fieldset className="redline-choice-grid">
        <legend>Quality</legend>
        <label
          style={{
            ...CONTROL_TARGET_STYLE,
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            type="radio"
            name="redline-export-quality"
            value="standard"
            checked={dialog.quality === "standard"}
            onChange={() =>
              onDialogChange({ ...dialog, quality: "standard" })
            }
          />
          Standard
        </label>
        <label
          style={{
            ...CONTROL_TARGET_STYLE,
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            type="radio"
            name="redline-export-quality"
            value="4k"
            checked={dialog.quality === "4k"}
            onChange={() => onDialogChange({ ...dialog, quality: "4k" })}
          />
          4K
        </label>
      </fieldset>
    </>
  );
}

function IssueDraftDialogBody({
  dialog,
  onDialogChange,
}: {
  dialog: Extract<RedlineStudioDialogState, { kind: "issue-draft" }>;
  onDialogChange: (dialog: RedlineStudioDialogState) => void;
}) {
  return (
    <>
      <div className="redline-issue-kind" role="group" aria-label="Draft type">
        <button
          type="button"
          aria-pressed={dialog.issueKind === "rfi"}
          onClick={() =>
            onDialogChange({ ...dialog, issueKind: "rfi" })
          }
          style={CONTROL_TARGET_STYLE}
        >
          RFI draft
        </button>
        <button
          type="button"
          aria-pressed={dialog.issueKind === "punch"}
          onClick={() =>
            onDialogChange({ ...dialog, issueKind: "punch" })
          }
          style={CONTROL_TARGET_STYLE}
        >
          Punch-list draft
        </button>
      </div>
      <label htmlFor="redline-draft-title">
        Title
        <input
          id="redline-draft-title"
          data-autofocus
          type="text"
          value={dialog.title}
          placeholder={
            dialog.issueKind === "rfi"
              ? "What needs clarification?"
              : "What needs correction?"
          }
          onChange={(event) =>
            onDialogChange({ ...dialog, title: event.currentTarget.value })
          }
          style={FORM_CONTROL_STYLE}
        />
      </label>
      <label htmlFor="redline-draft-note">
        Field note
        <textarea
          id="redline-draft-note"
          rows={5}
          value={dialog.note}
          placeholder="Add the location, condition, and requested next step."
          onChange={(event) =>
            onDialogChange({ ...dialog, note: event.currentTarget.value })
          }
          style={{ minHeight: 88 }}
        />
      </label>
      <aside className="redline-dialog-notice">
        Creates a draft only. Nothing is sent, assigned, or added to a tracked
        issue until you review and save it.
      </aside>
    </>
  );
}

function TextDialogBody({
  dialog,
  onDialogChange,
}: {
  dialog: Extract<RedlineStudioDialogState, { kind: "text" }>;
  onDialogChange: (dialog: RedlineStudioDialogState) => void;
}) {
  return (
    <>
      <p>
        {dialog.annotationId
          ? "Update the selected field note without changing its location or style."
          : "Add text at the chosen point. The note remains an editable redline on this sheet."}
      </p>
      <label htmlFor="redline-text-entry">
        Redline text
        <textarea
          id="redline-text-entry"
          data-autofocus
          rows={4}
          value={dialog.text}
          placeholder="Type the field note"
          onChange={(event) =>
            onDialogChange({ ...dialog, text: event.currentTarget.value })
          }
          style={{ minHeight: 88 }}
        />
      </label>
    </>
  );
}

export default function FieldRedlineStudio({
  open,
  jobName,
  sheetLabel,
  activeTool,
  style,
  layer,
  favorites,
  myDetails,
  selectedAnnotationCount,
  statusMessage,
  stylePanelOpen,
  dialog,
  canUndo,
  canRedo,
  onToolChange,
  onStyleChange,
  onApplyStyleToSelection,
  onLayerChange,
  onStylePanelOpenChange,
  onFavoriteUse,
  onFavoriteAssign,
  onDialogChange,
  onDialogConfirm,
  onDetailPreviewChange,
  onUndo,
  onRedo,
  onDone,
}: FieldRedlineStudioProps) {
  const toolRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dockRef = useRef<HTMLElement>(null);
  const [toolFocusIndex, setToolFocusIndex] = useState(() =>
    Math.max(
      0,
      TOOL_DEFINITIONS.findIndex((definition) => definition.id === activeTool),
    ),
  );

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const activeIndex = Math.max(
        0,
        TOOL_DEFINITIONS.findIndex(
          (definition) => definition.id === activeTool,
        ),
      );
      setToolFocusIndex(activeIndex);
      toolRefs.current[activeIndex]?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTool, open]);

  if (!open) return null;

  const favoriteSlots = Array.from(
    { length: 4 },
    (_, index) => favorites[index] || null,
  );
  const drawingUnavailable = layer.locked || !layer.visible;
  const safeToolFocusIndex = drawingUnavailable ? 0 : toolFocusIndex;
  const lineOpacityPercent = Math.round(
    Math.max(0.1, Math.min(1, style.opacity)) * 100,
  );
  const layerOpacityPercent = Math.round(
    Math.max(0, Math.min(1, layer.opacity)) * 100,
  );

  function handleToolKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
        event.key,
      )
    ) {
      return;
    }
    event.preventDefault();
    const currentIndex = toolRefs.current.findIndex(
      (button) => button === document.activeElement,
    );
    let nextIndex = currentIndex < 0 ? 0 : currentIndex;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TOOL_DEFINITIONS.length - 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (nextIndex + 1) % TOOL_DEFINITIONS.length;
    } else {
      nextIndex =
        (nextIndex - 1 + TOOL_DEFINITIONS.length) % TOOL_DEFINITIONS.length;
    }

    let attempts = 0;
    while (toolRefs.current[nextIndex]?.disabled && attempts < TOOL_DEFINITIONS.length) {
      nextIndex =
        event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (nextIndex - 1 + TOOL_DEFINITIONS.length) % TOOL_DEFINITIONS.length
          : (nextIndex + 1) % TOOL_DEFINITIONS.length;
      attempts += 1;
    }
    setToolFocusIndex(nextIndex);
    toolRefs.current[nextIndex]?.focus();
  }

  function closeDialog() {
    onDetailPreviewChange?.(null);
    onDialogChange(null);
  }

  function dialogIsInvalid(current: RedlineStudioDialogState) {
    if (current.kind === "export") {
      return (
        current.scope === "selected-area" && selectedAnnotationCount === 0
      );
    }
    if (current.kind === "issue-draft") {
      return !current.title.trim() || selectedAnnotationCount === 0;
    }
    if (current.kind === "text") return !current.text.trim();
    if (current.mode === "save") {
      return !current.name.trim() || selectedAnnotationCount === 0;
    }
    return !current.detailId;
  }

  return (
    <>
      <section
        id="field-redline-studio"
        ref={dockRef}
        className="field-redline-studio"
        aria-label="Field Redline Studio"
        inert={dialog ? true : undefined}
        data-canvas-ui
      >
        <header className="redline-dock-heading">
          <div>
            <small>FIELD REDLINE STUDIO</small>
            <strong>{jobName}</strong>
            <span>{sheetLabel}</span>
          </div>
          <div className="redline-history-actions">
            <button
              type="button"
              aria-label="Undo last redline change"
              title="Undo"
              disabled={!canUndo}
              onClick={onUndo}
              style={CONTROL_TARGET_STYLE}
            >
              <Undo2 size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Redo last redline change"
              title="Redo"
              disabled={!canRedo}
              onClick={onRedo}
              style={CONTROL_TARGET_STYLE}
            >
              <Redo2 size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div
          className="redline-tool-strip"
          role="toolbar"
          aria-label="Field redline tools"
          onKeyDown={handleToolKeyDown}
        >
          {TOOL_DEFINITIONS.map((definition, index) => {
            const Icon = definition.icon;
            const disabled =
              definition.id !== "select" && drawingUnavailable;
            return (
              <button
                type="button"
                key={definition.id}
                ref={(button) => {
                  toolRefs.current[index] = button;
                }}
                className={`redline-tool tool-${definition.id}${
                  activeTool === definition.id ? " active" : ""
                }`}
                aria-label={definition.label}
                aria-pressed={activeTool === definition.id}
                title={definition.label}
                disabled={disabled}
                tabIndex={safeToolFocusIndex === index ? 0 : -1}
                onFocus={() => setToolFocusIndex(index)}
                onClick={() => onToolChange(definition.id)}
                style={CONTROL_TARGET_STYLE}
              >
                <Icon size={18} aria-hidden="true" />
                <small>{definition.label}</small>
              </button>
            );
          })}
        </div>

        <section className="redline-style-disclosure">
          <button
            type="button"
            className="redline-style-trigger"
            aria-expanded={stylePanelOpen}
            aria-controls="redline-style-panel"
            onClick={() => onStylePanelOpenChange(!stylePanelOpen)}
            style={CONTROL_TARGET_STYLE}
          >
            <Palette size={18} aria-hidden="true" />
            Style
            <span
              className="redline-style-swatch"
              aria-hidden="true"
              style={{ backgroundColor: style.color }}
            />
          </button>
          {stylePanelOpen ? (
            <div id="redline-style-panel" className="redline-style-panel">
              <label>
                Line color
                <input
                  type="color"
                  value={style.color}
                  onChange={(event) =>
                    onStyleChange({
                      ...style,
                      color: event.currentTarget.value,
                    })
                  }
                  style={CONTROL_TARGET_STYLE}
                />
              </label>
              <label>
                Line width
                <select
                  value={style.strokeWidth}
                  onChange={(event) =>
                    onStyleChange({
                      ...style,
                      strokeWidth: Number(event.currentTarget.value),
                    })
                  }
                  style={FORM_CONTROL_STYLE}
                >
                  <option value={0.001}>Hairline</option>
                  <option value={0.002}>Fine</option>
                  <option value={0.004}>Standard</option>
                  <option value={0.008}>Bold</option>
                  <option value={0.014}>Highlighter</option>
                </select>
              </label>
              <label>
                Opacity
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={lineOpacityPercent}
                  onChange={(event) =>
                    onStyleChange({
                      ...style,
                      opacity: Number(event.currentTarget.value) / 100,
                    })
                  }
                  style={FORM_CONTROL_STYLE}
                />
                <output>{lineOpacityPercent}%</output>
              </label>
              <label>
                Fill color
                <input
                  type="color"
                  value={style.fillColor || "#ffffff"}
                  onChange={(event) =>
                    onStyleChange({
                      ...style,
                      fillColor: event.currentTarget.value,
                    })
                  }
                  style={CONTROL_TARGET_STYLE}
                />
              </label>
              {selectedAnnotationCount ? (
                <button
                  type="button"
                  className="redline-apply-style"
                  onClick={() => onApplyStyleToSelection(style)}
                  style={CONTROL_TARGET_STYLE}
                >
                  Apply style to {selectedAnnotationCount} selected
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="redline-layer-controls" aria-label="Redline layer">
          <header>
            <span>
              <strong>{layer.name}</strong>
              <small>Redline layer</small>
            </span>
            <div>
              <button
                type="button"
                aria-label="Show or hide redline layer"
                aria-pressed={layer.visible}
                title="Show or hide redline layer"
                onClick={() =>
                  onLayerChange({ ...layer, visible: !layer.visible })
                }
                style={CONTROL_TARGET_STYLE}
              >
                {layer.visible ? (
                  <Eye size={18} aria-hidden="true" />
                ) : (
                  <EyeOff size={18} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                aria-label="Lock or unlock redline layer"
                aria-pressed={layer.locked}
                title="Lock or unlock redline layer"
                onClick={() =>
                  onLayerChange({ ...layer, locked: !layer.locked })
                }
                style={CONTROL_TARGET_STYLE}
              >
                {layer.locked ? (
                  <Lock size={18} aria-hidden="true" />
                ) : (
                  <Unlock size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </header>
          <label>
            Layer opacity
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={layerOpacityPercent}
              onChange={(event) =>
                onLayerChange({
                  ...layer,
                  opacity: Number(event.currentTarget.value) / 100,
                })
              }
              style={FORM_CONTROL_STYLE}
            />
            <output>{layerOpacityPercent}%</output>
          </label>
        </section>

        <section className="redline-favorites">
          <header>
            <strong>Favorites</strong>
            <small>Four quick redline styles</small>
          </header>
          <div className="redline-favorite-strip" role="group" aria-label="Four favorite redline styles">
            {favoriteSlots.map((favorite, index) =>
              favorite ? (
                <button
                  type="button"
                  key={favorite.id}
                  aria-label={`Use favorite ${index + 1}: ${favoriteDescription(
                    favorite,
                  )}`}
                  title={favoriteDescription(favorite)}
                  disabled={drawingUnavailable}
                  onClick={() => onFavoriteUse(favorite)}
                  style={CONTROL_TARGET_STYLE}
                >
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: favorite.style.color }}
                  />
                  <small>{favorite.label}</small>
                </button>
              ) : (
                <button
                  type="button"
                  key={`empty-favorite-${index}`}
                  aria-label={`Save current style to favorite ${index + 1}`}
                  title={`Save current style to favorite ${index + 1}`}
                  disabled={
                    drawingUnavailable || !isDrawableTool(activeTool)
                  }
                  onClick={() =>
                    onFavoriteAssign(index, activeTool, style)
                  }
                  style={CONTROL_TARGET_STYLE}
                >
                  <Save size={17} aria-hidden="true" />
                  <small>Set {index + 1}</small>
                </button>
              ),
            )}
          </div>
        </section>

        <div className="redline-dock-actions">
          <button
            type="button"
            onClick={() =>
              onDialogChange({
                kind: "details",
                mode: "place",
                query: "",
                detailId: "",
              })
            }
            style={CONTROL_TARGET_STYLE}
          >
            <Library size={18} aria-hidden="true" />
            My Details
          </button>
          <button
            type="button"
            onClick={() =>
              onDialogChange({
                kind: "export",
                scope: "current-sheet",
                format: "png",
                quality: "standard",
              })
            }
            style={CONTROL_TARGET_STYLE}
          >
            <Download size={18} aria-hidden="true" />
            Export
          </button>
          <button
            type="button"
            className="primary"
            onClick={onDone}
            style={CONTROL_TARGET_STYLE}
          >
            <Check size={18} aria-hidden="true" />
            Done
          </button>
        </div>

        <footer className="redline-safety-note">
          <Lock size={16} aria-hidden="true" />
          <span>
            <strong>Redlines never change runs, CFM, sizes, fittings, or connections.</strong>
            They stay on their own plan layer.
          </span>
          <span
            className="redline-studio-status"
            role="status"
            aria-live="polite"
          >
            {statusMessage}
          </span>
        </footer>
      </section>

      {dialog ? (
        <StudioDialog
          title={dialogTitle(dialog)}
          primaryLabel={dialogPrimaryLabel(dialog)}
          primaryDisabled={dialogIsInvalid(dialog)}
          onCancel={closeDialog}
          onConfirm={() => onDialogConfirm(dialog)}
        >
          {dialog.kind === "details" ? (
            <DetailsDialogBody
              dialog={dialog}
              details={myDetails}
              selectedAnnotationCount={selectedAnnotationCount}
              onDialogChange={onDialogChange}
              onPreviewChange={onDetailPreviewChange}
            />
          ) : null}
          {dialog.kind === "export" ? (
            <ExportDialogBody
              dialog={dialog}
              selectedAnnotationCount={selectedAnnotationCount}
              onDialogChange={onDialogChange}
            />
          ) : null}
          {dialog.kind === "issue-draft" ? (
            <IssueDraftDialogBody
              dialog={dialog}
              onDialogChange={onDialogChange}
            />
          ) : null}
          {dialog.kind === "text" ? (
            <TextDialogBody
              dialog={dialog}
              onDialogChange={onDialogChange}
            />
          ) : null}
        </StudioDialog>
      ) : null}
    </>
  );
}
