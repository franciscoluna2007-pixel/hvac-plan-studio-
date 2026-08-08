export type RigidNetworkKind = "supply" | "return" | "fresh";
export type RigidConstruction = "rectangular" | "round-metal" | "spiral";

export type RigidSize =
  | {
      shape: "rectangular";
      widthInches: number;
      heightInches: number;
    }
  | {
      shape: "round";
      diameterInches: number;
    };

export type RigidStraightMetaV1 = {
  version: 1;
  kind: "straight";
  networkKind: RigidNetworkKind;
  construction: RigidConstruction;
  size: RigidSize;
};

export type RigidPoint = { x: number; y: number };

export const DEFAULT_RIGID_RECTANGULAR_SIZE: RigidSize = {
  shape: "rectangular",
  widthInches: 12,
  heightInches: 8,
};

export const DEFAULT_RIGID_ROUND_SIZE: RigidSize = {
  shape: "round",
  diameterInches: 8,
};

const networkKinds = new Set<RigidNetworkKind>(["supply", "return", "fresh"]);
const constructions = new Set<RigidConstruction>(["rectangular", "round-metal", "spiral"]);

function boundedInches(value: unknown, maximum: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.min(maximum, Math.max(1, Math.round(number * 4) / 4));
}

export function normalizeRigidStraightMeta(input: unknown): RigidStraightMetaV1 | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<RigidStraightMetaV1>;
  if (
    candidate.version !== 1 ||
    candidate.kind !== "straight" ||
    !networkKinds.has(candidate.networkKind as RigidNetworkKind) ||
    !constructions.has(candidate.construction as RigidConstruction) ||
    !candidate.size ||
    typeof candidate.size !== "object"
  ) return null;

  if (candidate.construction === "rectangular") {
    const size = candidate.size as Partial<Extract<RigidSize, { shape: "rectangular" }>>;
    const widthInches = boundedInches(size.widthInches, 120);
    const heightInches = boundedInches(size.heightInches, 120);
    if (size.shape !== "rectangular" || widthInches == null || heightInches == null) return null;
    return {
      version: 1,
      kind: "straight",
      networkKind: candidate.networkKind as RigidNetworkKind,
      construction: "rectangular",
      size: { shape: "rectangular", widthInches, heightInches },
    };
  }

  const size = candidate.size as Partial<Extract<RigidSize, { shape: "round" }>>;
  const diameterInches = boundedInches(size.diameterInches, 72);
  if (size.shape !== "round" || diameterInches == null) return null;
  return {
    version: 1,
    kind: "straight",
    networkKind: candidate.networkKind as RigidNetworkKind,
    construction: candidate.construction as "round-metal" | "spiral",
    size: { shape: "round", diameterInches },
  };
}

export function rigidSizeLabel(meta: RigidStraightMetaV1) {
  return meta.size.shape === "rectangular"
    ? `${meta.size.widthInches}×${meta.size.heightInches}`
    : `${meta.size.diameterInches}`;
}

export function rigidConstructionLabel(construction: RigidConstruction) {
  if (construction === "rectangular") return "Rectangular sheet metal";
  if (construction === "round-metal") return "Round metal";
  return "Spiral pipe";
}

export function rigidPhysicalWidthInches(meta: RigidStraightMetaV1) {
  return meta.size.shape === "rectangular"
    ? meta.size.widthInches
    : meta.size.diameterInches;
}

export function rigidPlanWidthUnits(meta: RigidStraightMetaV1, feetPerUnit: number) {
  if (!Number.isFinite(feetPerUnit) || feetPerUnit <= 0) return 0;
  return rigidPhysicalWidthInches(meta) / 12 / feetPerUnit;
}

/**
 * Drafting-only width compression. Stored dimensions and every engineering
 * calculation continue to use rigidPhysicalWidthInches/rigidPlanWidthUnits.
 * The curve leaves common 12-inch-and-smaller duct exact, preserves relative
 * size cues above that point, and approaches a quiet 22-inch display ceiling.
 */
export function rigidCompactPhysicalWidthInches(meta: RigidStraightMetaV1) {
  const actual = rigidPhysicalWidthInches(meta);
  if (actual <= 12) return actual;
  return 12 + 10 * (1 - Math.exp(-(actual - 12) / 20));
}

export function rigidCompactPlanWidthUnits(meta: RigidStraightMetaV1, feetPerUnit: number) {
  if (!Number.isFinite(feetPerUnit) || feetPerUnit <= 0) return 0;
  return rigidCompactPhysicalWidthInches(meta) / 12 / feetPerUnit;
}

export function rigidHorizontalLengthFeet(
  points: readonly RigidPoint[],
  feetPerUnit: number,
  scaleVerified = true,
) {
  if (
    !scaleVerified ||
    points.length !== 2 ||
    !points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) ||
    !Number.isFinite(feetPerUnit) ||
    feetPerUnit <= 0
  ) return null;
  return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) * feetPerUnit;
}

export function rigidEdgeLines(points: readonly RigidPoint[], planWidthUnits: number) {
  if (points.length !== 2 || !Number.isFinite(planWidthUnits) || planWidthUnits <= 0) return [];
  const [start, end] = points;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return [];
  const offsetX = -dy / length * planWidthUnits / 2;
  const offsetY = dx / length * planWidthUnits / 2;
  return [
    [{ x: start.x + offsetX, y: start.y + offsetY }, { x: end.x + offsetX, y: end.y + offsetY }],
    [{ x: start.x - offsetX, y: start.y - offsetY }, { x: end.x - offsetX, y: end.y - offsetY }],
  ] as const;
}

export function rigidSpiralSeams(
  points: readonly RigidPoint[],
  planWidthUnits: number,
  maximumSeams = 80,
) {
  if (points.length !== 2 || !Number.isFinite(planWidthUnits) || planWidthUnits <= 0) return [];
  const [start, end] = points;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return [];
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const spacing = Math.max(planWidthUnits * 1.2, length / maximumSeams);
  const count = Math.min(maximumSeams, Math.max(0, Math.floor(length / spacing)));
  const half = planWidthUnits * .47;
  const skew = planWidthUnits * .28;
  return Array.from({ length: count }, (_, index) => {
    const station = Math.min(length, (index + 1) * length / (count + 1));
    const cx = start.x + ux * station;
    const cy = start.y + uy * station;
    return [
      { x: cx + nx * half - ux * skew, y: cy + ny * half - uy * skew },
      { x: cx - nx * half + ux * skew, y: cy - ny * half + uy * skew },
    ] as const;
  });
}
