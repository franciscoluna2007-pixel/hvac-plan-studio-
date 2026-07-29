"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  applyRedlineCommand,
  createRedlineDocument,
  createRedlineSnapshot,
  normalizeRedlineStyle,
  parseRedlineSnapshot,
  REDLINE_POLICY_LIMITS,
  redlineDocumentFingerprint,
  redlineSelectionBounds,
  visibleRedlineAnnotations,
  type RedlineAnnotation,
  type RedlineAnnotationKind,
  type RedlineCommand,
  type RedlineDocument,
  type RedlineFavorite,
  type RedlineLayer,
  type RedlineMyDetail,
  type RedlinePageBinding,
  type RedlinePoint,
  type RedlineSnapshotV1,
  type RedlineStyle,
} from "./redlineDomain";
import {
  createRedlineHistory,
  executeRedlineCommand,
  redlineHistoryCanRedo,
  redlineHistoryCanUndo,
  redoRedlineHistory,
  replaceRedlineHistorySelection,
  undoRedlineHistory,
  type RedlineHistory,
} from "./redlineHistory";
import {
  createRedlineStrokeDraft,
  normalizeCoalescedRedlineSamples,
  normalizeRedlinePointerSample,
  redlinePointerCanDraw,
  type RedlinePointerSample,
} from "./redlineInput";
import type {
  FieldRedlineTool,
  RedlineStudioDialogState,
} from "./FieldRedlineStudio";
import type {
  RedlineCanvasTransient,
} from "./RedlineCanvasLayer";
import type {
  RedlineSelectionAction,
} from "./RedlineActionWheel";

type ActiveRedlinePointer =
  | {
      kind: "stroke";
      pointerId: number;
      tool: "pen" | "highlight";
      samples: RedlinePointerSample[];
    }
  | {
      kind: "callout";
      pointerId: number;
      tool: "arrow" | "rectangle" | "circle" | "cloud" | "text";
      start: RedlinePoint;
      current: RedlinePoint;
    }
  | {
      kind: "selection-box";
      pointerId: number;
      start: RedlinePoint;
      current: RedlinePoint;
      additive: boolean;
    }
  | {
      kind: "lasso";
      pointerId: number;
      points: RedlinePoint[];
      additive: boolean;
    }
  | {
      kind: "move";
      pointerId: number;
      start: RedlinePoint;
      current: RedlinePoint;
      annotationIds: string[];
      sourceDocument: RedlineDocument;
    };

type PendingText = {
  start: RedlinePoint;
  end: RedlinePoint;
};

export type FieldRedlineIssueDraft = {
  kind: "rfi" | "punch";
  title: string;
  note: string;
  annotationIds: string[];
  binding: RedlinePageBinding;
  bounds: ReturnType<typeof redlineSelectionBounds>;
  redlineFingerprint: string;
};

export type FieldRedlineExportRequest = Extract<
  RedlineStudioDialogState,
  { kind: "export" }
>;

export type FieldRedlineRestoreResult =
  | "restored"
  | "empty"
  | "quarantined";

type ControllerOptions = {
  page: number;
  pageAspectRatio?: number;
  onMessage?: (message: string) => void;
  onExport?: (request: FieldRedlineExportRequest) => void | Promise<void>;
  onIssueDraft?: (draft: FieldRedlineIssueDraft) => void;
};

function annotationKindForTool(
  tool: FieldRedlineTool,
): RedlineAnnotationKind | null {
  if (tool === "pen") return "ink";
  if (tool === "highlight") return "highlighter";
  if (
    tool === "arrow" ||
    tool === "rectangle" ||
    tool === "circle" ||
    tool === "cloud" ||
    tool === "text"
  ) {
    return tool;
  }
  return null;
}

function viewportForSvg(svg: SVGSVGElement) {
  const bounds = svg.getBoundingClientRect();
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  };
}

function normalizedPointFromEvent(
  event:
    | ReactPointerEvent<SVGSVGElement>
    | ReactPointerEvent<SVGGElement>,
) {
  const svg =
    event.currentTarget instanceof SVGSVGElement
      ? event.currentTarget
      : event.currentTarget.ownerSVGElement;
  if (!svg) return null;
  return normalizeRedlinePointerSample(
    event.nativeEvent,
    viewportForSvg(svg),
  );
}

function bindingMatches(
  annotation: RedlineAnnotation,
  binding: RedlinePageBinding,
) {
  return (
    annotation.binding.sourceFingerprint === binding.sourceFingerprint &&
    annotation.binding.page === binding.page
  );
}

function selectionForAnnotation(
  document: RedlineDocument,
  annotationId: string,
) {
  const group = document.groups.find((candidate) =>
    candidate.annotationIds.includes(annotationId),
  );
  return group ? [...group.annotationIds] : [annotationId];
}

function rectangleSelection(
  document: RedlineDocument,
  binding: RedlinePageBinding,
  start: RedlinePoint,
  end: RedlinePoint,
) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);
  const crossing = end.x < start.x;
  return document.annotations
    .filter((annotation) => bindingMatches(annotation, binding))
    .filter((annotation) => {
      const bounds = redlineSelectionBounds(document, [annotation.id]);
      if (!bounds) return false;
      if (crossing) {
        return !(
          bounds.right < left ||
          bounds.left > right ||
          bounds.bottom < top ||
          bounds.top > bottom
        );
      }
      return (
        bounds.left >= left &&
        bounds.right <= right &&
        bounds.top >= top &&
        bounds.bottom <= bottom
      );
    })
    .flatMap((annotation) =>
      selectionForAnnotation(document, annotation.id),
    )
    .filter((id, index, ids) => ids.indexOf(id) === index);
}

function transientAnnotation(
  document: RedlineDocument,
  layer: RedlineLayer,
  binding: RedlinePageBinding,
  active: Extract<
    ActiveRedlinePointer,
    { kind: "stroke" | "callout" }
  >,
  style: RedlineStyle,
): RedlineAnnotation | null {
  if (active.kind === "stroke") {
    const kind = active.tool === "pen" ? "ink" : "highlighter";
    if (!active.samples.length) return null;
    return {
      id: "redline-transient",
      kind,
      layerId: layer.id,
      binding,
      style: normalizeRedlineStyle(kind, style),
      points: active.samples.map(({ x, y, pressure, t }) => ({
        x,
        y,
        pressure,
        t,
      })),
    };
  }
  return {
    id: "redline-transient",
    kind: active.tool,
    layerId: layer.id,
    binding,
    style: normalizeRedlineStyle(active.tool, style),
    start: active.start,
    end: active.current,
    ...(active.tool === "text" ? { text: "Text" } : {}),
  };
}

export function useFieldRedlineController({
  page,
  pageAspectRatio = 1,
  onMessage,
  onExport,
  onIssueDraft,
}: ControllerOptions) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<RedlineHistory | null>(null);
  const historyRef = useRef<RedlineHistory | null>(null);
  const [quarantinedSnapshot, setQuarantinedSnapshot] =
    useState<unknown>(null);
  const [activeTool, setActiveTool] = useState<FieldRedlineTool>("select");
  const [style, setStyle] = useState<RedlineStyle>(() =>
    normalizeRedlineStyle("ink", {}),
  );
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const [dialog, setDialogState] =
    useState<RedlineStudioDialogState | null>(null);
  const [transient, setTransient] =
    useState<RedlineCanvasTransient | null>(null);
  const [previewDocument, setPreviewDocument] =
    useState<RedlineDocument | null>(null);
  const [pendingDetail, setPendingDetail] =
    useState<RedlineMyDetail | null>(null);
  const [pendingText, setPendingText] = useState<PendingText | null>(null);
  const activePointerRef = useRef<ActiveRedlinePointer | null>(null);

  const document = history?.present || null;
  const activeLayer =
    document?.layers.find((layer) => layer.id === "field-redlines") ||
    document?.layers[0] ||
    null;
  const sourceFingerprint = document?.binding.sourceFingerprint || null;
  const binding = useMemo(
    () =>
      sourceFingerprint
        ? {
            sourceFingerprint,
            page,
          }
        : null,
    [page, sourceFingerprint],
  );
  const selection = useMemo(
    () =>
      (history?.selection || []).filter((annotationId) => {
        const annotation = document?.annotations.find(
          (candidate) => candidate.id === annotationId,
        );
        return Boolean(
          annotation &&
          binding &&
          bindingMatches(annotation, binding),
        );
      }),
    [binding, document, history?.selection],
  );
  const renderedDocument = previewDocument || document;
  const pageAnnotations = useMemo(
    () =>
      renderedDocument && binding
        ? visibleRedlineAnnotations(renderedDocument, binding)
        : [],
    [binding, renderedDocument],
  );
  const selectionBounds = useMemo(
    () =>
      document && selection.length
        ? redlineSelectionBounds(document, selection)
        : null,
    [document, selection],
  );
  const selectedGroup = useMemo(
    () =>
      document?.groups.find((group) =>
        selection.some((id) => group.annotationIds.includes(id)),
      ),
    [document, selection],
  );

  const message = useCallback(
    (value: string) => onMessage?.(value),
    [onMessage],
  );

  const resetForSource = useCallback(
    (sourceFingerprint: string, pageCount: number, title?: string) => {
      const next = createRedlineDocument({
        sourceFingerprint,
        pageCount,
        title,
      });
      const nextHistory = createRedlineHistory(next);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      setQuarantinedSnapshot(null);
      setPreviewDocument(null);
      setTransient(null);
      setPendingDetail(null);
      setPendingText(null);
      setDialogState(null);
      setActiveTool("select");
      activePointerRef.current = null;
    },
    [],
  );

  const restoreSnapshot = useCallback(
    (
      snapshot: RedlineSnapshotV1 | unknown,
      expected: { sourceFingerprint: string; pageCount: number },
      preservedQuarantine?: unknown,
    ): FieldRedlineRestoreResult => {
      if (!snapshot) {
        resetForSource(expected.sourceFingerprint, expected.pageCount);
        setQuarantinedSnapshot(preservedQuarantine ?? null);
        return "empty";
      }
      const parsed = parseRedlineSnapshot(snapshot, expected);
      if (parsed.status !== "ready") {
        const emptyHistory = createRedlineHistory(
          createRedlineDocument(expected),
        );
        historyRef.current = emptyHistory;
        setHistory(emptyHistory);
        setQuarantinedSnapshot(snapshot);
        setPreviewDocument(null);
        setTransient(null);
        setPendingDetail(null);
        setPendingText(null);
        setDialogState(null);
        setActiveTool("select");
        activePointerRef.current = null;
        message(
          `${parsed.reason} The original redline data was quarantined and preserved; a new empty layer was opened.`,
        );
        return "quarantined";
      }
      const nextHistory = createRedlineHistory(parsed.document);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      setQuarantinedSnapshot(preservedQuarantine ?? null);
      setPreviewDocument(null);
      setTransient(null);
      setPendingDetail(null);
      setPendingText(null);
      setDialogState(null);
      setActiveTool("select");
      activePointerRef.current = null;
      if (parsed.sanitized) {
        message("Field redlines were restored with unsafe values removed.");
      }
      return "restored";
    },
    [message, resetForSource],
  );

  const runCommand = useCallback(
    (command: RedlineCommand) => {
      const current = historyRef.current;
      if (!current) return;
      const transition = executeRedlineCommand(current, command);
      const preserveSelection = [
        "add-layer",
        "update-layer",
        "remove-layer",
        "upsert-favorite",
        "remove-favorite",
      ].includes(command.type);
      const nextHistory = preserveSelection
        ? replaceRedlineHistorySelection(
          transition.history,
          current.selection,
        )
        : transition.history;
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      if (transition.reason) message(transition.reason);
      setPreviewDocument(null);
      setTransient(null);
    },
    [message],
  );

  const select = useCallback((annotationIds: readonly string[]) => {
    const current = historyRef.current;
    if (!current) return;
    const nextHistory = replaceRedlineHistorySelection(
      current,
      annotationIds,
    );
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, []);

  const resetPageInteraction = useCallback(() => {
    activePointerRef.current = null;
    setTransient(null);
    setPreviewDocument(null);
    setPendingDetail(null);
    const current = historyRef.current;
    if (!current || !current.selection.length) return;
    const nextHistory = replaceRedlineHistorySelection(current, []);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, []);

  const setDialog = useCallback(
    (next: RedlineStudioDialogState | null) => {
      if (!next) {
        setPendingText(null);
      }
      setDialogState(next);
    },
    [],
  );

  const setTool = useCallback((tool: FieldRedlineTool) => {
    setActiveTool(tool);
    const kind = annotationKindForTool(tool);
    if (kind) {
      setStyle((current) => normalizeRedlineStyle(kind, current));
    }
    setPendingDetail(null);
    setTransient(null);
    setPreviewDocument(null);
    activePointerRef.current = null;
  }, []);

  const updateLayer = useCallback(
    (layer: RedlineLayer) => {
      runCommand({
        type: "update-layer",
        layerId: layer.id,
        changes: {
          name: layer.name,
          visible: layer.visible,
          locked: layer.locked,
          opacity: layer.opacity,
          order: layer.order,
        },
      });
      if (layer.locked || !layer.visible) setActiveTool("select");
    },
    [runCommand],
  );

  const useFavorite = useCallback((favorite: RedlineFavorite) => {
    setStyle(favorite.style);
    setActiveTool(
      favorite.kind === "ink"
        ? "pen"
        : favorite.kind === "highlighter"
          ? "highlight"
          : favorite.kind,
    );
  }, []);

  const setDetailPreview = useCallback(
    (detail: RedlineMyDetail | null) => {
      setPendingDetail(detail);
      setPreviewDocument(null);
      if (detail) {
        setActiveTool("select");
      }
    },
    [],
  );

  const assignFavorite = useCallback(
    (
      slotIndex: number,
      tool: FieldRedlineTool,
      favoriteStyle: RedlineStyle,
    ) => {
      const kind = annotationKindForTool(tool);
      if (!kind || slotIndex < 0 || slotIndex > 3) return;
      runCommand({
        type: "upsert-favorite",
        favorite: {
          id: `favorite-${slotIndex + 1}`,
          label: `${tool === "highlight" ? "Highlight" : tool[0].toUpperCase() + tool.slice(1)} ${slotIndex + 1}`,
          kind,
          style: normalizeRedlineStyle(kind, favoriteStyle),
        },
      });
    },
    [runCommand],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!open || !history || !activeLayer || !binding) return false;
      if (
        activeLayer.locked ||
        !activeLayer.visible ||
        !redlinePointerCanDraw(event.nativeEvent, {
          allowTouch: Boolean(pendingDetail),
        })
      ) {
        return false;
      }
      const point = normalizedPointFromEvent(event);
      if (!point) return false;
      if (pendingDetail) {
        event.preventDefault();
        event.stopPropagation();
        runCommand({
          type: "place-detail",
          detailId: pendingDetail.id,
          binding,
          origin: { x: point.x, y: point.y },
          targetLayerId: activeLayer.id,
        });
        setPendingDetail(null);
        setActiveTool("select");
        return true;
      }
      if (activeTool === "erase") {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      if (activeTool === "select") {
        const active: ActiveRedlinePointer = {
          kind: "selection-box",
          pointerId: event.pointerId,
          start: { x: point.x, y: point.y },
          current: { x: point.x, y: point.y },
          additive: event.shiftKey,
        };
        activePointerRef.current = active;
        setTransient({
          kind: "selection-box",
          start: active.start,
          end: active.current,
        });
        if (!event.shiftKey) select([]);
      } else if (activeTool === "lasso") {
        const active: ActiveRedlinePointer = {
          kind: "lasso",
          pointerId: event.pointerId,
          points: [{ x: point.x, y: point.y }],
          additive: event.shiftKey,
        };
        activePointerRef.current = active;
        setTransient({ kind: "lasso", points: active.points });
      } else if (activeTool === "pen" || activeTool === "highlight") {
        const samples = normalizeCoalescedRedlineSamples(
          event.nativeEvent,
          viewportForSvg(event.currentTarget),
        );
        const active: ActiveRedlinePointer = {
          kind: "stroke",
          pointerId: event.pointerId,
          tool: activeTool,
          samples,
        };
        activePointerRef.current = active;
        const annotation = transientAnnotation(
          history.present,
          activeLayer,
          binding,
          active,
          style,
        );
        setTransient(
          annotation ? { kind: "annotation", annotation } : null,
        );
      } else {
        const kind = annotationKindForTool(activeTool);
        if (!kind || kind === "ink" || kind === "highlighter") return false;
        const active: ActiveRedlinePointer = {
          kind: "callout",
          pointerId: event.pointerId,
          tool: kind,
          start: { x: point.x, y: point.y },
          current: { x: point.x, y: point.y },
        };
        activePointerRef.current = active;
        const annotation = transientAnnotation(
          history.present,
          activeLayer,
          binding,
          active,
          style,
        );
        setTransient(
          annotation ? { kind: "annotation", annotation } : null,
        );
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return true;
    },
    [
      activeLayer,
      activeTool,
      binding,
      history,
      open,
      pendingDetail,
      runCommand,
      select,
      style,
    ],
  );

  const handleAnnotationPointerDown = useCallback(
    (
      annotationId: string,
      event: ReactPointerEvent<SVGGElement>,
    ) => {
      if (!open || !history || !activeLayer || activeLayer.locked) return false;
      if (
        !redlinePointerCanDraw(event.nativeEvent, {
          allowTouch: activeTool === "select" || activeTool === "erase",
        })
      ) {
        return false;
      }
      if (activeTool === "erase") {
        event.preventDefault();
        event.stopPropagation();
        runCommand({
          type: "delete-selection",
          annotationIds: selectionForAnnotation(
            history.present,
            annotationId,
          ),
        });
        return true;
      }
      if (activeTool !== "select") return false;
      const point = normalizedPointFromEvent(event);
      if (!point) return false;
      const clicked = selectionForAnnotation(history.present, annotationId);
      const selected = new Set(history.selection);
      let nextSelection = clicked;
      if (event.shiftKey) {
        const allSelected = clicked.every((id) => selected.has(id));
        clicked.forEach((id) =>
          allSelected ? selected.delete(id) : selected.add(id),
        );
        nextSelection = [...selected];
      } else if (clicked.some((id) => selected.has(id))) {
        nextSelection = [...history.selection];
      }
      select(nextSelection);
      const svg = event.currentTarget.ownerSVGElement;
      svg?.setPointerCapture(event.pointerId);
      activePointerRef.current = {
        kind: "move",
        pointerId: event.pointerId,
        start: { x: point.x, y: point.y },
        current: { x: point.x, y: point.y },
        annotationIds: nextSelection,
        sourceDocument: history.present,
      };
      event.preventDefault();
      event.stopPropagation();
      return true;
    },
    [activeLayer, activeTool, history, open, runCommand, select],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const active = activePointerRef.current;
      if (
        !active &&
        open &&
        pendingDetail &&
        history &&
        activeLayer &&
        binding
      ) {
        const point = normalizedPointFromEvent(event);
        if (!point) return false;
        const preview = applyRedlineCommand(history.present, {
          type: "place-detail",
          detailId: pendingDetail.id,
          binding,
          origin: { x: point.x, y: point.y },
          targetLayerId: activeLayer.id,
        });
        setPreviewDocument(
          preview.changed ? preview.document : history.present,
        );
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      if (!active || active.pointerId !== event.pointerId) return false;
      const point = normalizedPointFromEvent(event);
      if (!point || !history || !activeLayer || !binding) return false;
      if (active.kind === "stroke") {
        const remaining = Math.max(
          0,
          REDLINE_POLICY_LIMITS.maxPointsPerStroke - active.samples.length,
        );
        active.samples.push(
          ...normalizeCoalescedRedlineSamples(
            event.nativeEvent,
            viewportForSvg(event.currentTarget),
            active.samples.at(-1),
          ).slice(0, remaining),
        );
        const annotation = transientAnnotation(
          history.present,
          activeLayer,
          binding,
          active,
          style,
        );
        setTransient(
          annotation ? { kind: "annotation", annotation } : null,
        );
      } else if (active.kind === "callout") {
        active.current = { x: point.x, y: point.y };
        const annotation = transientAnnotation(
          history.present,
          activeLayer,
          binding,
          active,
          style,
        );
        setTransient(
          annotation ? { kind: "annotation", annotation } : null,
        );
      } else if (active.kind === "selection-box") {
        active.current = { x: point.x, y: point.y };
        setTransient({
          kind: "selection-box",
          start: active.start,
          end: active.current,
        });
      } else if (active.kind === "lasso") {
        const last = active.points.at(-1);
        if (
          active.points.length < REDLINE_POLICY_LIMITS.maxPointsPerStroke &&
          (
            !last ||
            Math.hypot(point.x - last.x, point.y - last.y) >= 0.002
          )
        ) {
          active.points.push({ x: point.x, y: point.y });
        }
        setTransient({ kind: "lasso", points: [...active.points] });
      } else if (active.kind === "move") {
        active.current = { x: point.x, y: point.y };
        const delta = {
          x: active.current.x - active.start.x,
          y: active.current.y - active.start.y,
        };
        const preview = applyRedlineCommand(active.sourceDocument, {
          type: "move-selection",
          annotationIds: active.annotationIds,
          delta,
        });
        setPreviewDocument(
          preview.changed ? preview.document : active.sourceDocument,
        );
      }
      event.preventDefault();
      event.stopPropagation();
      return true;
    },
    [activeLayer, binding, history, open, pendingDetail, style],
  );

  const finishPointer = useCallback(
    (
      event: ReactPointerEvent<SVGSVGElement>,
      cancelled = false,
    ) => {
      const active = activePointerRef.current;
      if (!active || active.pointerId !== event.pointerId) return false;
      event.preventDefault();
      event.stopPropagation();
      if (!cancelled) {
        const point = normalizedPointFromEvent(event);
        if (active.kind === "stroke") {
          const remaining = Math.max(
            0,
            REDLINE_POLICY_LIMITS.maxPointsPerStroke -
              active.samples.length,
          );
          active.samples.push(
            ...normalizeCoalescedRedlineSamples(
              event.nativeEvent,
              viewportForSvg(event.currentTarget),
              active.samples.at(-1),
            ).slice(0, remaining),
          );
        } else if (point && (
          active.kind === "callout" ||
          active.kind === "selection-box" ||
          active.kind === "move"
        )) {
          active.current = { x: point.x, y: point.y };
        }
      }
      activePointerRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setTransient(null);
      setPreviewDocument(null);
      if (cancelled || !history || !activeLayer || !binding) return true;

      if (active.kind === "stroke") {
        const kind = active.tool === "pen" ? "ink" : "highlighter";
        const draft = createRedlineStrokeDraft({
          kind,
          page,
          samples: active.samples,
          layerId: activeLayer.id,
          style,
        });
        if (draft) runCommand({ type: "add-annotation", draft });
      } else if (active.kind === "callout") {
        const distance = Math.hypot(
          active.current.x - active.start.x,
          active.current.y - active.start.y,
        );
        const end =
          distance >= 0.002
            ? active.current
            : {
                x: Math.min(1, active.start.x + 0.12),
                y: Math.min(1, active.start.y + 0.05),
              };
        if (active.tool === "text") {
          setPendingText({ start: active.start, end });
          setDialogState({ kind: "text", text: "" });
        } else {
          runCommand({
            type: "add-annotation",
            draft: {
              kind: active.tool,
              page,
              layerId: activeLayer.id,
              style,
              start: active.start,
              end,
            },
          });
        }
      } else if (active.kind === "selection-box") {
        const ids = rectangleSelection(
          history.present,
          binding,
          active.start,
          active.current,
        );
        select(
          active.additive
            ? [...new Set([...history.selection, ...ids])]
            : ids,
        );
      } else if (active.kind === "lasso") {
        const xs = active.points.map((point) => point.x);
        const ys = active.points.map((point) => point.y);
        const start = {
          x: Math.min(...xs),
          y: Math.min(...ys),
        };
        const end = {
          x: Math.max(...xs),
          y: Math.max(...ys),
        };
        const ids = rectangleSelection(
          history.present,
          binding,
          start,
          end,
        );
        select(
          active.additive
            ? [...new Set([...history.selection, ...ids])]
            : ids,
        );
      } else if (active.kind === "move") {
        const delta = {
          x: active.current.x - active.start.x,
          y: active.current.y - active.start.y,
        };
        if (Math.hypot(delta.x, delta.y) >= 0.0005) {
          runCommand({
            type: "move-selection",
            annotationIds: active.annotationIds,
            delta,
          });
        }
      }
      return true;
    },
    [
      activeLayer,
      binding,
      history,
      page,
      runCommand,
      select,
      style,
    ],
  );

  const handleDialogConfirm = useCallback(
    (current: RedlineStudioDialogState) => {
      if (!history || !binding) return;
      if (current.kind === "text") {
        if (current.annotationId && current.text.trim()) {
          const annotation = history.present.annotations.find(
            (candidate) =>
              candidate.id === current.annotationId &&
              candidate.kind === "text" &&
              bindingMatches(candidate, binding),
          );
          if (annotation?.kind === "text") {
            runCommand({
              type: "replace-annotation",
              annotation: {
                ...annotation,
                text: current.text.trim(),
              },
            });
          }
        } else if (pendingText && current.text.trim()) {
          runCommand({
            type: "add-annotation",
            draft: {
              kind: "text",
              page,
              layerId: activeLayer?.id,
              style,
              start: pendingText.start,
              end: pendingText.end,
              text: current.text.trim(),
            },
          });
        }
        setPendingText(null);
      } else if (current.kind === "details") {
        if (current.mode === "save") {
          runCommand({
            type: "save-detail",
            annotationIds: selection,
            name: current.name.trim(),
          });
        } else {
          const detail = history.present.myDetails.find(
            (candidate) => candidate.id === current.detailId,
          );
          if (detail) {
            setPendingDetail(detail);
            setActiveTool("select");
            message("Move over the sheet and click once to place this detail.");
          }
        }
      } else if (current.kind === "export") {
        void onExport?.(current);
      } else if (current.kind === "issue-draft") {
        const bounds = redlineSelectionBounds(
          history.present,
          selection,
        );
        if (!selection.length || !bounds) {
          message("Select redlines on the current sheet before creating a draft.");
          setDialogState(null);
          return;
        }
        onIssueDraft?.({
          kind: current.issueKind,
          title: current.title.trim(),
          note: current.note.trim(),
          annotationIds: [...selection],
          binding,
          bounds,
          redlineFingerprint: redlineDocumentFingerprint(history.present),
        });
      }
      setDialogState(null);
    },
    [
      activeLayer?.id,
      binding,
      history,
      message,
      onExport,
      onIssueDraft,
      page,
      pendingText,
      runCommand,
      selection,
      style,
    ],
  );

  const handleSelectionAction = useCallback(
    (
      action: RedlineSelectionAction,
      annotationIds: readonly string[],
    ) => {
      if (!annotationIds.length) return;
      if (action === "duplicate") {
        runCommand({
          type: "duplicate-selection",
          annotationIds: [...annotationIds],
        });
      } else if (action === "scale-down" || action === "scale-up") {
        runCommand({
          type: "scale-selection",
          annotationIds: [...annotationIds],
          factor: action === "scale-down" ? 0.8 : 1.25,
        });
      } else if (action === "edit-text") {
        const current = historyRef.current;
        const annotation = current?.present.annotations.find(
          (candidate) =>
            candidate.id === annotationIds[0] &&
            candidate.kind === "text",
        );
        if (annotation?.kind === "text") {
          setDialogState({
            kind: "text",
            text: annotation.text || "",
            annotationId: annotation.id,
          });
        }
      } else if (action === "rotate-left" || action === "rotate-right") {
        runCommand({
          type: "rotate-selection",
          annotationIds: [...annotationIds],
          degrees: action === "rotate-left" ? -15 : 15,
          pageAspectRatio,
        });
      } else if (action === "group") {
        runCommand({
          type: "group-selection",
          annotationIds: [...annotationIds],
        });
      } else if (action === "ungroup") {
        runCommand({
          type: "ungroup-selection",
          annotationIds: [...annotationIds],
        });
      } else if (
        action === "align-left" ||
        action === "align-center" ||
        action === "align-right"
      ) {
        runCommand({
          type: "align-selection",
          annotationIds: [...annotationIds],
          alignment:
            action === "align-left"
              ? "left"
              : action === "align-center"
                ? "center-x"
                : "right",
        });
      } else if (
        action === "distribute-horizontal" ||
        action === "distribute-vertical"
      ) {
        runCommand({
          type: "distribute-selection",
          annotationIds: [...annotationIds],
          direction:
            action === "distribute-horizontal" ? "horizontal" : "vertical",
        });
      } else if (action === "save-detail") {
        setDialogState({ kind: "details", mode: "save", name: "" });
      } else if (
        action === "create-rfi-draft" ||
        action === "create-punch-draft"
      ) {
        setDialogState({
          kind: "issue-draft",
          issueKind:
            action === "create-rfi-draft" ? "rfi" : "punch",
          title: "",
          note: "",
        });
      } else if (action === "delete") {
        runCommand({
          type: "delete-selection",
          annotationIds: [...annotationIds],
        });
      }
    },
    [pageAspectRatio, runCommand],
  );

  const applyStyleToSelection = useCallback(
    (nextStyle: RedlineStyle) => {
      const current = historyRef.current;
      if (!current?.selection.length) return;
      runCommand({
        type: "update-selection-style",
        annotationIds: [...current.selection],
        changes: nextStyle,
      });
    },
    [runCommand],
  );

  const undo = useCallback(() => {
    const current = historyRef.current;
    if (!current) return;
    const transition = undoRedlineHistory(current);
    historyRef.current = transition.history;
    setHistory(transition.history);
    if (transition.changed) message(transition.reason);
  }, [message]);

  const redo = useCallback(() => {
    const current = historyRef.current;
    if (!current) return;
    const transition = redoRedlineHistory(current);
    historyRef.current = transition.history;
    setHistory(transition.history);
    if (transition.changed) message(transition.reason);
  }, [message]);

  const snapshot = useMemo(
    () =>
      document
        ? createRedlineSnapshot(document, new Date().toISOString())
        : undefined,
    [document],
  );
  const fingerprint = useMemo(
    () => document ? redlineDocumentFingerprint(document) : "",
    [document],
  );

  return {
    open,
    setOpen,
    history,
    document,
    renderedDocument,
    snapshot,
    quarantinedSnapshot,
    fingerprint,
    binding,
    activeLayer,
    pageAnnotations,
    selection,
    selectionBounds,
    selectedGroup,
    activeTool,
    setTool,
    style,
    setStyle,
    stylePanelOpen,
    setStylePanelOpen,
    dialog,
    setDialog,
    transient,
    pendingDetail,
    resetPageInteraction,
    resetForSource,
    restoreSnapshot,
    runCommand,
    select,
    updateLayer,
    useFavorite,
    setDetailPreview,
    assignFavorite,
    applyStyleToSelection,
    handlePointerDown,
    handleAnnotationPointerDown,
    handlePointerMove,
    finishPointer,
    handleDialogConfirm,
    handleSelectionAction,
    undo,
    redo,
    canUndo: history ? redlineHistoryCanUndo(history) : false,
    canRedo: history ? redlineHistoryCanRedo(history) : false,
    grouped: Boolean(selectedGroup),
  };
}
