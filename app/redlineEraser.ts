import type {
  RedlineAnnotation,
  RedlinePageBinding,
  RedlinePoint,
} from "./redlineDomain";
import {
  redlineAnnotationVisualBounds,
  redlineCanvasArrowHeadPoints,
  redlineCanvasArrowHeadSize,
  redlineCanvasPageSize,
  redlineCanvasPoint,
} from "./redlineVisualBounds";

export const REDLINE_ERASER_MIN_SIZE = 0.01;
export const REDLINE_ERASER_MAX_SIZE = 0.16;
export const REDLINE_ERASER_DEFAULT_SIZE = 0.04;
export const REDLINE_ERASER_SIZE_STEP = 0.005;
export const REDLINE_ERASER_STORAGE_KEY =
  "hvac-plan-studio:redline-eraser-size:v1";

type RedlineEraserStorage = Pick<Storage, "getItem" | "setItem">;

type PhysicalPoint = {
  x: number;
  y: number;
};

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function normalizeRedlineEraserSize(value: number) {
  return clamp(
    finite(value, REDLINE_ERASER_DEFAULT_SIZE),
    REDLINE_ERASER_MIN_SIZE,
    REDLINE_ERASER_MAX_SIZE,
  );
}

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadRedlineEraserSize(
  storage: RedlineEraserStorage | null = browserStorage(),
) {
  if (!storage) return REDLINE_ERASER_DEFAULT_SIZE;
  try {
    const stored = storage.getItem(REDLINE_ERASER_STORAGE_KEY);
    if (stored === null || !stored.trim()) return REDLINE_ERASER_DEFAULT_SIZE;
    return normalizeRedlineEraserSize(Number(stored));
  } catch {
    return REDLINE_ERASER_DEFAULT_SIZE;
  }
}

export function saveRedlineEraserSize(
  value: number,
  storage: RedlineEraserStorage | null = browserStorage(),
) {
  const normalized = normalizeRedlineEraserSize(value);
  if (!storage) return normalized;
  try {
    storage.setItem(REDLINE_ERASER_STORAGE_KEY, String(normalized));
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
  return normalized;
}

function safeAspectRatio(value: number) {
  return clamp(finite(value, 1), 0.1, 10);
}

function physicalPoint(
  point: RedlinePoint,
  pageAspectRatio: number,
): PhysicalPoint {
  const aspectRatio = safeAspectRatio(pageAspectRatio);
  const shortSideScale = Math.min(1, aspectRatio);
  return {
    x: finite(point.x, 0) * aspectRatio / shortSideScale,
    y: finite(point.y, 0) / shortSideScale,
  };
}

function pointToSegmentDistance(
  point: PhysicalPoint,
  start: PhysicalPoint,
  end: PhysicalPoint,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const progress = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) /
      lengthSquared,
    0,
    1,
  );
  return Math.hypot(
    point.x - (start.x + dx * progress),
    point.y - (start.y + dy * progress),
  );
}

function orientation(
  first: PhysicalPoint,
  second: PhysicalPoint,
  third: PhysicalPoint,
) {
  return (
    (second.x - first.x) * (third.y - first.y) -
    (second.y - first.y) * (third.x - first.x)
  );
}

function between(value: number, first: number, second: number) {
  return (
    value >= Math.min(first, second) - Number.EPSILON &&
    value <= Math.max(first, second) + Number.EPSILON
  );
}

function pointOnSegment(
  point: PhysicalPoint,
  start: PhysicalPoint,
  end: PhysicalPoint,
) {
  const tolerance = 1e-9;
  return (
    Math.abs(orientation(start, end, point)) <= tolerance &&
    between(point.x, start.x, end.x) &&
    between(point.y, start.y, end.y)
  );
}

function segmentsIntersect(
  firstStart: PhysicalPoint,
  firstEnd: PhysicalPoint,
  secondStart: PhysicalPoint,
  secondEnd: PhysicalPoint,
) {
  const tolerance = 1e-9;
  const firstOrientation = orientation(firstStart, firstEnd, secondStart);
  const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
  const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
  const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);
  const oppositeSides = (first: number, second: number) =>
    (
      first > tolerance &&
      second < -tolerance
    ) || (
      first < -tolerance &&
      second > tolerance
    );
  if (
    oppositeSides(firstOrientation, secondOrientation) &&
    oppositeSides(thirdOrientation, fourthOrientation)
  ) {
    return true;
  }
  return (
    pointOnSegment(secondStart, firstStart, firstEnd) ||
    pointOnSegment(secondEnd, firstStart, firstEnd) ||
    pointOnSegment(firstStart, secondStart, secondEnd) ||
    pointOnSegment(firstEnd, secondStart, secondEnd)
  );
}

function segmentDistance(
  firstStart: PhysicalPoint,
  firstEnd: PhysicalPoint,
  secondStart: PhysicalPoint,
  secondEnd: PhysicalPoint,
) {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return 0;
  return Math.min(
    pointToSegmentDistance(firstStart, secondStart, secondEnd),
    pointToSegmentDistance(firstEnd, secondStart, secondEnd),
    pointToSegmentDistance(secondStart, firstStart, firstEnd),
    pointToSegmentDistance(secondEnd, firstStart, firstEnd),
  );
}

function pointInsideBounds(
  point: PhysicalPoint,
  left: number,
  top: number,
  right: number,
  bottom: number,
) {
  return (
    point.x >= left &&
    point.x <= right &&
    point.y >= top &&
    point.y <= bottom
  );
}

function sweepIntersectsBounds(
  sweepStart: PhysicalPoint,
  sweepEnd: PhysicalPoint,
  start: PhysicalPoint,
  end: PhysicalPoint,
  padding: number,
) {
  const left = Math.min(start.x, end.x) - padding;
  const right = Math.max(start.x, end.x) + padding;
  const top = Math.min(start.y, end.y) - padding;
  const bottom = Math.max(start.y, end.y) + padding;
  if (
    pointInsideBounds(sweepStart, left, top, right, bottom) ||
    pointInsideBounds(sweepEnd, left, top, right, bottom)
  ) {
    return true;
  }
  const topLeft = { x: left, y: top };
  const topRight = { x: right, y: top };
  const bottomRight = { x: right, y: bottom };
  const bottomLeft = { x: left, y: bottom };
  return [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ].some(([edgeStart, edgeEnd]) =>
    segmentsIntersect(sweepStart, sweepEnd, edgeStart, edgeEnd));
}

function sweepIntersectsBoundsOutline(
  sweepStart: PhysicalPoint,
  sweepEnd: PhysicalPoint,
  start: PhysicalPoint,
  end: PhysicalPoint,
  padding: number,
) {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const topLeft = { x: left, y: top };
  const topRight = { x: right, y: top };
  const bottomRight = { x: right, y: bottom };
  const bottomLeft = { x: left, y: bottom };
  return [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ].some(([edgeStart, edgeEnd]) =>
    segmentDistance(sweepStart, sweepEnd, edgeStart, edgeEnd) <= padding);
}

function sweepIntersectsEllipse(
  sweepStart: PhysicalPoint,
  sweepEnd: PhysicalPoint,
  start: PhysicalPoint,
  end: PhysicalPoint,
  padding: number,
  filled: boolean,
) {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const center = {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
  const radiusX = (right - left) / 2;
  const radiusY = (bottom - top) / 2;
  if (radiusX <= Number.EPSILON || radiusY <= Number.EPSILON) {
    return pointToSegmentDistance(center, sweepStart, sweepEnd) <= padding;
  }

  const pointInsideEllipse = (point: PhysicalPoint) => {
    const normalizedX = (point.x - center.x) / radiusX;
    const normalizedY = (point.y - center.y) / radiusY;
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  };
  if (
    filled &&
    (
      pointInsideEllipse(sweepStart) ||
      pointInsideEllipse(sweepEnd)
    )
  ) {
    return true;
  }

  const segmentCount = 48;
  let previous = {
    x: center.x + radiusX,
    y: center.y,
  };
  for (let index = 1; index <= segmentCount; index += 1) {
    const angle = index / segmentCount * Math.PI * 2;
    const current = {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
    };
    if (
      segmentDistance(
        sweepStart,
        sweepEnd,
        previous,
        current,
      ) <= padding
    ) {
      return true;
    }
    previous = current;
  }
  return false;
}

function physicalCanvasSize(pageAspectRatio: number) {
  const aspectRatio = safeAspectRatio(pageAspectRatio);
  const shortSide = 1_000;
  return redlineCanvasPageSize(
    aspectRatio >= 1 ? shortSide * aspectRatio : shortSide,
    aspectRatio >= 1 ? shortSide : shortSide / aspectRatio,
  );
}

function canvasPointToPhysical(
  point: RedlinePoint,
  shortSide: number,
): PhysicalPoint {
  return {
    x: point.x / shortSide,
    y: point.y / shortSide,
  };
}

function pointInsidePolygon(
  point: PhysicalPoint,
  polygon: readonly PhysicalPoint[],
) {
  let inside = false;
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crosses =
      (current.y > point.y) !== (previous.y > point.y) &&
      point.x <
        (previous.x - current.x) *
          (point.y - current.y) /
          (previous.y - current.y) +
        current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function sweepIntersectsPolygon(
  sweepStart: PhysicalPoint,
  sweepEnd: PhysicalPoint,
  polygon: readonly PhysicalPoint[],
  padding: number,
) {
  if (
    pointInsidePolygon(sweepStart, polygon) ||
    pointInsidePolygon(sweepEnd, polygon)
  ) {
    return true;
  }
  return polygon.some((point, index) =>
    segmentDistance(
      sweepStart,
      sweepEnd,
      point,
      polygon[(index + 1) % polygon.length],
    ) <= padding);
}

function squareBrushSegmentPolygon(
  start: PhysicalPoint,
  end: PhysicalPoint,
  halfSide: number,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= Number.EPSILON) {
    return [
      { x: start.x - halfSide, y: start.y - halfSide },
      { x: start.x + halfSide, y: start.y - halfSide },
      { x: start.x + halfSide, y: start.y + halfSide },
      { x: start.x - halfSide, y: start.y + halfSide },
    ];
  }
  const tangentX = dx / length * halfSide;
  const tangentY = dy / length * halfSide;
  const normalX = -dy / length * halfSide;
  const normalY = dx / length * halfSide;
  return [
    {
      x: start.x - tangentX + normalX,
      y: start.y - tangentY + normalY,
    },
    {
      x: end.x + tangentX + normalX,
      y: end.y + tangentY + normalY,
    },
    {
      x: end.x + tangentX - normalX,
      y: end.y + tangentY - normalY,
    },
    {
      x: start.x - tangentX - normalX,
      y: start.y - tangentY - normalY,
    },
  ];
}

function annotationIntersectsEraser(
  annotation: RedlineAnnotation,
  sweepStart: PhysicalPoint,
  sweepEnd: PhysicalPoint,
  eraserRadius: number,
  pageAspectRatio: number,
) {
  const aspectRatio = safeAspectRatio(pageAspectRatio);
  const strokePadding =
    Math.max(0, finite(annotation.style.strokeWidth, 0)) / 2;
  const hitRadius = eraserRadius + strokePadding;

  if (annotation.kind === "ink" || annotation.kind === "highlighter") {
    const points = annotation.points.map((point) =>
      physicalPoint(point, aspectRatio));
    if (!points.length) return false;
    if (annotation.kind === "ink" && annotation.brushTip === "square") {
      if (points.length === 1) {
        return sweepIntersectsPolygon(
          sweepStart,
          sweepEnd,
          squareBrushSegmentPolygon(
            points[0],
            points[0],
            strokePadding,
          ),
          eraserRadius,
        );
      }
      return points.slice(1).some((point, index) =>
        sweepIntersectsPolygon(
          sweepStart,
          sweepEnd,
          squareBrushSegmentPolygon(
            points[index],
            point,
            strokePadding,
          ),
          eraserRadius,
        ));
    }
    if (points.length === 1) {
      return pointToSegmentDistance(points[0], sweepStart, sweepEnd) <= hitRadius;
    }
    return points.slice(1).some((point, index) =>
      segmentDistance(
        sweepStart,
        sweepEnd,
        points[index],
        point,
      ) <= hitRadius);
  }

  const start = physicalPoint(annotation.start, aspectRatio);
  const end = physicalPoint(annotation.end, aspectRatio);
  if (annotation.kind === "arrow") {
    if (segmentDistance(sweepStart, sweepEnd, start, end) <= hitRadius) {
      return true;
    }
    const pageSize = physicalCanvasSize(aspectRatio);
    const canvasStart = redlineCanvasPoint(annotation.start, pageSize);
    const canvasEnd = redlineCanvasPoint(annotation.end, pageSize);
    const arrowHead = redlineCanvasArrowHeadPoints(
      canvasStart,
      canvasEnd,
      redlineCanvasArrowHeadSize(annotation, pageSize),
    ).map((point) =>
      canvasPointToPhysical(point, pageSize.shortSide));
    return sweepIntersectsPolygon(
      sweepStart,
      sweepEnd,
      arrowHead,
      eraserRadius,
    );
  }
  if (annotation.kind === "circle") {
    return sweepIntersectsEllipse(
      sweepStart,
      sweepEnd,
      start,
      end,
      hitRadius,
      Boolean(annotation.style.fillColor),
    );
  }
  if (
    annotation.kind === "rectangle" ||
    annotation.kind === "cloud"
  ) {
    return annotation.style.fillColor
      ? sweepIntersectsBounds(
        sweepStart,
        sweepEnd,
        start,
        end,
        hitRadius,
      )
      : sweepIntersectsBoundsOutline(
        sweepStart,
        sweepEnd,
        start,
        end,
        hitRadius,
      );
  }
  if (annotation.kind === "text") {
    const pageSize = physicalCanvasSize(aspectRatio);
    const bounds = redlineAnnotationVisualBounds(
      annotation,
      pageSize.width,
      pageSize.height,
      1,
    );
    return sweepIntersectsBounds(
      sweepStart,
      sweepEnd,
      {
        x: bounds.x / pageSize.shortSide,
        y: bounds.y / pageSize.shortSide,
      },
      {
        x: (bounds.x + bounds.width) / pageSize.shortSide,
        y: (bounds.y + bounds.height) / pageSize.shortSide,
      },
      eraserRadius,
    );
  }
  return sweepIntersectsBounds(sweepStart, sweepEnd, start, end, hitRadius);
}

export function redlineEraserHitIds(input: {
  annotations: readonly RedlineAnnotation[];
  binding: RedlinePageBinding;
  layerId: string;
  from: RedlinePoint;
  to: RedlinePoint;
  size: number;
  pageAspectRatio?: number;
}) {
  const pageAspectRatio = safeAspectRatio(input.pageAspectRatio ?? 1);
  const sweepStart = physicalPoint(input.from, pageAspectRatio);
  const sweepEnd = physicalPoint(input.to, pageAspectRatio);
  const eraserRadius = normalizeRedlineEraserSize(input.size) / 2;
  return input.annotations
    .filter((annotation) =>
      annotation.layerId === input.layerId &&
      annotation.binding.sourceFingerprint ===
        input.binding.sourceFingerprint &&
      annotation.binding.page === input.binding.page &&
      annotationIntersectsEraser(
        annotation,
        sweepStart,
        sweepEnd,
        eraserRadius,
        pageAspectRatio,
      ))
    .map((annotation) => annotation.id);
}
