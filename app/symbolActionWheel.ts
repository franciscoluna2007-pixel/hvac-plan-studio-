export type SymbolActionWheelPoint = {
  x: number;
  y: number;
};

export type SymbolActionWheelViewport = {
  width: number;
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
      available: maximumX - anchor.x,
    },
    {
      placement: "left",
      dx: -1,
      dy: 0,
      priority: 1,
      available: anchor.x - minimumX,
    },
    {
      placement: "below",
      dx: 0,
      dy: 1,
      priority: 2,
      available: maximumY - anchor.y,
    },
    {
      placement: "above",
      dx: 0,
      dy: -1,
      priority: 3,
      available: anchor.y - minimumY,
    },
  ];
  directions.sort((left, right) =>
    right.available - left.available || left.priority - right.priority
  );

  const requiredDistance = Math.min(
    objectRadiusPx + wheelRadius + gap,
    MAX_GEOMETRY_VALUE,
  );
  const firstDirection = directions[0];
  let center = fallbackCenter(
    anchor,
    viewport,
    minimumX,
    maximumX,
    minimumY,
    maximumY,
  );
  let placement = firstDirection.placement;
  let safePlacementFound = false;

  if (anchorIsVisible && viewportCanContainWheel) {
    for (const direction of directions) {
      const rawCenter = {
        x: anchor.x + direction.dx * requiredDistance,
        y: anchor.y + direction.dy * requiredDistance,
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
      const separation = Math.hypot(offset.x, offset.y);
      if (
        directionalTravel > 0 &&
        separation + Number.EPSILON >= requiredDistance
      ) {
        center = candidate;
        placement = direction.placement;
        safePlacementFound = true;
        break;
      }
    }
  }

  return {
    hidden: !anchorIsVisible || !viewportCanContainWheel || !safePlacementFound,
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
