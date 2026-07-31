"use client";

import {
  useCallback,
  useEffect,
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
  type RedlineBrushTip,
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
  redlineStrokePointsFromSamples,
  type RedlinePointerSample,
} from "./redlineInput";
import type {
  FieldRedlineTool,
  RedlineStudioDialogState,
} from "./FieldRedlineStudio";
import {
  isRedlineMarkTool,
  redlineDragShapeBounds,
  redlineMarkAnnotationKind,
  redlineMarkRadius,
  redlineMarkStyle,
  redlineOutlineStyle,
  type RedlineMarkSize,
  type RedlineMarkTool,
} from "./redlineMark";
import type {
  RedlineCanvasTransient,
} from "./RedlineCanvasLayer";
import type {
  RedlineSelectionAction,
} from "./RedlineActionWheel";
import { shouldCancelStaleRedlinePointerMove } from "./pointerLifecycle";
import {
  loadRedlineEraserSize,
  normalizeRedlineEraserSize,
  redlineEraserHitIds,
  saveRedlineEraserSize,
} from "./redlineEraser";

type ActiveRedlinePointer =
  | {
      kind: "stroke";
      pointerId: number;
      tool: "pen" | "highlight" | RedlineMarkTool;
      samples: RedlinePointerSample[];
    }
  | {
      kind: "callout";
      pointerId: number;
      tool:
        | "arrow"
        | "rectangle"
        | "circle"
        | "cloud"
        | "text";
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
    }
  | {
      kind: "resize-text";
      pointerId: number;
      annotationId: string;
      originClient: RedlinePoint;
      startDistance: number;
      originalTextScale: number;
      currentTextScale: number;
      sourceDocument: RedlineDocument;
    }
  | {
      kind: "erase";
      pointerId: number;
      current: RedlinePoint;
      size: number;
      annotationIds: Set<string>;
      sourceDocument: RedlineDocument;
    };

type PendingText = {
  start: RedlinePoint;
  end: RedlinePoint;
};

type PendingRedlineCopy = {
  annotationIds: string[];
  bounds: NonNullable<ReturnType<typeof redlineSelectionBounds>>;
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
  if (isRedlineMarkTool(tool)) return redlineMarkAnnotationKind(tool);
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

function isRedlineDragShapeTool(
  tool: FieldRedlineTool,
): tool is "rectangle" | "circle" {
  return tool === "rectangle" || tool === "circle";
}

function redlineDragShapeStyle(style: RedlineStyle): RedlineStyle {
  return style.fillColor ? redlineMarkStyle(style) : style;
}

function redlineBrushTipForTool(tool: RedlineMarkTool): RedlineBrushTip {
  return tool === "round-mark" ? "circle" : "square";
}

function redlineStrokeToolStyle(
  tool: "pen" | "highlight" | RedlineMarkTool,
  style: RedlineStyle,
  markSize: RedlineMarkSize,
) {
  if (!isRedlineMarkTool(tool)) return style;
  return {
    ...redlineOutlineStyle(style),
    strokeWidth: redlineMarkRadius(markSize) * 2,
  };
}

function favoriteTool(favorite: RedlineFavorite): FieldRedlineTool {
  if (favorite.kind === "ink") return "pen";
  if (favorite.kind === "highlighter") return "highlight";
  if (favorite.kind === "circle") return "round-mark";
  if (favorite.kind === "rectangle") return "square-mark";
  return favorite.kind;
}

function textScaleFromResizePointer(
  active: Extract<ActiveRedlinePointer, { kind: "resize-text" }>,
  clientX: number,
  clientY: number,
) {
  const distance = Math.hypot(
    clientX - active.originClient.x,
    clientY - active.originClient.y,
  );
  const factor = distance / Math.max(1, active.startDistance);
  return Math.max(
    0.5,
    Math.min(4, active.originalTextScale * factor),
  );
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

function addEraserAnnotationIds(
  document: RedlineDocument,
  target: Set<string>,
  annotationIds: readonly string[],
  binding: RedlinePageBinding,
  layerId: string,
) {
  const scopedIds = new Set(
    document.annotations
      .filter((annotation) =>
        annotation.layerId === layerId &&
        bindingMatches(annotation, binding))
      .map((annotation) => annotation.id),
  );
  annotationIds.forEach((annotationId) => {
    selectionForAnnotation(document, annotationId).forEach((candidateId) => {
      if (scopedIds.has(candidateId)) target.add(candidateId);
    });
  });
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
  pageAspectRatio: number,
  markSize: RedlineMarkSize,
): RedlineAnnotation | null {
  if (active.kind === "stroke") {
    const kind = active.tool === "highlight" ? "highlighter" : "ink";
    if (!active.samples.length) return null;
    const brushTip = isRedlineMarkTool(active.tool)
      ? redlineBrushTipForTool(active.tool)
      : undefined;
    const points = brushTip
      ? redlineStrokePointsFromSamples(active.samples)
      : active.samples.map(({ x, y, pressure, t }) => ({
        x,
        y,
        pressure,
        t,
      }));
    return {
      id: "redline-transient",
      kind,
      layerId: layer.id,
      binding,
      style: normalizeRedlineStyle(
        kind,
        redlineStrokeToolStyle(active.tool, style, markSize),
      ),
      ...(brushTip ? { brushTip } : {}),
      points,
    };
  }
  const annotationKind = annotationKindForTool(active.tool);
  if (!annotationKind || annotationKind === "ink" || annotationKind === "highlighter") {
    return null;
  }
  const dragShapeBounds = isRedlineDragShapeTool(active.tool)
    ? redlineDragShapeBounds({
      start: active.start,
      pointer: active.current,
      pageAspectRatio,
    })
    : null;
  const annotationStyle = isRedlineDragShapeTool(active.tool)
      ? redlineDragShapeStyle(style)
      : style;
  if (isRedlineDragShapeTool(active.tool) && !dragShapeBounds) return null;
  return {
    id: "redline-transient",
    kind: annotationKind,
    layerId: layer.id,
    binding,
    style: normalizeRedlineStyle(
      annotationKind,
      annotationStyle,
    ),
    start: dragShapeBounds?.start || active.start,
    end: dragShapeBounds?.end || active.current,
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
  const [markSize, setMarkSizeState] = useState<RedlineMarkSize>(0.01);
  const [eraserSize, setEraserSizeState] = useState(loadRedlineEraserSize);
  const [dialog, setDialogState] =
    useState<RedlineStudioDialogState | null>(null);
  const [transient, setTransient] =
    useState<RedlineCanvasTransient | null>(null);
  const [previewDocument, setPreviewDocument] =
    useState<RedlineDocument | null>(null);
  const [pendingDetail, setPendingDetail] =
    useState<RedlineMyDetail | null>(null);
  const [pendingCopy, setPendingCopy] =
    useState<PendingRedlineCopy | null>(null);
  const [pendingText, setPendingText] = useState<PendingText | null>(null);
  const activePointerRef = useRef<ActiveRedlinePointer | null>(null);
  const capturedPointerRef = useRef<{
    pointerId: number;
    target: SVGSVGElement;
  } | null>(null);
  const windowPointerReleaseRef = useRef<{
    pointerUp: (event: globalThis.PointerEvent) => void;
    pointerCancel: (event: globalThis.PointerEvent) => void;
  } | null>(null);
  const transientFrameRef = useRef<number | null>(null);
  const queuedTransientRef =
    useRef<(() => RedlineCanvasTransient | null) | null>(null);

  const clearScheduledTransient = useCallback(() => {
    if (transientFrameRef.current !== null) {
      window.cancelAnimationFrame(transientFrameRef.current);
      transientFrameRef.current = null;
    }
    queuedTransientRef.current = null;
  }, []);

  const detachWindowPointerRelease = useCallback(() => {
    const listeners = windowPointerReleaseRef.current;
    if (!listeners) return;
    window.removeEventListener("pointerup", listeners.pointerUp);
    window.removeEventListener("pointercancel", listeners.pointerCancel);
    windowPointerReleaseRef.current = null;
  }, []);

  const releaseCapturedPointer = useCallback((pointerId?: number) => {
    const captured = capturedPointerRef.current;
    if (!captured || (
      pointerId !== undefined &&
      captured.pointerId !== pointerId
    )) {
      return;
    }
    capturedPointerRef.current = null;
    try {
      if (captured.target.hasPointerCapture(captured.pointerId)) {
        captured.target.releasePointerCapture(captured.pointerId);
      }
    } catch {
      // Capture may already have been released by the browser.
    }
  }, []);

  const cancelActivePointerInteraction = useCallback(() => {
    activePointerRef.current = null;
    detachWindowPointerRelease();
    releaseCapturedPointer();
    clearScheduledTransient();
    setTransient(null);
    setPreviewDocument(null);
  }, [
    clearScheduledTransient,
    detachWindowPointerRelease,
    releaseCapturedPointer,
  ]);

  const captureActivePointer = useCallback((
    target: SVGSVGElement,
    pointerId: number,
  ) => {
    detachWindowPointerRelease();
    try {
      target.setPointerCapture(pointerId);
      capturedPointerRef.current = { target, pointerId };
    } catch {
      capturedPointerRef.current = null;
    }
    const cancelIfMatching = (event: globalThis.PointerEvent) => {
      if (event.pointerId === pointerId) cancelActivePointerInteraction();
    };
    const pointerUp = (event: globalThis.PointerEvent) => cancelIfMatching(event);
    const pointerCancel = (event: globalThis.PointerEvent) =>
      cancelIfMatching(event);
    windowPointerReleaseRef.current = { pointerUp, pointerCancel };
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerCancel);
  }, [cancelActivePointerInteraction, detachWindowPointerRelease]);

  const scheduleTransient = useCallback(
    (factory: () => RedlineCanvasTransient | null) => {
      queuedTransientRef.current = factory;
      if (transientFrameRef.current !== null) return;
      transientFrameRef.current = window.requestAnimationFrame(() => {
        transientFrameRef.current = null;
        const queuedFactory = queuedTransientRef.current;
        queuedTransientRef.current = null;
        setTransient(queuedFactory?.() ?? null);
      });
    },
    [],
  );

  useEffect(
    () => () => cancelActivePointerInteraction(),
    [cancelActivePointerInteraction],
  );

  useEffect(() => {
    saveRedlineEraserSize(eraserSize);
  }, [eraserSize]);

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
      clearScheduledTransient();
      setTransient(null);
      setPendingDetail(null);
      setPendingCopy(null);
      setPendingText(null);
      setDialogState(null);
      setActiveTool("select");
      cancelActivePointerInteraction();
    },
    [cancelActivePointerInteraction, clearScheduledTransient],
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
        clearScheduledTransient();
        setTransient(null);
        setPendingDetail(null);
        setPendingCopy(null);
        setPendingText(null);
        setDialogState(null);
        setActiveTool("select");
        cancelActivePointerInteraction();
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
      clearScheduledTransient();
      setTransient(null);
      setPendingDetail(null);
      setPendingCopy(null);
      setPendingText(null);
      setDialogState(null);
      setActiveTool("select");
      cancelActivePointerInteraction();
      if (parsed.sanitized) {
        message("Field redlines were restored with unsafe values removed.");
      }
      return "restored";
    },
    [
      cancelActivePointerInteraction,
      clearScheduledTransient,
      message,
      resetForSource,
    ],
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
      clearScheduledTransient();
      setTransient(null);
    },
    [clearScheduledTransient, message],
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

  const setEraserSize = useCallback((value: number) => {
    setEraserSizeState(normalizeRedlineEraserSize(value));
  }, []);

  const setMarkSize = useCallback((value: RedlineMarkSize) => {
    setMarkSizeState(redlineMarkRadius(value));
  }, []);

  const refreshEraserPreview = useCallback(
    (active: Extract<ActiveRedlinePointer, { kind: "erase" }>) => {
      setTransient({
        kind: "eraser",
        point: active.current,
        size: active.size,
      });
      if (!active.annotationIds.size) {
        setPreviewDocument(null);
        return;
      }
      const preview = applyRedlineCommand(active.sourceDocument, {
        type: "delete-selection",
        annotationIds: [...active.annotationIds],
      });
      setPreviewDocument(
        preview.changed ? preview.document : active.sourceDocument,
      );
    },
    [],
  );

  const collectEraserHits = useCallback(
    (
      active: Extract<ActiveRedlinePointer, { kind: "erase" }>,
      from: RedlinePoint,
      to: RedlinePoint,
      refresh = true,
    ) => {
      if (!binding || !activeLayer) return;
      const hitIds = redlineEraserHitIds({
        annotations: active.sourceDocument.annotations,
        binding,
        layerId: activeLayer.id,
        from,
        to,
        size: active.size,
        pageAspectRatio,
      });
      addEraserAnnotationIds(
        active.sourceDocument,
        active.annotationIds,
        hitIds,
        binding,
        activeLayer.id,
      );
      active.current = { x: to.x, y: to.y };
      if (refresh) refreshEraserPreview(active);
    },
    [activeLayer, binding, pageAspectRatio, refreshEraserPreview],
  );

  const beginEraserGesture = useCallback(
    (
      pointerId: number,
      point: RedlinePoint,
      svg: SVGSVGElement,
      sourceDocument: RedlineDocument,
    ) => {
      if (!binding || !activeLayer) return false;
      const active: Extract<ActiveRedlinePointer, { kind: "erase" }> = {
        kind: "erase",
        pointerId,
        current: { x: point.x, y: point.y },
        size: normalizeRedlineEraserSize(eraserSize),
        annotationIds: new Set<string>(),
        sourceDocument,
      };
      activePointerRef.current = active;
      collectEraserHits(active, point, point);
      captureActivePointer(svg, pointerId);
      return true;
    },
    [
      activeLayer,
      binding,
      captureActivePointer,
      collectEraserHits,
      eraserSize,
    ],
  );

  const resetPageInteraction = useCallback(() => {
    cancelActivePointerInteraction();
    setPendingDetail(null);
    setPendingCopy(null);
    const current = historyRef.current;
    if (!current || !current.selection.length) return;
    const nextHistory = replaceRedlineHistorySelection(current, []);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, [cancelActivePointerInteraction]);

  const setDialog = useCallback(
    (next: RedlineStudioDialogState | null) => {
      if (!next) {
        setPendingText(null);
      }
      if (next) setPendingCopy(null);
      setDialogState(next);
    },
    [],
  );

  const setTool = useCallback((tool: FieldRedlineTool) => {
    cancelActivePointerInteraction();
    setActiveTool(tool);
    if (tool !== "select") select([]);
    const kind = annotationKindForTool(tool);
    if (kind) {
      setStyle((current) =>
        normalizeRedlineStyle(
          isRedlineMarkTool(tool) ? "ink" : kind,
          isRedlineMarkTool(tool)
            ? redlineOutlineStyle(current)
            : isRedlineDragShapeTool(tool)
              ? redlineDragShapeStyle(current)
              : redlineOutlineStyle(current),
        ));
    }
    setPendingDetail(null);
    setPendingCopy(null);
    if (tool === "pen") {
      message("Draw freehand · press, drag, and release for one smooth stroke");
    } else if (tool === "highlight") {
      message("Highlight anywhere on the PDF - press, drag, and release");
    } else if (tool === "erase") {
      setStylePanelOpen(true);
      message("Drag across redlines to erase - one drag is one Undo");
    } else if (isRedlineMarkTool(tool)) {
      message(
        `Drag to draw with a ${
          tool === "round-mark" ? "circle" : "square"
        } pen tip - one drag is one Undo`,
      );
    } else if (isRedlineDragShapeTool(tool)) {
      message("Press, drag, and release - the opposite corner stays under your pen");
    }
  }, [cancelActivePointerInteraction, message, select]);

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
      if (layer.locked || !layer.visible || layer.opacity <= 0) {
        cancelActivePointerInteraction();
        setActiveTool("select");
      }
      if (layer.locked || !layer.visible || layer.opacity <= 0) {
        setPendingCopy(null);
      }
    },
    [cancelActivePointerInteraction, runCommand],
  );

  const useFavorite = useCallback((favorite: RedlineFavorite) => {
    const tool = favoriteTool(favorite);
    setTool(tool);
    if (isRedlineMarkTool(tool)) {
      const radius = redlineMarkRadius(favorite.style.strokeWidth / 2);
      setMarkSizeState(radius);
      setStyle((current) =>
        normalizeRedlineStyle("ink", {
          ...redlineOutlineStyle(favorite.style),
          strokeWidth: current.strokeWidth,
        }),
      );
    } else {
      setStyle(favorite.style);
    }
  }, [setTool]);

  const setDetailPreview = useCallback(
    (detail: RedlineMyDetail | null) => {
      cancelActivePointerInteraction();
      setPendingDetail(detail);
      setPreviewDocument(null);
      if (detail) {
        setActiveTool("select");
      }
    },
    [cancelActivePointerInteraction],
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
          label: `${
            tool === "highlight"
              ? "Highlight"
              : tool === "round-mark"
                ? "Round mark"
                : tool === "square-mark"
                  ? "Square mark"
                  : tool[0].toUpperCase() + tool.slice(1)
          } ${slotIndex + 1}`,
          kind,
          style: normalizeRedlineStyle(
            kind,
            isRedlineMarkTool(tool)
              ? redlineStrokeToolStyle(tool, favoriteStyle, markSize)
              : favoriteStyle,
          ),
        },
      });
    },
    [markSize, runCommand],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!open || !history || !activeLayer || !binding) return false;
      if (
        activeLayer.locked ||
        !activeLayer.visible ||
        activeLayer.opacity <= 0 ||
        !redlinePointerCanDraw(event.nativeEvent, {
          allowTouch: true,
        })
      ) {
        return false;
      }
      const point = normalizedPointFromEvent(event);
      if (!point) return false;
      if (pendingCopy) {
        const center = {
          x: (pendingCopy.bounds.left + pendingCopy.bounds.right) / 2,
          y: (pendingCopy.bounds.top + pendingCopy.bounds.bottom) / 2,
        };
        event.preventDefault();
        event.stopPropagation();
        runCommand({
          type: "duplicate-selection",
          annotationIds: pendingCopy.annotationIds,
          offset: {
            x: point.x - center.x,
            y: point.y - center.y,
          },
        });
        message("Redline copy placed · move and click again · Esc or Done finishes");
        return true;
      }
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
        if (
          !beginEraserGesture(
            event.pointerId,
            point,
            event.currentTarget,
            history.present,
          )
        ) {
          return false;
        }
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
      } else if (
        activeTool === "pen" ||
        activeTool === "highlight" ||
        isRedlineMarkTool(activeTool)
      ) {
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
          pageAspectRatio,
          markSize,
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
          pageAspectRatio,
          markSize,
        );
        setTransient(
          annotation ? { kind: "annotation", annotation } : null,
        );
      }
      captureActivePointer(event.currentTarget, event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return true;
    },
    [
      activeLayer,
      activeTool,
      beginEraserGesture,
      binding,
      history,
      open,
      pendingDetail,
      pendingCopy,
      pageAspectRatio,
      markSize,
      message,
      captureActivePointer,
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
      if (
        !open ||
        !history ||
        !activeLayer ||
        activeLayer.locked ||
        !activeLayer.visible ||
        activeLayer.opacity <= 0
      ) {
        return false;
      }
      if (pendingCopy) return false;
      if (
        !redlinePointerCanDraw(event.nativeEvent, {
          allowTouch: activeTool === "select" || activeTool === "erase",
        })
      ) {
        return false;
      }
      if (activeTool === "erase") {
        const point = normalizedPointFromEvent(event);
        const svg = event.currentTarget.ownerSVGElement;
        if (
          !point ||
          !svg ||
          !beginEraserGesture(
            event.pointerId,
            point,
            svg,
            history.present,
          )
        ) {
          return false;
        }
        event.preventDefault();
        event.stopPropagation();
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
      if (svg) captureActivePointer(svg, event.pointerId);
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
    [
      activeLayer,
      activeTool,
      beginEraserGesture,
      captureActivePointer,
      history,
      open,
      pendingCopy,
      select,
    ],
  );

  const handleTextResizePointerDown = useCallback(
    (
      annotationId: string,
      resizeOrigin: RedlinePoint,
      event: ReactPointerEvent<SVGCircleElement>,
    ) => {
      if (
        !open ||
        !history ||
        !activeLayer ||
        activeLayer.locked ||
        activeTool !== "select" ||
        pendingCopy
      ) {
        return false;
      }
      if (
        !redlinePointerCanDraw(event.nativeEvent, {
          allowTouch: true,
        })
      ) {
        return false;
      }
      const annotation = history.present.annotations.find(
        (candidate) =>
          candidate.id === annotationId &&
          candidate.kind === "text" &&
          (!binding || bindingMatches(candidate, binding)),
      );
      const svg = event.currentTarget.ownerSVGElement;
      if (annotation?.kind !== "text" || !svg) return false;
      const viewport = svg.getBoundingClientRect();
      const originClient = {
        x: viewport.left + resizeOrigin.x * viewport.width,
        y: viewport.top + resizeOrigin.y * viewport.height,
      };
      const startDistance = Math.max(
        1,
        Math.hypot(
          event.clientX - originClient.x,
          event.clientY - originClient.y,
        ),
      );
      select([annotation.id]);
      captureActivePointer(svg, event.pointerId);
      activePointerRef.current = {
        kind: "resize-text",
        pointerId: event.pointerId,
        annotationId: annotation.id,
        originClient,
        startDistance,
        originalTextScale: annotation.style.textScale ?? 1,
        currentTextScale: annotation.style.textScale ?? 1,
        sourceDocument: history.present,
      };
      setPreviewDocument(null);
      event.preventDefault();
      event.stopPropagation();
      message("Drag to resize this text - its location stays fixed");
      return true;
    },
    [
      activeLayer,
      activeTool,
      binding,
      captureActivePointer,
      history,
      message,
      open,
      pendingCopy,
      select,
    ],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const active = activePointerRef.current;
      if (
        !active &&
        open &&
        pendingCopy &&
        history
      ) {
        const point = normalizedPointFromEvent(event);
        if (!point) return false;
        const center = {
          x: (pendingCopy.bounds.left + pendingCopy.bounds.right) / 2,
          y: (pendingCopy.bounds.top + pendingCopy.bounds.bottom) / 2,
        };
        const preview = applyRedlineCommand(history.present, {
          type: "duplicate-selection",
          annotationIds: pendingCopy.annotationIds,
          offset: {
            x: point.x - center.x,
            y: point.y - center.y,
          },
        });
        const previewIds = new Set(preview.selection);
        setTransient({
          kind: "annotations",
          annotations: preview.document.annotations.filter((annotation) =>
            previewIds.has(annotation.id)),
        });
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
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
      if (shouldCancelStaleRedlinePointerMove({
        activePointerId: active.pointerId,
        eventPointerId: event.pointerId,
        pointerType: event.pointerType,
        buttons: event.buttons,
        pressure: event.pressure,
      })) {
        event.preventDefault();
        event.stopPropagation();
        cancelActivePointerInteraction();
        return true;
      }
      if (!history || !activeLayer || !binding) return false;
      if (active.kind === "resize-text") {
        active.currentTextScale = textScaleFromResizePointer(
          active,
          event.clientX,
          event.clientY,
        );
        const preview = applyRedlineCommand(active.sourceDocument, {
          type: "update-selection-style",
          annotationIds: [active.annotationId],
          changes: { textScale: active.currentTextScale },
        });
        setPreviewDocument(
          preview.changed ? preview.document : active.sourceDocument,
        );
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      const point = normalizedPointFromEvent(event);
      if (!point) return false;
      if (active.kind === "erase") {
        const samples = normalizeCoalescedRedlineSamples(
          event.nativeEvent,
          viewportForSvg(event.currentTarget),
        );
        const points = samples.length ? samples : [point];
        let previous = active.current;
        points.forEach((sample, index) => {
          collectEraserHits(
            active,
            previous,
            sample,
            index === points.length - 1,
          );
          previous = sample;
        });
      } else if (active.kind === "stroke") {
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
        scheduleTransient(() => {
          const annotation = transientAnnotation(
            history.present,
            activeLayer,
            binding,
            active,
            style,
            pageAspectRatio,
            markSize,
          );
          return annotation ? { kind: "annotation", annotation } : null;
        });
      } else if (active.kind === "callout") {
        active.current = { x: point.x, y: point.y };
        const annotation = transientAnnotation(
          history.present,
          activeLayer,
          binding,
          active,
          style,
          pageAspectRatio,
          markSize,
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
    [
      activeLayer,
      binding,
      cancelActivePointerInteraction,
      collectEraserHits,
      history,
      markSize,
      open,
      pageAspectRatio,
      pendingDetail,
      pendingCopy,
      style,
      scheduleTransient,
    ],
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
        if (active.kind === "resize-text") {
          active.currentTextScale = textScaleFromResizePointer(
            active,
            event.clientX,
            event.clientY,
          );
        } else {
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
          } else if (point && active.kind === "erase") {
            const samples = normalizeCoalescedRedlineSamples(
              event.nativeEvent,
              viewportForSvg(event.currentTarget),
            );
            const points = samples.length ? samples : [point];
            let previous = active.current;
            points.forEach((sample, index) => {
              collectEraserHits(
                active,
                previous,
                sample,
                index === points.length - 1,
              );
              previous = sample;
            });
          } else if (point && (
            active.kind === "callout" ||
            active.kind === "selection-box" ||
            active.kind === "move"
          )) {
            active.current = { x: point.x, y: point.y };
          }
        }
      }
      cancelActivePointerInteraction();
      if (cancelled || !history || !activeLayer || !binding) return true;

      if (active.kind === "erase") {
        const annotationIds = [...active.annotationIds];
        if (annotationIds.length) {
          runCommand({
            type: "delete-selection",
            annotationIds,
          });
          select([]);
          message(
            `${annotationIds.length} redline${
              annotationIds.length === 1 ? "" : "s"
            } erased - Undo restores this drag`,
          );
        } else {
          message("No redlines touched - increase Eraser size if needed");
        }
      } else if (active.kind === "stroke") {
        const kind = active.tool === "highlight" ? "highlighter" : "ink";
        const brushTip = isRedlineMarkTool(active.tool)
          ? redlineBrushTipForTool(active.tool)
          : undefined;
        const draft = createRedlineStrokeDraft({
          kind,
          page,
          samples: active.samples,
          layerId: activeLayer.id,
          style: redlineStrokeToolStyle(active.tool, style, markSize),
          ...(brushTip ? { brushTip } : {}),
        });
        if (draft) {
          runCommand({ type: "add-annotation", draft });
          select([]);
        }
      } else if (active.kind === "callout") {
        const annotationKind = annotationKindForTool(active.tool);
        if (!annotationKind || annotationKind === "ink" || annotationKind === "highlighter") {
          return true;
        }
        if (isRedlineDragShapeTool(active.tool)) {
          const bounds = redlineDragShapeBounds({
            start: active.start,
            pointer: active.current,
            pageAspectRatio,
          });
          if (!bounds) {
            message("Keep the pen down and drag to draw the shape");
            return true;
          }
          runCommand({
            type: "add-annotation",
            draft: {
              kind: annotationKind,
              page,
              layerId: activeLayer.id,
              style: redlineDragShapeStyle(style),
              start: bounds.start,
              end: bounds.end,
            },
          });
          return true;
        }
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
              kind: annotationKind,
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
      } else if (active.kind === "resize-text") {
        if (
          Math.abs(
            active.currentTextScale - active.originalTextScale,
          ) >= 0.005
        ) {
          runCommand({
            type: "update-selection-style",
            annotationIds: [active.annotationId],
            changes: { textScale: active.currentTextScale },
          });
        }
      }
      return true;
    },
    [
      activeLayer,
      binding,
      collectEraserHits,
      history,
      markSize,
      message,
      page,
      pageAspectRatio,
      runCommand,
      select,
      style,
      cancelActivePointerInteraction,
    ],
  );

  const handleDialogConfirm = useCallback(
    (current: RedlineStudioDialogState) => {
      if (!history || !binding) return;
      if (current.kind === "text") {
        let textSaved = false;
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
            textSaved = true;
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
          textSaved = true;
        }
        setPendingText(null);
        if (textSaved) {
          setActiveTool("select");
          message("Text selected - drag it to move, or drag the corner to resize");
        }
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
        const current = historyRef.current;
        const bounds = current
          ? redlineSelectionBounds(current.present, annotationIds)
          : null;
        if (!bounds) {
          message("Select redlines from one PDF sheet before using Copy & place");
          return;
        }
        setPendingCopy({
          annotationIds: [...annotationIds],
          bounds,
        });
        setActiveTool("select");
        clearScheduledTransient();
        setTransient(null);
        setPreviewDocument(null);
        message("Redline copy follows your mouse · click to place it again · Esc or Done finishes");
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
    [clearScheduledTransient, message, pageAspectRatio, runCommand],
  );

  const cancelCopyPlacement = useCallback(() => {
    setPendingCopy(null);
    clearScheduledTransient();
    setTransient(null);
    setPreviewDocument(null);
    message("Redline Copy & place finished");
  }, [clearScheduledTransient, message]);

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
    markSize,
    setMarkSize,
    eraserSize,
    setEraserSize,
    stylePanelOpen,
    setStylePanelOpen,
    dialog,
    setDialog,
    transient,
    pendingDetail,
    pendingCopy,
    cancelCopyPlacement,
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
    handleTextResizePointerDown,
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
