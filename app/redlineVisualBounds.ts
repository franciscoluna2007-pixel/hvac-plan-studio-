import type {
  RedlineAnnotation,
  RedlineCalloutAnnotation,
  RedlinePoint,
  RedlineStrokeAnnotation,
} from "./redlineDomain";

export type RedlineCanvasBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RedlineCanvasPageSize = {
  width: number;
  height: number;
  shortSide: number;
};

export type RedlineTextLayout = {
  fontSize: number;
  lines: string[];
  estimatedWidth: number;
  estimatedHeight: number;
};

const MIN_PIXEL_STROKE_WIDTH = 0.5;
const MIN_ARROW_HEAD_SIZE_PX = 7;
const ARROW_HEAD_SIZE_RATIO = 0.012;
const ARROW_HEAD_SPREAD_RADIANS = Math.PI / 6;

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function redlineVisualZoom(zoom: number) {
  return Math.max(0.01, finite(zoom, 1));
}

export function redlineCanvasPageSize(
  width: number,
  height: number,
): RedlineCanvasPageSize {
  const safeWidth = Math.max(1, finite(width, 1));
  const safeHeight = Math.max(1, finite(height, 1));
  return {
    width: safeWidth,
    height: safeHeight,
    shortSide: Math.min(safeWidth, safeHeight),
  };
}

export function redlineCanvasPoint(
  point: RedlinePoint,
  size: RedlineCanvasPageSize,
): RedlinePoint {
  return {
    x: Math.max(0, Math.min(1, finite(point.x))) * size.width,
    y: Math.max(0, Math.min(1, finite(point.y))) * size.height,
  };
}

export function redlineCanvasCalloutBounds(
  start: RedlinePoint,
  end: RedlinePoint,
  size: RedlineCanvasPageSize,
): RedlineCanvasBounds {
  const safeStart = redlineCanvasPoint(start, size);
  const safeEnd = redlineCanvasPoint(end, size);
  return {
    x: Math.min(safeStart.x, safeEnd.x),
    y: Math.min(safeStart.y, safeEnd.y),
    width: Math.abs(safeEnd.x - safeStart.x),
    height: Math.abs(safeEnd.y - safeStart.y),
  };
}

export function redlineCanvasStrokeWidth(
  annotation: RedlineAnnotation,
  size: RedlineCanvasPageSize,
) {
  return Math.max(
    MIN_PIXEL_STROKE_WIDTH,
    finite(annotation.style.strokeWidth) * size.shortSide,
  );
}

function padCanvasBounds(
  bounds: RedlineCanvasBounds,
  padding: number,
): RedlineCanvasBounds {
  const safePadding = Math.max(0, finite(padding));
  return {
    x: bounds.x - safePadding,
    y: bounds.y - safePadding,
    width: bounds.width + safePadding * 2,
    height: bounds.height + safePadding * 2,
  };
}

function canvasBoundsForPoints(
  points: readonly RedlinePoint[],
): RedlineCanvasBounds {
  const xs = points.map((point) => finite(point.x));
  const ys = points.map((point) => finite(point.y));
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function unionCanvasBounds(
  first: RedlineCanvasBounds,
  second: RedlineCanvasBounds,
): RedlineCanvasBounds {
  const left = Math.min(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const right = Math.max(first.x + first.width, second.x + second.width);
  const bottom = Math.max(first.y + first.height, second.y + second.height);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Returns the exact three canvas-space points used by the rendered filled
 * arrowhead: tip, first wing, then second wing.
 */
export function redlineCanvasArrowHeadPoints(
  start: RedlinePoint,
  end: RedlinePoint,
  size: number,
): readonly [RedlinePoint, RedlinePoint, RedlinePoint] {
  const safeStart = {
    x: finite(start.x),
    y: finite(start.y),
  };
  const safeEnd = {
    x: finite(end.x),
    y: finite(end.y),
  };
  const angle = Math.atan2(
    safeEnd.y - safeStart.y,
    safeEnd.x - safeStart.x,
  );
  const safeSize = Math.max(
    MIN_ARROW_HEAD_SIZE_PX,
    finite(size, MIN_ARROW_HEAD_SIZE_PX),
  );
  const first = {
    x:
      safeEnd.x -
      safeSize * Math.cos(angle - ARROW_HEAD_SPREAD_RADIANS),
    y:
      safeEnd.y -
      safeSize * Math.sin(angle - ARROW_HEAD_SPREAD_RADIANS),
  };
  const second = {
    x:
      safeEnd.x -
      safeSize * Math.cos(angle + ARROW_HEAD_SPREAD_RADIANS),
    y:
      safeEnd.y -
      safeSize * Math.sin(angle + ARROW_HEAD_SPREAD_RADIANS),
  };
  return [safeEnd, first, second];
}

export function redlineCanvasArrowHeadSize(
  annotation: RedlineCalloutAnnotation,
  size: RedlineCanvasPageSize,
) {
  return (
    Math.max(MIN_ARROW_HEAD_SIZE_PX, size.shortSide * ARROW_HEAD_SIZE_RATIO) +
    redlineCanvasStrokeWidth(annotation, size)
  );
}

export function redlineTextLayout(
  annotation: RedlineCalloutAnnotation,
  size: RedlineCanvasPageSize,
): RedlineTextLayout {
  const textScale = Math.max(
    0.5,
    finite(annotation.style.textScale ?? 1, 1),
  );
  const fontSize = size.shortSide * 0.02 * textScale;
  const lines = (annotation.text || "Text").split(/\r?\n/);
  const longestLine = lines.reduce(
    (longest, line) => Math.max(longest, line.length),
    1,
  );
  return {
    fontSize,
    lines,
    estimatedWidth: longestLine * fontSize * 0.52,
    estimatedHeight: Math.max(1, lines.length) * fontSize * 1.25,
  };
}

function redlineStrokeVisualBounds(
  annotation: RedlineStrokeAnnotation,
  size: RedlineCanvasPageSize,
  zoom: number,
): RedlineCanvasBounds {
  if (!annotation.points.length) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of annotation.points) {
    const safePoint = redlineCanvasPoint(point, size);
    minX = Math.min(minX, safePoint.x);
    minY = Math.min(minY, safePoint.y);
    maxX = Math.max(maxX, safePoint.x);
    maxY = Math.max(maxY, safePoint.y);
  }

  const strokePadding =
    redlineCanvasStrokeWidth(annotation, size) *
    (
      annotation.brushTip === "square"
        ? Math.SQRT2
        : 1
    ) /
    (2 * (annotation.brushTip ? 1 : redlineVisualZoom(zoom)));
  return {
    x: minX - strokePadding,
    y: minY - strokePadding,
    width: maxX - minX + strokePadding * 2,
    height: maxY - minY + strokePadding * 2,
  };
}

export function redlineAnnotationVisualBounds(
  annotation: RedlineAnnotation,
  width: number,
  height: number,
  zoom = 1,
): RedlineCanvasBounds {
  const size = redlineCanvasPageSize(width, height);
  if (annotation.kind === "ink" || annotation.kind === "highlighter") {
    return redlineStrokeVisualBounds(annotation, size, zoom);
  }

  const bounds = redlineCanvasCalloutBounds(
    annotation.start,
    annotation.end,
    size,
  );
  if (annotation.kind !== "text") {
    const strokeWidth = redlineCanvasStrokeWidth(annotation, size);
    const strokedCalloutBounds = padCanvasBounds(
      bounds,
      strokeWidth / (2 * redlineVisualZoom(zoom)),
    );
    if (annotation.kind !== "arrow") return strokedCalloutBounds;

    const start = redlineCanvasPoint(annotation.start, size);
    const end = redlineCanvasPoint(annotation.end, size);
    const arrowHeadBounds = canvasBoundsForPoints(
      redlineCanvasArrowHeadPoints(
        start,
        end,
        redlineCanvasArrowHeadSize(annotation, size),
      ),
    );
    return unionCanvasBounds(strokedCalloutBounds, arrowHeadBounds);
  }
  const text = redlineTextLayout(annotation, size);
  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(bounds.width, text.estimatedWidth),
    height: Math.max(bounds.height, text.estimatedHeight),
  };
}

export function redlineSelectionVisualBounds(
  annotations: readonly RedlineAnnotation[],
  width: number,
  height: number,
  zoom = 1,
): RedlineCanvasBounds | null {
  if (!annotations.length) return null;
  const first = redlineAnnotationVisualBounds(
    annotations[0],
    width,
    height,
    zoom,
  );
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x + first.width;
  let maxY = first.y + first.height;

  for (let index = 1; index < annotations.length; index += 1) {
    const next = redlineAnnotationVisualBounds(
      annotations[index],
      width,
      height,
      zoom,
    );
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
