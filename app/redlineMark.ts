import type {
  RedlineAnnotationKind,
  RedlinePoint,
  RedlineStyle,
} from "./redlineDomain";

export const REDLINE_MARK_TOOLS = [
  "round-mark",
  "square-mark",
] as const;

export const REDLINE_MARK_SIZES = [
  "micro",
  "tiny",
  "small",
  "medium",
  "large",
  "extra-large",
] as const;

export type RedlineMarkTool = typeof REDLINE_MARK_TOOLS[number];
export type RedlineMarkSize =
  | typeof REDLINE_MARK_SIZES[number]
  | number;

const MARK_RADIUS_BY_SIZE: Record<typeof REDLINE_MARK_SIZES[number], number> = {
  micro: 0.0025,
  tiny: 0.0075,
  small: 0.015,
  medium: 0.025,
  large: 0.04,
  "extra-large": 0.06,
};

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function rounded(value: number) {
  return Number(value.toFixed(8));
}

export function isRedlineMarkTool(value: string): value is RedlineMarkTool {
  return (REDLINE_MARK_TOOLS as readonly string[]).includes(value);
}

export function redlineMarkAnnotationKind(
  tool: RedlineMarkTool,
): Extract<RedlineAnnotationKind, "circle" | "rectangle"> {
  return tool === "round-mark" ? "circle" : "rectangle";
}

export function redlineMarkStyle(style: RedlineStyle): RedlineStyle {
  return {
    ...style,
    fillColor: style.color,
  };
}

export function redlineOutlineStyle(style: RedlineStyle): RedlineStyle {
  const outlineStyle = { ...style };
  delete outlineStyle.fillColor;
  return outlineStyle;
}

export function redlineMarkRadius(size: RedlineMarkSize = "medium") {
  if (typeof size === "number") {
    return clamp(finite(size, MARK_RADIUS_BY_SIZE.medium), 0.0005, 0.15);
  }
  return MARK_RADIUS_BY_SIZE[size] || MARK_RADIUS_BY_SIZE.medium;
}

export function redlineMarkBounds(input: {
  center: RedlinePoint;
  pointer: RedlinePoint;
  pageAspectRatio?: number;
  size?: RedlineMarkSize;
}) {
  const aspectRatio = clamp(
    finite(input.pageAspectRatio ?? 1, 1),
    0.1,
    10,
  );
  const center = {
    x: clamp(finite(input.center.x, 0.5)),
    y: clamp(finite(input.center.y, 0.5)),
  };
  const pointer = {
    x: clamp(finite(input.pointer.x, center.x)),
    y: clamp(finite(input.pointer.y, center.y)),
  };
  const dragRadius = Math.max(
    Math.abs(pointer.x - center.x),
    Math.abs(pointer.y - center.y) / aspectRatio,
  );
  const presetRadius = redlineMarkRadius(input.size);
  const requestedRadius = dragRadius >= 0.00025 ? dragRadius : presetRadius;
  const radiusX = Math.min(
    requestedRadius,
    0.5,
    0.5 / aspectRatio,
  );
  const radiusY = radiusX * aspectRatio;

  let left = center.x - radiusX;
  let right = center.x + radiusX;
  let top = center.y - radiusY;
  let bottom = center.y + radiusY;

  if (left < 0) {
    right -= left;
    left = 0;
  }
  if (right > 1) {
    left -= right - 1;
    right = 1;
  }
  if (top < 0) {
    bottom -= top;
    top = 0;
  }
  if (bottom > 1) {
    top -= bottom - 1;
    bottom = 1;
  }

  return {
    start: {
      x: rounded(clamp(left)),
      y: rounded(clamp(top)),
    },
    end: {
      x: rounded(clamp(right)),
      y: rounded(clamp(bottom)),
    },
    usedPreset: dragRadius < 0.00025,
  };
}

export function redlineDragShapeBounds(input: {
  start: RedlinePoint;
  pointer: RedlinePoint;
  pageAspectRatio?: number;
  minimumPhysicalSize?: number;
}) {
  const aspectRatio = clamp(
    finite(input.pageAspectRatio ?? 1, 1),
    0.1,
    10,
  );
  const start = {
    x: clamp(finite(input.start.x, 0.5)),
    y: clamp(finite(input.start.y, 0.5)),
  };
  const pointer = {
    x: clamp(finite(input.pointer.x, start.x)),
    y: clamp(finite(input.pointer.y, start.y)),
  };
  const xScale = aspectRatio >= 1 ? aspectRatio : 1;
  const yScale = aspectRatio >= 1 ? 1 : 1 / aspectRatio;
  const rawX = pointer.x - start.x;
  const rawY = pointer.y - start.y;
  const requestedPhysicalSize = Math.max(
    Math.abs(rawX) * xScale,
    Math.abs(rawY) * yScale,
  );
  const minimumPhysicalSize = clamp(
    finite(input.minimumPhysicalSize ?? 0.00025, 0.00025),
    0.00001,
    0.05,
  );
  if (requestedPhysicalSize < minimumPhysicalSize) return null;

  const directionX = rawX < 0
    ? -1
    : rawX > 0
      ? 1
      : start.x <= 0.5
        ? 1
        : -1;
  const directionY = rawY < 0
    ? -1
    : rawY > 0
      ? 1
      : start.y <= 0.5
        ? 1
        : -1;
  const availableX = (directionX > 0 ? 1 - start.x : start.x) * xScale;
  const availableY = (directionY > 0 ? 1 - start.y : start.y) * yScale;
  const physicalSize = Math.min(
    requestedPhysicalSize,
    availableX,
    availableY,
  );
  if (physicalSize < minimumPhysicalSize) return null;

  return {
    start: {
      x: rounded(start.x),
      y: rounded(start.y),
    },
    end: {
      x: rounded(clamp(start.x + directionX * physicalSize / xScale)),
      y: rounded(clamp(start.y + directionY * physicalSize / yScale)),
    },
    physicalSize: rounded(physicalSize),
  };
}
