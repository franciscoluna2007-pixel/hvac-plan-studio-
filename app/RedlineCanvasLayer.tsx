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

export type RedlineCanvasBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RedlineCanvasTransient =
  | { kind: "annotation"; annotation: RedlineAnnotation }
  | { kind: "lasso"; points: readonly RedlinePoint[] }
  | { kind: "selection-box"; start: RedlinePoint; end: RedlinePoint };

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
  onAnnotationFocus?: (annotationId: string) => void;
  onAnnotationActivate?: (annotationId: string) => void;
};

type PageSize = {
  width: number;
  height: number;
  shortSide: number;
};

const MIN_PIXEL_STROKE_WIDTH = 0.5;
const SELECTION_PADDING_PX = 6;
const SELECTION_HANDLE_RADIUS_PX = 4;
const EMPTY_SELECTION: RedlineCanvasSelection = { annotationIds: [] };

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function pageSize(width: number, height: number): PageSize {
  const safeWidth = Math.max(1, finite(width, 1));
  const safeHeight = Math.max(1, finite(height, 1));
  return {
    width: safeWidth,
    height: safeHeight,
    shortSide: Math.min(safeWidth, safeHeight),
  };
}

function pagePoint(point: RedlinePoint, size: PageSize): RedlinePoint {
  return {
    x: Math.max(0, Math.min(1, finite(point.x))) * size.width,
    y: Math.max(0, Math.min(1, finite(point.y))) * size.height,
  };
}

function pageBounds(
  start: RedlinePoint,
  end: RedlinePoint,
  size: PageSize,
): RedlineCanvasBounds {
  const safeStart = pagePoint(start, size);
  const safeEnd = pagePoint(end, size);
  return {
    x: Math.min(safeStart.x, safeEnd.x),
    y: Math.min(safeStart.y, safeEnd.y),
    width: Math.abs(safeEnd.x - safeStart.x),
    height: Math.abs(safeEnd.y - safeStart.y),
  };
}

function domainBoundsToPageBounds(
  bounds: RedlineBounds,
  size: PageSize,
): RedlineCanvasBounds {
  const start = pagePoint({ x: bounds.left, y: bounds.top }, size);
  const end = pagePoint(
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

function pointsPath(points: readonly RedlinePoint[], size: PageSize) {
  return points
    .map((point, index) => {
      const safePoint = pagePoint(point, size);
      return `${index === 0 ? "M" : "L"} ${safePoint.x} ${safePoint.y}`;
    })
    .join(" ");
}

function annotationLabel(annotation: RedlineAnnotation) {
  if (annotation.kind === "ink") return "Pen redline";
  if (annotation.kind === "highlighter") return "Highlighted redline";
  if (annotation.kind === "arrow") return "Arrow redline";
  if (annotation.kind === "rectangle") return "Rectangle redline";
  if (annotation.kind === "circle") return "Circle redline";
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

function pixelStrokeWidth(
  annotation: RedlineAnnotation,
  size: PageSize,
) {
  return Math.max(
    MIN_PIXEL_STROKE_WIDTH,
    finite(annotation.style.strokeWidth) * size.shortSide,
  );
}

function strokeBounds(
  annotation: RedlineStrokeAnnotation,
  size: PageSize,
): RedlineCanvasBounds {
  if (!annotation.points.length) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of annotation.points) {
    const safePoint = pagePoint(point, size);
    minX = Math.min(minX, safePoint.x);
    minY = Math.min(minY, safePoint.y);
    maxX = Math.max(maxX, safePoint.x);
    maxY = Math.max(maxY, safePoint.y);
  }

  const strokePadding = pixelStrokeWidth(annotation, size) / 2;
  return {
    x: minX - strokePadding,
    y: minY - strokePadding,
    width: maxX - minX + strokePadding * 2,
    height: maxY - minY + strokePadding * 2,
  };
}

function calloutBounds(
  annotation: RedlineCalloutAnnotation,
  size: PageSize,
): RedlineCanvasBounds {
  const bounds = pageBounds(annotation.start, annotation.end, size);
  if (annotation.kind !== "text") return bounds;

  const textScale = Math.max(0.5, finite(annotation.style.textScale ?? 1, 1));
  const fontSize = size.shortSide * 0.02 * textScale;
  const lines = (annotation.text || "Text").split(/\r?\n/);
  const longestLine = lines.reduce(
    (longest, line) => Math.max(longest, line.length),
    1,
  );
  const estimatedWidth = longestLine * fontSize * 0.52;
  const estimatedHeight = Math.max(1, lines.length) * fontSize * 1.25;
  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(bounds.width, estimatedWidth),
    height: Math.max(bounds.height, estimatedHeight),
  };
}

function annotationBounds(
  annotation: RedlineAnnotation,
  size: PageSize,
): RedlineCanvasBounds {
  return isStrokeAnnotation(annotation)
    ? strokeBounds(annotation, size)
    : calloutBounds(annotation, size);
}

function annotationHitBounds(
  annotation: RedlineAnnotation,
  size: PageSize,
  zoom: number,
): RedlineCanvasBounds {
  const bounds = annotationBounds(annotation, size);
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

function combineBounds(
  annotations: readonly RedlineAnnotation[],
  size: PageSize,
): RedlineCanvasBounds | undefined {
  if (!annotations.length) return undefined;
  const first = annotationBounds(annotations[0], size);
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x + first.width;
  let maxY = first.y + first.height;

  for (let index = 1; index < annotations.length; index += 1) {
    const next = annotationBounds(annotations[index], size);
    minX = Math.min(minX, next.x);
    minY = Math.min(minY, next.y);
    maxX = Math.max(maxX, next.x + next.width);
    maxY = Math.max(maxY, next.y + next.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function arrowHeadPoints(start: RedlinePoint, end: RedlinePoint, size: number) {
  const safeStart = { x: finite(start.x), y: finite(start.y) };
  const safeEnd = { x: finite(end.x), y: finite(end.y) };
  const angle = Math.atan2(
    safeEnd.y - safeStart.y,
    safeEnd.x - safeStart.x,
  );
  const safeSize = Math.max(7, finite(size, 7));
  const spread = Math.PI / 6;
  const first = {
    x: safeEnd.x - safeSize * Math.cos(angle - spread),
    y: safeEnd.y - safeSize * Math.sin(angle - spread),
  };
  const second = {
    x: safeEnd.x - safeSize * Math.cos(angle + spread),
    y: safeEnd.y - safeSize * Math.sin(angle + spread),
  };
  return `${safeEnd.x},${safeEnd.y} ${first.x},${first.y} ${second.x},${second.y}`;
}

function renderStroke(
  annotation: RedlineStrokeAnnotation,
  size: PageSize,
) {
  const strokeWidth = pixelStrokeWidth(annotation, size);
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
  size: PageSize,
): ReactNode {
  const start = pagePoint(annotation.start, size);
  const end = pagePoint(annotation.end, size);
  const bounds = pageBounds(annotation.start, annotation.end, size);
  const strokeWidth = pixelStrokeWidth(annotation, size);
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
          points={arrowHeadPoints(
            start,
            end,
            Math.max(7, size.shortSide * 0.012) + strokeWidth,
          )}
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

  const textScale = Math.max(0.5, finite(annotation.style.textScale ?? 1, 1));
  const fontSize = size.shortSide * 0.02 * textScale;
  const lines = (annotation.text || "Text").split(/\r?\n/);
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
  size: PageSize,
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
}: {
  bounds: RedlineCanvasBounds;
  zoom: number;
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

  return (
    <g className="redline-selection-outline" pointerEvents="none">
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
      />
      {corners.map(([cornerX, cornerY], index) => (
        <circle
          key={index}
          cx={cornerX}
          cy={cornerY}
          r={handleRadius}
          fill="currentColor"
          stroke="white"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
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
  onAnnotationFocus,
  onAnnotationActivate,
}: RedlineCanvasLayerProps) {
  if (!layer.visible || layer.opacity <= 0) return null;

  const size = pageSize(width, height);
  const pageAnnotations = annotations.filter(
    (annotation) =>
      annotation.layerId === layer.id && bindingMatches(annotation, binding),
  );
  const selectedIds = new Set(selection.annotationIds);
  const selectedAnnotations = pageAnnotations.filter((annotation) =>
    selectedIds.has(annotation.id),
  );
  const selectedBounds =
    selection.bounds
      ? domainBoundsToPageBounds(selection.bounds, size)
      : combineBounds(selectedAnnotations, size);
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
      opacity={Math.max(0, Math.min(1, finite(layer.opacity, 1)))}
      style={{
        pointerEvents: interactive && !layer.locked ? "auto" : "none",
      }}
    >
      <g
        className="redline-canvas-committed"
        data-field-redline-export-role="field-redlines"
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
        >
          {renderAnnotationShape(transientAnnotation, size)}
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
            bounds={pageBounds(transient.start, transient.end, size)}
            zoom={zoom}
          />
        </g>
      ) : null}

      {selectedBounds ? (
        <g
          className="redline-selection-overlay"
          data-field-redline-transient-role="selection-handles"
          data-selection-count={selectedAnnotations.length}
          aria-hidden="true"
        >
          <SelectionOutline bounds={selectedBounds} zoom={zoom} />
        </g>
      ) : null}
    </g>
  );
}
