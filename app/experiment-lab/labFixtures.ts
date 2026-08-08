import {
  compareElbowGeometry,
  compareRectangularReducerGeometry,
  FLATTEN_JS_CANDIDATE_VERSION,
  GEOMETRY_COMPARISON_CONTRACT_VERSION,
  type ElbowGeometrySnapshot,
  type GeometryComparisonReceipt,
  type ReducerGeometrySnapshot,
} from "../geometryComparison";

export type GeometryExperimentId = "elbow" | "reducer";

export type ElbowLabInputs = {
  vertexX: number;
  vertexY: number;
  feetPerUnit: number;
  widthInches: number;
  heightInches: number;
  angleDegrees: 45 | 90;
  turn: "left" | "right";
  rectangularStyle: "radius" | "square";
  inboundAngleDegrees: number;
  inletTakeoutInches: number;
  outletTakeoutInches: number;
};

export type ReducerLabInputs = {
  inletX: number;
  inletY: number;
  feetPerUnit: number;
  inletWidthInches: number;
  inletHeightInches: number;
  outletWidthInches: number;
  outletHeightInches: number;
  lengthInches: number;
  alignment: "centered" | "top-flat" | "bottom-flat" | "left-flat" | "right-flat";
  inboundAngleDegrees: number;
};

export type GeometryLabInputs = {
  elbow: ElbowLabInputs;
  reducer: ReducerLabInputs;
};

export type GeometryLabReceipt =
  | GeometryComparisonReceipt<ElbowGeometrySnapshot>
  | GeometryComparisonReceipt<ReducerGeometrySnapshot>;

export type CompletedGeometryRun = {
  runId: string;
  startedAt: string;
  completedAt: string;
  sourceContext: "isolated experiment route";
  receipt: GeometryLabReceipt;
};

export const BASELINE_REVISION = "231ee17a2e8709a897fdf629f2ded9f5865a52fa";

export const experimentDefinitions = {
  elbow: {
    label: "Elbow tangent trim",
    shortLabel: "Elbow",
    description: "Compare the current rigid-elbow tangent geometry with the Flatten.js adapter.",
    fixtureId: "live-elbow-tangent-v1",
  },
  reducer: {
    label: "Rectangular reducer outline",
    shortLabel: "Reducer",
    description: "Compare the current rectangular transition polygon with the Flatten.js adapter.",
    fixtureId: "live-rectangular-reducer-v1",
  },
} as const;

export const initialGeometryInputs: GeometryLabInputs = {
  elbow: {
    vertexX: 300,
    vertexY: 230,
    feetPerUnit: 1,
    widthInches: 30,
    heightInches: 10,
    angleDegrees: 90,
    turn: "right",
    rectangularStyle: "radius",
    inboundAngleDegrees: 0,
    inletTakeoutInches: 30,
    outletTakeoutInches: 30,
  },
  reducer: {
    inletX: 210,
    inletY: 250,
    feetPerUnit: 1,
    inletWidthInches: 30,
    inletHeightInches: 10,
    outletWidthInches: 24,
    outletHeightInches: 10,
    lengthInches: 24,
    alignment: "centered",
    inboundAngleDegrees: 0,
  },
};

const provenance = {
  baselineRevision: BASELINE_REVISION,
  candidatePackageVersion: FLATTEN_JS_CANDIDATE_VERSION,
} as const;

export function runGeometryComparison(
  experimentId: GeometryExperimentId,
  inputs: GeometryLabInputs,
  startedAt = new Date(),
): CompletedGeometryRun {
  const receipt = previewGeometryComparison(experimentId, inputs);

  const completedAt = new Date();
  return {
    runId: `${experimentId}-${startedAt.getTime()}`,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    sourceContext: "isolated experiment route",
    receipt,
  };
}

export function previewGeometryComparison(
  experimentId: GeometryExperimentId,
  inputs: GeometryLabInputs,
): GeometryLabReceipt {
  return experimentId === "elbow"
    ? compareElbowGeometry({
      contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
      fixtureId: experimentDefinitions.elbow.fixtureId,
      provenance,
      vertex: { x: inputs.elbow.vertexX, y: inputs.elbow.vertexY },
      feetPerUnit: inputs.elbow.feetPerUnit,
      elbow: {
        version: 1,
        kind: "elbow",
        networkKind: "supply",
        construction: "rectangular",
        size: {
          shape: "rectangular",
          widthInches: inputs.elbow.widthInches,
          heightInches: inputs.elbow.heightInches,
        },
        angleDegrees: inputs.elbow.angleDegrees,
        turn: inputs.elbow.turn,
        rectangularStyle: inputs.elbow.rectangularStyle,
        inboundAngleDegrees: inputs.elbow.inboundAngleDegrees,
        ports: {
          inlet: { id: "inlet", takeoutInches: inputs.elbow.inletTakeoutInches },
          outlet: { id: "outlet", takeoutInches: inputs.elbow.outletTakeoutInches },
        },
      },
    })
    : compareRectangularReducerGeometry({
      contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
      fixtureId: experimentDefinitions.reducer.fixtureId,
      provenance,
      inlet: { x: inputs.reducer.inletX, y: inputs.reducer.inletY },
      feetPerUnit: inputs.reducer.feetPerUnit,
      transition: {
        version: 1,
        kind: "transition",
        networkKind: "supply",
        construction: "rectangular",
        inletSize: {
          shape: "rectangular",
          widthInches: inputs.reducer.inletWidthInches,
          heightInches: inputs.reducer.inletHeightInches,
        },
        outletSize: {
          shape: "rectangular",
          widthInches: inputs.reducer.outletWidthInches,
          heightInches: inputs.reducer.outletHeightInches,
        },
        lengthInches: inputs.reducer.lengthInches,
        alignment: inputs.reducer.alignment,
        inboundAngleDegrees: inputs.reducer.inboundAngleDegrees,
        ports: {
          inlet: { id: "inlet", takeoutInches: 0 },
          outlet: { id: "outlet", takeoutInches: 0 },
        },
      },
    });
}

export function formatCoordinate(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "Not available";
  return value === 0 ? "0" : value.toExponential(3);
}
