"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type {
  RedlineAnnotation,
  RedlineBounds,
  RedlineCalloutAnnotation,
  RedlineLayer,
  RedlinePageBinding,
  RedlinePoint,
  RedlineStrokeAnnotation,
} from "./redlineDomain";
import {
  redlineAnnotationVisualBounds,
  redlineCanvasArrowHeadPoints,
  redlineCanvasArrowHeadSize,
  redlineCanvasCalloutBounds,
  redlineCanvasPageSize,
  redlineCanvasPoint,
  redlineCanvasStrokeWidth,
  redlineSelectionVisualBounds,
  redlineTextLayout,
  type RedlineCanvasBounds,
  type RedlineCanvasPageSize,
} from "./redlineVisualBounds";
import { smoothRedlineStrokePath } from "./redlineStrokePath";

export type RedlineCanvasTransient =
  | { kind: "annotation"; annotation: RedlineAnnotation }
  | { kind: "annotations"; annotations: readonly RedlineAnnotation[] }
  | { kind: "lasso"; points: readonly RedlinePoint[] }
  | { kind: "selection-box"; start: RedlinePoint; end: RedlinePoint }
  | { kind: "eraser"; point: RedlinePoint; size: number };

export type RedlineCanvasSelection = {
  annotationIds: readonly string[];
  bounds?: RedlineBounds;
};

export type RedlineCanvasLayerProps = {
  binding: RedlinePageBinding;
  width: number;
  height: number;
  zoom?: number;
  interactive?: boolean;
  layer: RedlineLayer;
  annotations: readonly RedlineAnnotation[];
  selection?: RedlineCanvasSelection;
  transient?: RedlineCanvasTransient | null;
  onAnnotationPointerDown?: (
    annotationId: string,
    event: ReactPointerEvent<SVGGElement>,
  ) => void;
  onTextResizePointerDown?: (
    annotationId: string,
    resizeOrigin: RedlinePoint,
    event: ReactPointerEvent<SVGCircleElement>,
  ) => void;
  onAnnotationFocus?: (annotationId: string) => void;
  onAnnotationActivate?: (annotationId: string) => void;
};

const SELECTION_PADDING_PX = 6;
const SELECTION_HANDLE_RADIUS_PX = 4;
const EMPTY_SELECTION: RedlineCanvasSelection = { annotationIds: [] };

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function domainBoundsToPageBounds(
  bounds: RedlineBounds,
  size: RedlineCanvasPageSize,
): RedlineCanvasBounds {
  const start = redlineCanvasPoint({ x: bounds.left, y: bounds.top }, size);
  const end = redlineCanvasPoint(
    {
      x: bounds.right,
      y: bounds.bottom,
    },
    size,
  );
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function pointsPath(
  points: readonly RedlinePoint[],
  size: RedlineCanvasPageSize,
) {
  return smoothRedlineStrokePath(
    points.map((point) => redlineCanvasPoint(point, size)),
  );
}

function annotationLabel(annotation: RedlineAnnotation) {
  if (annotation.kind === "ink") return "Pen redline";
  if (annotation.kind === "highlighter") return "Highlighted redline";
  if (annotation.kind === "arrow") return "Arrow redline";
  if (annotation.kind === "rectangle") {
    return annotation.style.fillColor
      ? "Square mark redline"
      : "Rectangle redline";
  }
  if (annotation.kind === "circle") {
    return annotation.style.fillColor ? "Round mark redline" : "Circle redline";
  }
  if (annotation.kind === "cloud") return "Revision cloud redline";
  if (annotation.kind === "text") {
    return annotation.text?.trim()
      ? `Text redline: ${annotation.text.trim()}`
      : "Text redline";
  }
  return "Field redline";
}

function isStrokeAnnotation(
  annotation: RedlineAnnotation,
): annotation is RedlineStrokeAnnotation {
  return annotation.kind === "ink" || annotation.kind === "highlighter";
}

function annotationHitBounds(
  annotation: RedlineAnnotation,
  size: RedlineCanvasPageSize,
  zoom: number,
): RedlineCanvasBounds {
  const bounds = redlineAnnotationVisualBounds(
    annotation,
    size.width,
    size.height,
    zoom,
  );
  const minimum = 44 / Math.max(0.1, finite(zoom, 1));
  const width = Math.max(minimum, bounds.width);
  const height = Math.max(minimum, bounds.height);
  return {
    x: bounds.x - (width - bounds.width) / 2,
    y: bounds.y - (height - bounds.height) / 2,
    width,
    height,
  };
}

function renderStroke(
  annotation: RedlineStrokeAnnotation,
  size: RedlineCanvasPageSize,
) {
  const strokeWidth = redlineCanvasStrokeWidth(annotation, size);
  return (
    <path
      d={pointsPath(annotation.points, size)}
      fill="none"
      stroke={annotation.style.color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={finite(annotation.style.opacity, 1)}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function renderCallout(
  annotation: RedlineCalloutAnnotation,
  size: RedlineCanvasPageSize,
): ReactNode {
  const start = redlineCanvasPoint(annotation.start, size);
  const end = redlineCanvasPoint(annotation.end, size);
  const bounds = redlineCanvasCalloutBounds(annotation.start, annotation.end, size);
  const strokeWidth = redlineCanvasStrokeWidth(annotation, size);
  const common = {
    fill: annotation.style.fillColor || "none",
    stroke: annotation.style.color,
    strokeWidth,
    opacity: finite(annotation.style.opacity, 1),
    vectorEffect: "non-scaling-stroke" as const,
  };

  if (annotation.kind === "arrow") {
    return (
      <>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          {...common}
        />
        <polygon
          points={redlineCanvasArrowHeadPoints(
            start,
            end,
            redlineCanvasArrowHeadSize(annotation, size),
          ).map((point) => `${point.x},${point.y}`).join(" ")}
          fill={annotation.style.color}
          stroke="none"
          opacity={finite(annotation.style.opacity, 1)}
        />
      </>
    );
  }

  if (annotation.kind === "rectangle") {
    return (
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        {...common}
      />
    );
  }

  if (annotation.kind === "circle") {
    return (
      <ellipse
        cx={bounds.x + bounds.width / 2}
        cy={bounds.y + bounds.height / 2}
        rx={bounds.width / 2}
        ry={bounds.height / 2}
        {...common}
      />
    );
  }

  if (annotation.kind === "cloud") {
    const cloudUnit = Math.max(5, Math.min(bounds.width, bounds.height) / 9);
    return (
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        rx={cloudUnit}
        strokeLinecap="round"
        strokeDasharray={`${Math.max(1, strokeWidth)} ${cloudUnit}`}
        {...common}
      />
    );
  }

  const { fontSize, lines } = redlineTextLayout(annotation, size);
  return (
    <text
      x={bounds.x}
      y={bounds.y + fontSize}
      fill={annotation.style.color}
      stroke="none"
      fontSize={fontSize}
      fontWeight={600}
      opacity={finite(annotation.style.opacity, 1)}
    >
      {lines.map((line, index) => (
        <tspan
          key={`${index}-${line}`}
          x={bounds.x}
          dy={index === 0 ? 0 : fontSize * 1.25}
        >
          {line || " "}
        </tspan>
      ))}
    </text>
  );
}

function renderAnnotationShape(
  annotation: RedlineAnnotation,
  size: RedlineCanvasPageSize,
) {
  return isStrokeAnnotation(annotation)
    ? renderStroke(annotation, size)
    : renderCallout(annotation, size);
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

function SelectionOutline({
  bounds,
  zoom,
  onResizePointerDown,
}: {
  bounds: RedlineCanvasBounds;
  zoom: number;
  onResizePointerDown?: (event: ReactPointerEvent<SVGCircleElement>) => void;
}) {
  const safeZoom = Math.max(0.01, finite(zoom, 1));
  const selectionPadding = SELECTION_PADDING_PX / safeZoom;
  const handleRadius = SELECTION_HANDLE_RADIUS_PX / safeZoom;
  const x = bounds.x - selectionPadding;
  const y = bounds.y - selectionPadding;
  const width = Math.max(1, bounds.width + selectionPadding * 2);
  const height = Math.max(1, bounds.height + selectionPadding * 2);
  const corners = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
  const resizeHitRadius = Math.max(handleRadius, 22 / safeZoom);

  return (
    <g
      className="redline-selection-outline"
      pointerEvents={onResizePointerDown ? "all" : "none"}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={3}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {corners.map(([cornerX, cornerY], index) => (
        <circle
          key={index}
          className={index === 2 ? "redline-selection-resize-handle" : undefined}
          cx={cornerX}
          cy={cornerY}
          r={handleRadius}
          fill="currentColor"
          stroke="white"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ))}
      {onResizePointerDown ? (
        <circle
          className="redline-selection-resize-hit"
          data-plan-edit-control="redline"
          cx={x + width}
          cy={y + height}
          r={resizeHitRadius}
          fill="transparent"
          stroke="none"
          pointerEvents="all"
          onPointerDown={onResizePointerDown}
        />
      ) : null}
    </g>
  );
}

export default function RedlineCanvasLayer({
  binding,
  width,
  height,
  zoom = 1,
  interactive = false,
  layer,
  annotations,
  selection = EMPTY_SELECTION,
  transient = null,
  onAnnotationPointerDown,
  onTextResizePointerDown,
  onAnnotationFocus,
  onAnnotationActivate,
}: RedlineCanvasLayerProps) {
  if (!layer.visible) return null;

  const size = redlineCanvasPageSize(width, height);
  const layerOpacity = Math.max(0, Math.min(1, finite(layer.opacity, 1)));
  const pageAnnotations = annotations.filter(
    (annotation) =>
      annotation.layerId === layer.id && bindingMatches(annotation, binding),
  );
  const selectedIds = new Set(selection.annotationIds);
  const selectedAnnotations = pageAnnotations.filter((annotation) =>
    selectedIds.has(annotation.id),
  );
  const selectedBounds =
    redlineSelectionVisualBounds(selectedAnnotations, width, height, zoom) ||
    (
      selection.bounds
        ? domainBoundsToPageBounds(selection.bounds, size)
        : undefined
    );
  const selectedText =
    selectedAnnotations.length === 1 &&
    selectedAnnotations[0]?.kind === "text"
      ? selectedAnnotations[0]
      : null;
  const transientAnnotation =
    transient?.kind === "annotation" &&
    transient.annotation.layerId === layer.id &&
    bindingMatches(transient.annotation, binding)
      ? transient.annotation
      : null;

  return (
    <g
      className={`redline-canvas-layer${layer.locked ? " is-locked" : ""}`}
      data-redline-layer-id={layer.id}
      data-redline-page={binding.page}
      data-redline-source={binding.sourceFingerprint}
      aria-label={`${layer.name} redline layer`}
      style={{
        pointerEvents: interactive && !layer.locked ? "auto" : "none",
      }}
    >
      <g
        className="redline-canvas-committed"
        data-field-redline-export-role="field-redlines"
        opacity={layerOpacity}
      >
        {pageAnnotations.map((annotation, index) => {
          const selected = selectedIds.has(annotation.id);
          const operable = interactive && !layer.locked;
          const hit = annotationHitBounds(annotation, size, zoom);
          const tabbable =
            operable &&
            (
              annotation.id === selection.annotationIds[0] ||
              (!selection.annotationIds.length && index === 0)
            );
          return (
            <g
              key={annotation.id}
              className={`redline-annotation redline-${annotation.kind}${
                selected ? " is-selected" : ""
              }`}
              data-redline-id={annotation.id}
              data-redline-kind={annotation.kind}
              data-plan-edit-control={operable ? "redline" : undefined}
              role={operable ? "button" : "img"}
              aria-label={annotationLabel(annotation)}
              aria-pressed={operable ? selected : undefined}
              tabIndex={tabbable ? 0 : -1}
              onFocus={
                operable
                  ? () => onAnnotationFocus?.(annotation.id)
                  : undefined
              }
              onPointerDown={
                operable
                  ? (event) => {
                    if (!layer.locked) {
                      onAnnotationPointerDown?.(annotation.id, event);
                    }
                  }
                  : undefined
              }
              onKeyDown={
                operable
                  ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onAnnotationActivate?.(annotation.id);
                      return;
                    }
                    if (
                      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]
                        .includes(event.key)
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      const candidates = Array.from(
                        event.currentTarget.parentElement
                          ?.querySelectorAll<SVGGElement>("[data-redline-id]") ||
                          [],
                      );
                      const currentIndex = candidates.indexOf(event.currentTarget);
                      const nextIndex = event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? candidates.length - 1
                          : event.key === "ArrowLeft" || event.key === "ArrowUp"
                            ? (currentIndex - 1 + candidates.length) % candidates.length
                            : (currentIndex + 1) % candidates.length;
                      candidates[nextIndex]?.focus();
                    }
                  }
                  : undefined
              }
            >
              <title>{annotationLabel(annotation)}</title>
              {operable && isStrokeAnnotation(annotation) ? (
                <path
                  className="redline-hit-target"
                  d={pointsPath(annotation.points, size)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={44}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="stroke"
                />
              ) : operable ? (
                <rect
                  className="redline-hit-target"
                  x={hit.x}
                  y={hit.y}
                  width={hit.width}
                  height={hit.height}
                  fill="transparent"
                  stroke="none"
                  pointerEvents="all"
                />
              ) : null}
              {renderAnnotationShape(annotation, size)}
            </g>
          );
        })}
      </g>

      {transientAnnotation ? (
        <g
          className="redline-transient-draft"
          data-redline-kind={transientAnnotation.kind}
          data-field-redline-transient-role="in-progress-strokes"
          pointerEvents="none"
          aria-hidden="true"
          opacity={layerOpacity}
        >
          {renderAnnotationShape(transientAnnotation, size)}
        </g>
      ) : null}

      {transient?.kind === "annotations" ? (
        <g
          className="redline-transient-copy"
          data-field-redline-transient-role="in-progress-strokes"
          pointerEvents="none"
          aria-hidden="true"
          opacity={layerOpacity}
        >
          {transient.annotations.map((annotation) => (
            <g key={annotation.id}>
              {renderAnnotationShape(annotation, size)}
            </g>
          ))}
        </g>
      ) : null}

      {transient?.kind === "lasso" ? (
        <path
          className="redline-transient-lasso"
          data-field-redline-transient-role="selection-handles"
          d={pointsPath(transient.points, size)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          aria-hidden="true"
        />
      ) : null}

      {transient?.kind === "selection-box" ? (
        <g
          className="redline-transient-selection-box"
          data-field-redline-transient-role="selection-handles"
          pointerEvents="none"
          aria-hidden="true"
        >
          <SelectionOutline
            bounds={redlineCanvasCalloutBounds(
              transient.start,
              transient.end,
              size,
            )}
            zoom={zoom}
          />
        </g>
      ) : null}

      {transient?.kind === "eraser" ? (
        <circle
          className="redline-transient-eraser"
          data-field-redline-transient-role="active-cursors"
          cx={redlineCanvasPoint(transient.point, size).x}
          cy={redlineCanvasPoint(transient.point, size).y}
          r={Math.max(1, transient.size * size.shortSide / 2)}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          aria-hidden="true"
        />
      ) : null}

      {selectedBounds ? (
        <g
          className="redline-selection-overlay"
          data-field-redline-transient-role="selection-handles"
          data-selection-count={selectedAnnotations.length}
          aria-hidden="true"
        >
          <SelectionOutline
            bounds={selectedBounds}
            zoom={zoom}
            onResizePointerDown={
              selectedText && onTextResizePointerDown
                ? (event) =>
                  onTextResizePointerDown(
                    selectedText.id,
                    {
                      x: selectedBounds.x / size.width,
                      y: selectedBounds.y / size.height,
                    },
                    event,
                  )
                : undefined
            }
          />
        </g>
      ) : null}
    </g>
  );
}
