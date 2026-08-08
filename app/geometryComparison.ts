import Flatten from "@flatten-js/core";

import type { RigidPoint } from "./rigidDuct";
import {
  normalizeRigidElbowMeta,
  rigidElbowGeometry,
  type RigidElbowMetaV1,
} from "./rigidTopology";
import {
  normalizeRigidTransitionMeta,
  rigidTransitionIsReduction,
  rigidTransitionPolygon,
  type RigidTransitionMetaV1,
} from "./rigidTransitions";

export const GEOMETRY_COMPARISON_CONTRACT_VERSION = 1 as const;
export const GEOMETRY_COMPARISON_ADAPTER_VERSION = 1 as const;
export const GEOMETRY_COMPARISON_TOLERANCE_UNITS = 1e-8;
export const FLATTEN_JS_CANDIDATE_VERSION = "1.6.12" as const;
const FLATTEN_JS_PACKAGE_NAME = ["@flatten-js", "core"].join("/") as "@flatten-js/core";

const BASELINE_ELBOW_SOURCE = "app/rigidTopology.rigidElbowGeometry" as const;
const BASELINE_REDUCER_SOURCE = "app/rigidTransitions.rigidTransitionPolygon" as const;

export type GeometryComparisonInputProvenance = {
  /** Git SHA or other immutable identifier for the production baseline under test. */
  baselineRevision: string;
  /** Must match the exact package version compiled into this adapter. */
  candidatePackageVersion: typeof FLATTEN_JS_CANDIDATE_VERSION;
};

export type GeometryComparisonProvenance = {
  baseline: {
    source: typeof BASELINE_ELBOW_SOURCE | typeof BASELINE_REDUCER_SOURCE;
    revision: string;
  };
  candidate: {
    package: "@flatten-js/core";
    packageVersion: typeof FLATTEN_JS_CANDIDATE_VERSION;
    adapterVersion: typeof GEOMETRY_COMPARISON_ADAPTER_VERSION;
  };
  evidenceClass: "local-differential-comparison";
};

export type ElbowGeometryComparisonInput = {
  contractVersion: typeof GEOMETRY_COMPARISON_CONTRACT_VERSION;
  fixtureId: string;
  provenance: GeometryComparisonInputProvenance;
  vertex: RigidPoint;
  elbow: RigidElbowMetaV1;
  feetPerUnit: number;
};

export type RectangularReducerComparisonInput = {
  contractVersion: typeof GEOMETRY_COMPARISON_CONTRACT_VERSION;
  fixtureId: string;
  provenance: GeometryComparisonInputProvenance;
  inlet: RigidPoint;
  transition: RigidTransitionMetaV1;
  feetPerUnit: number;
};

export type ElbowGeometrySnapshot = {
  inlet: RigidPoint;
  vertex: RigidPoint;
  outlet: RigidPoint;
  inbound: RigidPoint;
  outbound: RigidPoint;
  inletTrimUnits: number;
  outletTrimUnits: number;
  tangentIntersectionCount: number;
  tangentAtVertex: boolean;
};

export type ReducerGeometrySnapshot = {
  inlet: RigidPoint;
  outlet: RigidPoint;
  axis: RigidPoint;
  normal: RigidPoint;
  lengthUnits: number;
  inletWidthUnits: number;
  outletWidthUnits: number;
  points: [RigidPoint, RigidPoint, RigidPoint, RigidPoint];
  areaUnitsSquared: number;
  polygonValid: boolean;
};

export type GeometryComparisonMetrics = {
  maxCoordinateDelta: number | null;
  maxScalarDelta: number | null;
  baselineFinite: boolean;
  candidateFinite: boolean;
};

export type GeometryComparisonReceipt<TSnapshot> = {
  contractVersion: typeof GEOMETRY_COMPARISON_CONTRACT_VERSION;
  adapterVersion: typeof GEOMETRY_COMPARISON_ADAPTER_VERSION;
  fixtureId: string;
  comparisonKind: "elbow-tangent-trim" | "rectangular-reducer-outline";
  provenance: GeometryComparisonProvenance;
  status: "match" | "mismatch" | "rejected" | "candidate-error";
  baseline: TSnapshot | null;
  candidate: TSnapshot | null;
  metrics: GeometryComparisonMetrics;
  rejectionReason?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function finitePoint(value: unknown): value is RigidPoint {
  return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function validEnvelope(input: unknown): input is {
  contractVersion: 1;
  fixtureId: string;
  provenance: GeometryComparisonInputProvenance;
} {
  if (!isRecord(input) || input.contractVersion !== GEOMETRY_COMPARISON_CONTRACT_VERSION) return false;
  if (typeof input.fixtureId !== "string" || !input.fixtureId.trim() || input.fixtureId.length > 160) return false;
  if (!isRecord(input.provenance)) return false;
  return typeof input.provenance.baselineRevision === "string"
    && Boolean(input.provenance.baselineRevision.trim())
    && input.provenance.baselineRevision.length <= 160
    && input.provenance.candidatePackageVersion === FLATTEN_JS_CANDIDATE_VERSION;
}

function provenance(
  input: { provenance: GeometryComparisonInputProvenance },
  source: GeometryComparisonProvenance["baseline"]["source"],
): GeometryComparisonProvenance {
  return {
    baseline: { source, revision: input.provenance.baselineRevision },
    candidate: {
      package: FLATTEN_JS_PACKAGE_NAME,
      packageVersion: FLATTEN_JS_CANDIDATE_VERSION,
      adapterVersion: GEOMETRY_COMPARISON_ADAPTER_VERSION,
    },
    evidenceClass: "local-differential-comparison",
  };
}

function emptyMetrics(): GeometryComparisonMetrics {
  return {
    maxCoordinateDelta: null,
    maxScalarDelta: null,
    baselineFinite: false,
    candidateFinite: false,
  };
}

function rejected<TSnapshot>(input: unknown, kind: GeometryComparisonReceipt<TSnapshot>["comparisonKind"], reason: string) {
  const envelope = validEnvelope(input) ? input : null;
  const source = kind === "elbow-tangent-trim" ? BASELINE_ELBOW_SOURCE : BASELINE_REDUCER_SOURCE;
  const fallbackProvenance: GeometryComparisonProvenance = {
    baseline: { source, revision: envelope?.provenance.baselineRevision || "unverified" },
    candidate: {
      package: FLATTEN_JS_PACKAGE_NAME,
      packageVersion: FLATTEN_JS_CANDIDATE_VERSION,
      adapterVersion: GEOMETRY_COMPARISON_ADAPTER_VERSION,
    },
    evidenceClass: "local-differential-comparison",
  };
  return {
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    adapterVersion: GEOMETRY_COMPARISON_ADAPTER_VERSION,
    fixtureId: envelope?.fixtureId || "rejected-input",
    comparisonKind: kind,
    provenance: envelope ? provenance(envelope, source) : fallbackProvenance,
    status: "rejected" as const,
    baseline: null,
    candidate: null,
    metrics: emptyMetrics(),
    rejectionReason: reason,
  } satisfies GeometryComparisonReceipt<TSnapshot>;
}

function scalarFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function allFinite(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (isRecord(value)) return Object.values(value).every(allFinite);
  return true;
}

function pointDelta(left: RigidPoint, right: RigidPoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function maximum(values: readonly number[]) {
  return values.reduce((current, value) => Math.max(current, value), 0);
}

function plainPoint(value: { x: number; y: number }): RigidPoint {
  return { x: value.x, y: value.y };
}

function polygonArea(points: readonly RigidPoint[]) {
  const origin = points[0];
  let signedDoubleArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const currentX = current.x - origin.x;
    const currentY = current.y - origin.y;
    const nextX = next.x - origin.x;
    const nextY = next.y - origin.y;
    signedDoubleArea += currentX * nextY - nextX * currentY;
  }
  return Math.abs(signedDoubleArea) / 2;
}

function elbowSnapshotFromBaseline(
  geometry: NonNullable<ReturnType<typeof rigidElbowGeometry>>,
): ElbowGeometrySnapshot {
  const inletTrimUnits = Math.hypot(
    geometry.vertex.x - geometry.inlet.x,
    geometry.vertex.y - geometry.inlet.y,
  );
  const outletTrimUnits = Math.hypot(
    geometry.outlet.x - geometry.vertex.x,
    geometry.outlet.y - geometry.vertex.y,
  );
  return {
    inlet: plainPoint(geometry.inlet),
    vertex: plainPoint(geometry.vertex),
    outlet: plainPoint(geometry.outlet),
    inbound: plainPoint(geometry.inbound),
    outbound: plainPoint(geometry.outbound),
    inletTrimUnits,
    outletTrimUnits,
    tangentIntersectionCount: 1,
    tangentAtVertex: true,
  };
}

function elbowSnapshotFromFlatten(
  vertexInput: RigidPoint,
  elbow: RigidElbowMetaV1,
  feetPerUnit: number,
): ElbowGeometrySnapshot {
  const radians = elbow.inboundAngleDegrees * Math.PI / 180;
  const turnRadians = (elbow.turn === "left" ? -1 : 1) * elbow.angleDegrees * Math.PI / 180;
  const inbound = Flatten.vector(Math.cos(radians), Math.sin(radians)).normalize();
  const outbound = inbound.rotate(turnRadians).normalize();
  const vertex = Flatten.point(vertexInput.x, vertexInput.y);
  const inletTrimUnits = elbow.ports.inlet.takeoutInches! / 12 / feetPerUnit;
  const outletTrimUnits = elbow.ports.outlet.takeoutInches! / 12 / feetPerUnit;
  const inlet = vertex.translate(inbound.multiply(-inletTrimUnits));
  const outlet = vertex.translate(outbound.multiply(outletTrimUnits));
  const inletSegment = Flatten.segment(inlet, vertex);
  const outletSegment = Flatten.segment(vertex, outlet);
  const tangentIntersections = inletSegment.isZeroLength() || outletSegment.isZeroLength()
    ? [vertex]
    : inletSegment.intersect(outletSegment);
  const tangentAtVertex = tangentIntersections.length === 1
    && Math.hypot(tangentIntersections[0].x - vertex.x, tangentIntersections[0].y - vertex.y)
      <= GEOMETRY_COMPARISON_TOLERANCE_UNITS;
  return {
    inlet: plainPoint(inlet),
    vertex: plainPoint(vertex),
    outlet: plainPoint(outlet),
    inbound: plainPoint(inbound),
    outbound: plainPoint(outbound),
    inletTrimUnits: inletSegment.length,
    outletTrimUnits: outletSegment.length,
    tangentIntersectionCount: tangentIntersections.length,
    tangentAtVertex,
  };
}

function elbowMetrics(baseline: ElbowGeometrySnapshot, candidate: ElbowGeometrySnapshot) {
  const maxCoordinateDelta = maximum([
    pointDelta(baseline.inlet, candidate.inlet),
    pointDelta(baseline.vertex, candidate.vertex),
    pointDelta(baseline.outlet, candidate.outlet),
    pointDelta(baseline.inbound, candidate.inbound),
    pointDelta(baseline.outbound, candidate.outbound),
  ]);
  const maxScalarDelta = maximum([
    Math.abs(baseline.inletTrimUnits - candidate.inletTrimUnits),
    Math.abs(baseline.outletTrimUnits - candidate.outletTrimUnits),
  ]);
  return {
    maxCoordinateDelta,
    maxScalarDelta,
    baselineFinite: allFinite(baseline),
    candidateFinite: allFinite(candidate),
  } satisfies GeometryComparisonMetrics;
}

export function compareElbowGeometry(input: ElbowGeometryComparisonInput): GeometryComparisonReceipt<ElbowGeometrySnapshot>;
export function compareElbowGeometry(input: unknown): GeometryComparisonReceipt<ElbowGeometrySnapshot>;
export function compareElbowGeometry(input: unknown): GeometryComparisonReceipt<ElbowGeometrySnapshot> {
  if (!validEnvelope(input)) {
    return rejected(input, "elbow-tangent-trim", "invalid-envelope-or-scale");
  }
  const candidateInput = input as typeof input & Partial<ElbowGeometryComparisonInput>;
  if (
    !finitePoint(candidateInput.vertex)
    || !scalarFinite(candidateInput.feetPerUnit)
    || candidateInput.feetPerUnit <= 0
  ) {
    return rejected(input, "elbow-tangent-trim", "invalid-envelope-or-scale");
  }
  const elbow = normalizeRigidElbowMeta(candidateInput.elbow);
  if (!elbow || elbow.ports.inlet.takeoutInches == null || elbow.ports.outlet.takeoutInches == null) {
    return rejected(input, "elbow-tangent-trim", "invalid-elbow");
  }
  const baselineGeometry = rigidElbowGeometry({ ...candidateInput.vertex }, elbow, candidateInput.feetPerUnit);
  if (!baselineGeometry || !allFinite(baselineGeometry)) {
    return rejected(input, "elbow-tangent-trim", "baseline-rejected-geometry");
  }
  const baseline = elbowSnapshotFromBaseline(baselineGeometry);
  const receiptBase = {
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    adapterVersion: GEOMETRY_COMPARISON_ADAPTER_VERSION,
    fixtureId: input.fixtureId,
    comparisonKind: "elbow-tangent-trim" as const,
    provenance: provenance(input, BASELINE_ELBOW_SOURCE),
    baseline,
  };
  try {
    const candidate = elbowSnapshotFromFlatten(candidateInput.vertex, elbow, candidateInput.feetPerUnit);
    const metrics = elbowMetrics(baseline, candidate);
    const match = metrics.baselineFinite
      && metrics.candidateFinite
      && metrics.maxCoordinateDelta! <= GEOMETRY_COMPARISON_TOLERANCE_UNITS
      && metrics.maxScalarDelta! <= GEOMETRY_COMPARISON_TOLERANCE_UNITS
      && candidate.tangentAtVertex
      && candidate.tangentIntersectionCount === baseline.tangentIntersectionCount;
    return {
      ...receiptBase,
      status: match ? "match" : "mismatch",
      candidate,
      metrics,
    };
  } catch {
    return {
      ...receiptBase,
      status: "candidate-error",
      candidate: null,
      metrics: {
        ...emptyMetrics(),
        baselineFinite: allFinite(baseline),
      },
      rejectionReason: "candidate-evaluation-failed",
    };
  }
}

function reducerSnapshotFromBaseline(
  geometry: NonNullable<ReturnType<typeof rigidTransitionPolygon>>,
  inletWidthUnits: number,
  outletWidthUnits: number,
): ReducerGeometrySnapshot {
  const points = geometry.points.map(plainPoint) as ReducerGeometrySnapshot["points"];
  return {
    inlet: plainPoint(geometry.inlet),
    outlet: plainPoint(geometry.outlet),
    axis: plainPoint(geometry.axis),
    normal: plainPoint(geometry.normal),
    lengthUnits: geometry.lengthUnits,
    inletWidthUnits,
    outletWidthUnits,
    points,
    areaUnitsSquared: polygonArea(points),
    polygonValid: polygonArea(points) > GEOMETRY_COMPARISON_TOLERANCE_UNITS,
  };
}

function reducerSnapshotFromFlatten(
  inletInput: RigidPoint,
  transition: RigidTransitionMetaV1,
  feetPerUnit: number,
  inletWidthUnits: number,
  outletWidthUnits: number,
): ReducerGeometrySnapshot {
  const radians = transition.inboundAngleDegrees * Math.PI / 180;
  const axis = Flatten.vector(Math.cos(radians), Math.sin(radians)).normalize();
  const normal = axis.rotate90CCW().normalize();
  const lengthUnits = transition.lengthInches / 12 / feetPerUnit;
  const inlet = Flatten.point(inletInput.x, inletInput.y);
  const outlet = inlet.translate(axis.multiply(lengthUnits));
  const inletHalf = inletWidthUnits / 2;
  const outletHalf = outletWidthUnits / 2;
  const delta = inletHalf - outletHalf;
  const outletOffset = ["top-flat", "left-flat"].includes(transition.alignment)
    ? -delta
    : ["bottom-flat", "right-flat"].includes(transition.alignment)
      ? delta
      : 0;
  const at = (base: Flatten.Point, offset: number) => base.translate(normal.multiply(offset));
  const flattenPoints = [
    at(inlet, -inletHalf),
    at(inlet, inletHalf),
    at(outlet, outletOffset + outletHalf),
    at(outlet, outletOffset - outletHalf),
  ];
  const reducer = new Flatten.Polygon(flattenPoints);
  const points = flattenPoints.map(plainPoint) as ReducerGeometrySnapshot["points"];
  return {
    inlet: plainPoint(inlet),
    outlet: plainPoint(outlet),
    axis: plainPoint(axis),
    normal: plainPoint(normal),
    lengthUnits,
    inletWidthUnits,
    outletWidthUnits,
    points,
    areaUnitsSquared: reducer.area(),
    polygonValid: reducer.isValid() && !reducer.isEmpty(),
  };
}

function reducerMetrics(baseline: ReducerGeometrySnapshot, candidate: ReducerGeometrySnapshot) {
  const maxCoordinateDelta = maximum([
    pointDelta(baseline.inlet, candidate.inlet),
    pointDelta(baseline.outlet, candidate.outlet),
    pointDelta(baseline.axis, candidate.axis),
    pointDelta(baseline.normal, candidate.normal),
    ...baseline.points.map((pointValue, index) => pointDelta(pointValue, candidate.points[index])),
  ]);
  const maxScalarDelta = maximum([
    Math.abs(baseline.lengthUnits - candidate.lengthUnits),
    Math.abs(baseline.inletWidthUnits - candidate.inletWidthUnits),
    Math.abs(baseline.outletWidthUnits - candidate.outletWidthUnits),
    Math.abs(baseline.areaUnitsSquared - candidate.areaUnitsSquared),
  ]);
  return {
    maxCoordinateDelta,
    maxScalarDelta,
    baselineFinite: allFinite(baseline),
    candidateFinite: allFinite(candidate),
  } satisfies GeometryComparisonMetrics;
}

export function compareRectangularReducerGeometry(
  input: RectangularReducerComparisonInput,
): GeometryComparisonReceipt<ReducerGeometrySnapshot>;
export function compareRectangularReducerGeometry(input: unknown): GeometryComparisonReceipt<ReducerGeometrySnapshot>;
export function compareRectangularReducerGeometry(input: unknown): GeometryComparisonReceipt<ReducerGeometrySnapshot> {
  if (!validEnvelope(input)) {
    return rejected(input, "rectangular-reducer-outline", "invalid-envelope-or-scale");
  }
  const candidateInput = input as typeof input & Partial<RectangularReducerComparisonInput>;
  if (
    !finitePoint(candidateInput.inlet)
    || !scalarFinite(candidateInput.feetPerUnit)
    || candidateInput.feetPerUnit <= 0
  ) {
    return rejected(input, "rectangular-reducer-outline", "invalid-envelope-or-scale");
  }
  const transition = normalizeRigidTransitionMeta(candidateInput.transition);
  if (
    !transition
    || transition.construction !== "rectangular"
    || transition.inletSize.shape !== "rectangular"
    || transition.outletSize.shape !== "rectangular"
    || !rigidTransitionIsReduction(transition)
  ) {
    return rejected(input, "rectangular-reducer-outline", "invalid-rectangular-reducer");
  }
  const inletWidthUnits = transition.inletSize.widthInches / 12 / candidateInput.feetPerUnit;
  const outletWidthUnits = transition.outletSize.widthInches / 12 / candidateInput.feetPerUnit;
  if (![inletWidthUnits, outletWidthUnits].every((value) => Number.isFinite(value) && value > 0)) {
    return rejected(input, "rectangular-reducer-outline", "invalid-reducer-width");
  }
  const baselineGeometry = rigidTransitionPolygon({
    inlet: { ...candidateInput.inlet },
    transition,
    feetPerUnit: candidateInput.feetPerUnit,
    inletWidthUnits,
    outletWidthUnits,
  });
  if (!baselineGeometry || !allFinite(baselineGeometry)) {
    return rejected(input, "rectangular-reducer-outline", "baseline-rejected-geometry");
  }
  const baseline = reducerSnapshotFromBaseline(baselineGeometry, inletWidthUnits, outletWidthUnits);
  const receiptBase = {
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    adapterVersion: GEOMETRY_COMPARISON_ADAPTER_VERSION,
    fixtureId: input.fixtureId,
    comparisonKind: "rectangular-reducer-outline" as const,
    provenance: provenance(input, BASELINE_REDUCER_SOURCE),
    baseline,
  };
  try {
    const candidate = reducerSnapshotFromFlatten(
      candidateInput.inlet,
      transition,
      candidateInput.feetPerUnit,
      inletWidthUnits,
      outletWidthUnits,
    );
    const metrics = reducerMetrics(baseline, candidate);
    const match = metrics.baselineFinite
      && metrics.candidateFinite
      && metrics.maxCoordinateDelta! <= GEOMETRY_COMPARISON_TOLERANCE_UNITS
      && metrics.maxScalarDelta! <= GEOMETRY_COMPARISON_TOLERANCE_UNITS
      && baseline.polygonValid
      && candidate.polygonValid;
    return {
      ...receiptBase,
      status: match ? "match" : "mismatch",
      candidate,
      metrics,
    };
  } catch {
    return {
      ...receiptBase,
      status: "candidate-error",
      candidate: null,
      metrics: {
        ...emptyMetrics(),
        baselineFinite: allFinite(baseline),
      },
      rejectionReason: "candidate-evaluation-failed",
    };
  }
}
