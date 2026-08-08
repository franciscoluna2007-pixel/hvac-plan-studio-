import type {
  ElbowGeometrySnapshot,
  ReducerGeometrySnapshot,
} from "../geometryComparison";
import type { GeometryExperimentId } from "./labFixtures";

type Snapshot = ElbowGeometrySnapshot | ReducerGeometrySnapshot;

type LabPlanCanvasProps = {
  experimentId: GeometryExperimentId;
  snapshot: Snapshot | null;
  comparisonSnapshot?: Snapshot | null;
  variant: "baseline" | "candidate" | "overlay";
};

type Point = { x: number; y: number };

function pointsFor(experimentId: GeometryExperimentId, snapshot: Snapshot) {
  if (experimentId === "elbow") {
    const elbow = snapshot as ElbowGeometrySnapshot;
    return [elbow.inlet, elbow.vertex, elbow.outlet];
  }
  return (snapshot as ReducerGeometrySnapshot).points;
}

function boundsFor(experimentId: GeometryExperimentId, snapshots: readonly Snapshot[]) {
  const points = snapshots.flatMap((snapshot) => pointsFor(experimentId, snapshot));
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const padding = Math.max(width, height) * 0.42 + 1;
  return {
    x: minX - padding,
    y: minY - padding,
    width: width + padding * 2,
    height: height + padding * 2,
  };
}

function pointList(points: readonly Point[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function GeometryShape({
  experimentId,
  snapshot,
  className,
  markerRadius,
}: {
  experimentId: GeometryExperimentId;
  snapshot: Snapshot;
  className: string;
  markerRadius: number;
}) {
  if (experimentId === "elbow") {
    const elbow = snapshot as ElbowGeometrySnapshot;
    return (
      <g className={className}>
        <path
          d={`M ${elbow.inlet.x} ${elbow.inlet.y} L ${elbow.vertex.x} ${elbow.vertex.y} L ${elbow.outlet.x} ${elbow.outlet.y}`}
          className="lab-live-centerline"
        />
        <line
          x1={elbow.vertex.x - elbow.inbound.x * elbow.inletTrimUnits * 1.45}
          y1={elbow.vertex.y - elbow.inbound.y * elbow.inletTrimUnits * 1.45}
          x2={elbow.vertex.x}
          y2={elbow.vertex.y}
          className="lab-live-guide"
        />
        <line
          x1={elbow.vertex.x}
          y1={elbow.vertex.y}
          x2={elbow.vertex.x + elbow.outbound.x * elbow.outletTrimUnits * 1.45}
          y2={elbow.vertex.y + elbow.outbound.y * elbow.outletTrimUnits * 1.45}
          className="lab-live-guide"
        />
        <circle cx={elbow.inlet.x} cy={elbow.inlet.y} r={markerRadius} className="lab-live-point" />
        <circle cx={elbow.vertex.x} cy={elbow.vertex.y} r={markerRadius * 1.25} className="lab-live-vertex" />
        <circle cx={elbow.outlet.x} cy={elbow.outlet.y} r={markerRadius} className="lab-live-point" />
      </g>
    );
  }

  const reducer = snapshot as ReducerGeometrySnapshot;
  return (
    <g className={className}>
      <polygon points={pointList(reducer.points)} className="lab-live-polygon" />
      <line
        x1={reducer.inlet.x}
        y1={reducer.inlet.y}
        x2={reducer.outlet.x}
        y2={reducer.outlet.y}
        className="lab-live-centerline"
      />
      <circle cx={reducer.inlet.x} cy={reducer.inlet.y} r={markerRadius} className="lab-live-point" />
      <circle cx={reducer.outlet.x} cy={reducer.outlet.y} r={markerRadius} className="lab-live-point" />
    </g>
  );
}

export function LabPlanCanvas({
  experimentId,
  snapshot,
  comparisonSnapshot = null,
  variant,
}: LabPlanCanvasProps) {
  const available = [snapshot, comparisonSnapshot].filter((item): item is Snapshot => Boolean(item));
  if (!snapshot || available.length === 0) {
    return (
      <div className="lab-plan-viewport lab-plan-empty" data-testid={`${variant}-canvas`}>
        <span>The current inputs cannot be drawn. Check the values, then run again.</span>
      </div>
    );
  }

  const bounds = boundsFor(experimentId, available);
  const markerRadius = Math.max(bounds.width, bounds.height) * .012;
  const label = variant === "baseline"
    ? "Product baseline geometry"
    : variant === "candidate"
      ? "Flatten.js candidate geometry"
      : "Baseline and candidate difference overlay";
  const description = variant === "overlay"
    ? "Geometry rendered directly from the completed comparison receipt."
    : "Live geometry redraw from the current inputs. This preview is not an evidence receipt.";

  return (
    <div className="lab-plan-viewport" data-testid={`${variant}-canvas`}>
      <svg
        className="lab-plan-svg"
        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
        role="img"
        aria-label={`${label} for ${experimentId}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{label}</title>
        <desc>{description}</desc>
        <g className="lab-live-grid" aria-hidden="true">
          <line x1={bounds.x} y1={bounds.y + bounds.height / 2} x2={bounds.x + bounds.width} y2={bounds.y + bounds.height / 2} />
          <line x1={bounds.x + bounds.width / 2} y1={bounds.y} x2={bounds.x + bounds.width / 2} y2={bounds.y + bounds.height} />
        </g>
        {variant === "overlay" && comparisonSnapshot ? (
          <>
            <GeometryShape experimentId={experimentId} snapshot={snapshot} className="lab-shape-baseline" markerRadius={markerRadius} />
            <GeometryShape experimentId={experimentId} snapshot={comparisonSnapshot} className="lab-shape-candidate lab-shape-overlay" markerRadius={markerRadius} />
          </>
        ) : (
          <GeometryShape
            experimentId={experimentId}
            snapshot={snapshot}
            className={variant === "baseline" ? "lab-shape-baseline" : "lab-shape-candidate"}
            markerRadius={markerRadius}
          />
        )}
      </svg>
      {variant === "overlay" && (
        <div className="lab-overlay-legend" aria-label="Difference overlay legend">
          <span className="baseline">Product baseline</span>
          <span className="candidate">Flatten.js candidate</span>
        </div>
      )}
    </div>
  );
}
