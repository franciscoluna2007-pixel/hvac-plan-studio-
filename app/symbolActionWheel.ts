export type SymbolActionWheelPoint = {
  x: number;
  y: number;
};

export type SymbolActionWheelViewport = {
  width: number;
  height: number;
};

export type SymbolActionWheelAvoidBounds = {
  /** Left edge of the selected visual footprint in viewport CSS pixels. */
  left: number;
  /** Top edge of the selected visual footprint in viewport CSS pixels. */
  top: number;
  /** Width of the selected visual footprint in viewport CSS pixels. */
  width: number;
  /** Height of the selected visual footprint in viewport CSS pixels. */
  height: number;
};

export type SymbolActionWheelPlacement = "right" | "left" | "below" | "above";

export type SymbolActionWheelInput = {
  /** Selected symbol center in viewport CSS pixels. */
  anchor: SymbolActionWheelPoint;
  /** Visible canvas viewport in CSS pixels. */
  viewport: SymbolActionWheelViewport;
  /** Selected symbol radius in unzoomed plan units. */
  objectRadius: number;
  /** Current plan zoom. */
  zoom: number;
  /**
   * Exact selected visual footprint in viewport CSS pixels.
   *
   * When supplied, this rectangle is authoritative and is not reduced by the
   * legacy object-radius cap. This keeps the wheel clear of moved labels and
   * wide text while preserving the radius-only contract for older callers.
   */
  avoidBounds?: SymbolActionWheelAvoidBounds;
  /** Optional screen-space cap that keeps the wheel nearby at extreme zoom. */
  maxObjectRadiusPx?: number;
  /** Fixed wheel footprint radius in CSS pixels. */
  wheelRadius?: number;
  /** Clear space between the symbol and wheel footprints in CSS pixels. */
  gap?: number;
  /** Minimum distance from the visible viewport edge in CSS pixels. */
  inset?: number;
};

export type SymbolActionWheelPosition = {
  hidden: boolean;
  layout: "wheel" | "strip";
  placement: SymbolActionWheelPlacement;
  /** Wheel center in viewport CSS pixels. */
  center: SymbolActionWheelPoint;
  /** Wheel-center offset from the selected symbol in CSS pixels. */
  offset: SymbolActionWheelPoint;
  objectRadiusPx: number;
  wheelRadius: number;
  inset: number;
};

export const DEFAULT_SYMBOL_ACTION_WHEEL_RADIUS = 96;
export const DEFAULT_SYMBOL_ACTION_WHEEL_GAP = 12;
export const DEFAULT_SYMBOL_ACTION_WHEEL_INSET = 12;
export const DEFAULT_SYMBOL_ACTION_WHEEL_OBJECT_RADIUS_CAP_PX = 80;
export const DEFAULT_SYMBOL_ACTION_STRIP_MAX_WIDTH = 440;
export const DEFAULT_SYMBOL_ACTION_STRIP_HEIGHT = 124;

const MIN_ZOOM = 0.01;
const MAX_ZOOM = 64;
const MAX_GEOMETRY_VALUE = 1_000_000;

type Direction = {
  placement: SymbolActionWheelPlacement;
  dx: number;
  dy: number;
  priority: number;
  available: number;
};

type NormalizedAvoidBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  center: SymbolActionWheelPoint;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finitePositive(value: number, fallback: number, maximum = MAX_GEOMETRY_VALUE) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, maximum);
}

function finiteNonNegative(value: number | undefined, fallback: number, maximum = MAX_GEOMETRY_VALUE) {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(value, maximum);
}

function finiteZoom(value: number) {
  if (!Number.isFinite(value)) return 1;
  return clamp(Math.abs(value), MIN_ZOOM, MAX_ZOOM);
}

function normalizeAvoidBounds(
  bounds: SymbolActionWheelAvoidBounds | undefined,
): NormalizedAvoidBounds | null | undefined {
  if (!bounds) return undefined;
  if (
    !Number.isFinite(bounds.left) ||
    !Number.isFinite(bounds.top) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width < 0 ||
    bounds.height < 0
  ) {
    return null;
  }
  const width = Math.min(bounds.width, MAX_GEOMETRY_VALUE);
  const height = Math.min(bounds.height, MAX_GEOMETRY_VALUE);
  const left = clamp(bounds.left, -MAX_GEOMETRY_VALUE, MAX_GEOMETRY_VALUE);
  const top = clamp(bounds.top, -MAX_GEOMETRY_VALUE, MAX_GEOMETRY_VALUE);
  const right = clamp(left + width, -MAX_GEOMETRY_VALUE, MAX_GEOMETRY_VALUE);
  const bottom = clamp(top + height, -MAX_GEOMETRY_VALUE, MAX_GEOMETRY_VALUE);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    center: {
      x: left + Math.max(0, right - left) / 2,
      y: top + Math.max(0, bottom - top) / 2,
    },
  };
}

function distanceFromPointToBounds(
  point: SymbolActionWheelPoint,
  bounds: NormalizedAvoidBounds,
) {
  const dx = Math.max(bounds.left - point.x, 0, point.x - bounds.right);
  const dy = Math.max(bounds.top - point.y, 0, point.y - bounds.bottom);
  return Math.hypot(dx, dy);
}

function fallbackCenter(
  anchor: SymbolActionWheelPoint,
  viewport: SymbolActionWheelViewport,
  minimumX: number,
  maximumX: number,
  minimumY: number,
  maximumY: number,
) {
  const horizontalFits = minimumX <= maximumX;
  const verticalFits = minimumY <= maximumY;
  return {
    x: horizontalFits
      ? clamp(anchor.x, minimumX, maximumX)
      : viewport.width / 2,
    y: verticalFits
      ? clamp(anchor.y, minimumY, maximumY)
      : viewport.height / 2,
  };
}

/**
 * Positions a fixed-size HTML action wheel beside a selected plan symbol.
 *
 * The anchor and returned center use viewport CSS pixels. Consumers rendering
 * inside the translated PDF sheet can use the returned offset directly:
 * `left = planPoint.x * zoom + offset.x`.
 */
export function positionSymbolActionWheel(
  input: SymbolActionWheelInput,
): SymbolActionWheelPosition {
  const viewport = {
    width: finitePositive(input.viewport.width, 1),
    height: finitePositive(input.viewport.height, 1),
  };
  const anchorIsFinite = Number.isFinite(input.anchor.x) && Number.isFinite(input.anchor.y);
  const anchor = {
    x: anchorIsFinite ? input.anchor.x : viewport.width / 2,
    y: anchorIsFinite ? input.anchor.y : viewport.height / 2,
  };
  const zoom = finiteZoom(input.zoom);
  const objectRadius = finiteNonNegative(input.objectRadius, 0);
  const maxObjectRadiusPx = finitePositive(
    input.maxObjectRadiusPx ?? MAX_GEOMETRY_VALUE,
    MAX_GEOMETRY_VALUE,
  );
  const objectRadiusPx = Math.min(
    objectRadius * zoom,
    maxObjectRadiusPx,
    MAX_GEOMETRY_VALUE,
  );
  const wheelRadius = finitePositive(
    input.wheelRadius ?? DEFAULT_SYMBOL_ACTION_WHEEL_RADIUS,
    DEFAULT_SYMBOL_ACTION_WHEEL_RADIUS,
  );
  const gap = finiteNonNegative(input.gap, DEFAULT_SYMBOL_ACTION_WHEEL_GAP);
  const inset = finiteNonNegative(input.inset, DEFAULT_SYMBOL_ACTION_WHEEL_INSET);
  const requestedAvoidBounds = normalizeAvoidBounds(input.avoidBounds);
  const avoidBounds = requestedAvoidBounds === undefined
    ? {
        left: anchor.x - objectRadiusPx,
        top: anchor.y - objectRadiusPx,
        right: anchor.x + objectRadiusPx,
        bottom: anchor.y + objectRadiusPx,
        width: objectRadiusPx * 2,
        height: objectRadiusPx * 2,
        center: { ...anchor },
      }
    : requestedAvoidBounds;
  const minimumX = inset + wheelRadius;
  const maximumX = viewport.width - inset - wheelRadius;
  const minimumY = inset + wheelRadius;
  const maximumY = viewport.height - inset - wheelRadius;
  const viewportCanContainWheel = minimumX <= maximumX && minimumY <= maximumY;
  const anchorIsVisible =
    anchorIsFinite &&
    anchor.x >= 0 &&
    anchor.x <= viewport.width &&
    anchor.y >= 0 &&
    anchor.y <= viewport.height;

  const directions: Direction[] = [
    {
      placement: "right",
      dx: 1,
      dy: 0,
      priority: 0,
      available: avoidBounds ? maximumX - avoidBounds.right : Number.NEGATIVE_INFINITY,
    },
    {
      placement: "left",
      dx: -1,
      dy: 0,
      priority: 1,
      available: avoidBounds ? avoidBounds.left - minimumX : Number.NEGATIVE_INFINITY,
    },
    {
      placement: "below",
      dx: 0,
      dy: 1,
      priority: 2,
      available: avoidBounds ? maximumY - avoidBounds.bottom : Number.NEGATIVE_INFINITY,
    },
    {
      placement: "above",
      dx: 0,
      dy: -1,
      priority: 3,
      available: avoidBounds ? avoidBounds.top - minimumY : Number.NEGATIVE_INFINITY,
    },
  ];
  directions.sort((left, right) =>
    right.available - left.available || left.priority - right.priority
  );

  const firstDirection = directions[0];
  let center = fallbackCenter(
    avoidBounds?.center || anchor,
    viewport,
    minimumX,
    maximumX,
    minimumY,
    maximumY,
  );
  let placement = firstDirection.placement;
  let safePlacementFound = false;

  if (anchorIsVisible && viewportCanContainWheel && avoidBounds) {
    for (const direction of directions) {
      const rawCenter = direction.placement === "right"
        ? {
            x: avoidBounds.right + gap + wheelRadius,
            y: avoidBounds.center.y,
          }
        : direction.placement === "left"
          ? {
              x: avoidBounds.left - gap - wheelRadius,
              y: avoidBounds.center.y,
            }
          : direction.placement === "below"
            ? {
                x: avoidBounds.center.x,
                y: avoidBounds.bottom + gap + wheelRadius,
              }
            : {
                x: avoidBounds.center.x,
                y: avoidBounds.top - gap - wheelRadius,
              };
      const candidate = {
        x: clamp(rawCenter.x, minimumX, maximumX),
        y: clamp(rawCenter.y, minimumY, maximumY),
      };
      const offset = {
        x: candidate.x - anchor.x,
        y: candidate.y - anchor.y,
      };
      const directionalTravel = offset.x * direction.dx + offset.y * direction.dy;
      const separation = distanceFromPointToBounds(candidate, avoidBounds);
      if (
        directionalTravel > 0 &&
        separation + Number.EPSILON >= wheelRadius + gap
      ) {
        center = candidate;
        placement = direction.placement;
        safePlacementFound = true;
        break;
      }
    }
  }

  let layout: SymbolActionWheelPosition["layout"] = "wheel";
  if (anchorIsVisible && !safePlacementFound) {
    layout = "strip";
    const stripWidth = Math.max(
      1,
      Math.min(DEFAULT_SYMBOL_ACTION_STRIP_MAX_WIDTH, viewport.width - inset * 2),
    );
    const stripHeight = Math.max(
      1,
      Math.min(DEFAULT_SYMBOL_ACTION_STRIP_HEIGHT, viewport.height - inset * 2),
    );
    const halfWidth = stripWidth / 2;
    const halfHeight = stripHeight / 2;
    const stripMinimumX = inset + halfWidth;
    const stripMaximumX = viewport.width - inset - halfWidth;
    const stripMinimumY = inset + halfHeight;
    const stripMaximumY = viewport.height - inset - halfHeight;
    const preferredBelow = avoidBounds
      ? avoidBounds.bottom + gap + halfHeight
      : anchor.y + gap + halfHeight;
    const preferredAbove = avoidBounds
      ? avoidBounds.top - gap - halfHeight
      : anchor.y - gap - halfHeight;
    const roomBelow = viewport.height - inset - (avoidBounds?.bottom ?? anchor.y);
    const roomAbove = (avoidBounds?.top ?? anchor.y) - inset;
    const preferBelow = roomBelow >= roomAbove;

    placement = preferBelow ? "below" : "above";
    center = {
      x: stripMinimumX <= stripMaximumX
        ? clamp(avoidBounds?.center.x ?? anchor.x, stripMinimumX, stripMaximumX)
        : viewport.width / 2,
      y: stripMinimumY <= stripMaximumY
        ? clamp(preferBelow ? preferredBelow : preferredAbove, stripMinimumY, stripMaximumY)
        : viewport.height / 2,
    };
  }

  return {
    hidden: !anchorIsVisible,
    layout,
    placement,
    center,
    offset: {
      x: center.x - anchor.x,
      y: center.y - anchor.y,
    },
    objectRadiusPx,
    wheelRadius,
    inset,
  };
}
