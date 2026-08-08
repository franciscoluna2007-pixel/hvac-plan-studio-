import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  FLATTEN_JS_CANDIDATE_VERSION,
  GEOMETRY_COMPARISON_CONTRACT_VERSION,
  GEOMETRY_COMPARISON_TOLERANCE_UNITS,
  compareElbowGeometry,
  compareRectangularReducerGeometry,
} = await loadTypescriptModule(new URL("../app/geometryComparison.ts", import.meta.url));

const provenance = {
  baselineRevision: "geometry-comparison-test-baseline",
  candidatePackageVersion: FLATTEN_JS_CANDIDATE_VERSION,
};

function rectangularElbow(overrides = {}) {
  return {
    version: 1,
    kind: "elbow",
    networkKind: "supply",
    construction: "rectangular",
    size: { shape: "rectangular", widthInches: 30, heightInches: 10 },
    angleDegrees: 90,
    turn: "right",
    rectangularStyle: "radius",
    inboundAngleDegrees: 0,
    ports: {
      inlet: { id: "inlet", takeoutInches: 12 },
      outlet: { id: "outlet", takeoutInches: 24 },
    },
    ...overrides,
  };
}

function rectangularReducer(overrides = {}) {
  return {
    version: 1,
    kind: "transition",
    networkKind: "supply",
    construction: "rectangular",
    inletSize: { shape: "rectangular", widthInches: 30, heightInches: 10 },
    outletSize: { shape: "rectangular", widthInches: 18, heightInches: 8 },
    lengthInches: 24,
    alignment: "top-flat",
    inboundAngleDegrees: 0,
    ports: {
      inlet: { id: "inlet", takeoutInches: 0 },
      outlet: { id: "outlet", takeoutInches: 0 },
    },
    ...overrides,
  };
}

test("compares a real 90-degree elbow tangent and takeout trim without mutating the input", () => {
  const input = {
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    fixtureId: "elbow-90-right",
    provenance,
    vertex: { x: 10, y: 20 },
    elbow: rectangularElbow(),
    feetPerUnit: 0.25,
  };
  const before = structuredClone(input);
  const receipt = compareElbowGeometry(input);

  assert.equal(receipt.status, "match");
  assert.equal(receipt.provenance.baseline.source, "app/rigidTopology.rigidElbowGeometry");
  assert.equal(receipt.provenance.candidate.package, "@flatten-js/core");
  assert.equal(receipt.provenance.candidate.packageVersion, "1.6.12");
  assert.deepEqual(receipt.baseline.inlet, { x: 6, y: 20 });
  assert.ok(Math.abs(receipt.baseline.outlet.x - 10) <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
  assert.ok(Math.abs(receipt.baseline.outlet.y - 28) <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
  assert.equal(receipt.candidate.tangentIntersectionCount, 1);
  assert.equal(receipt.candidate.tangentAtVertex, true);
  assert.ok(receipt.metrics.maxCoordinateDelta <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
  assert.ok(receipt.metrics.maxScalarDelta <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
  assert.deepEqual(input, before);
});

test("compares a real rectangular reducer outline and Flatten polygon evidence", () => {
  const receipt = compareRectangularReducerGeometry({
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    fixtureId: "reducer-30x10-to-18x8-top-flat",
    provenance,
    inlet: { x: 0, y: 0 },
    transition: rectangularReducer(),
    feetPerUnit: 0.25,
  });

  assert.equal(receipt.status, "match");
  assert.equal(receipt.provenance.baseline.source, "app/rigidTransitions.rigidTransitionPolygon");
  assert.equal(receipt.baseline.inletWidthUnits, 10);
  assert.equal(receipt.baseline.outletWidthUnits, 6);
  assert.equal(receipt.baseline.lengthUnits, 8);
  assert.deepEqual(receipt.baseline.points, [
    { x: 0, y: -5 },
    { x: 0, y: 5 },
    { x: 8, y: 1 },
    { x: 8, y: -5 },
  ]);
  assert.equal(receipt.candidate.polygonValid, true);
  assert.equal(receipt.candidate.areaUnitsSquared, 64);
  assert.ok(receipt.metrics.maxCoordinateDelta <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
  assert.ok(receipt.metrics.maxScalarDelta <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
});

test("keeps reducer area parity translation-invariant at large plan coordinates", () => {
  const transition = rectangularReducer({
    inletSize: { shape: "rectangular", widthInches: 43.25, heightInches: 3.75 },
    outletSize: { shape: "rectangular", widthInches: 38, heightInches: 1.25 },
    lengthInches: 8.75,
    alignment: "top-flat",
    inboundAngleDegrees: 6.408269177766851e-78,
  });
  const at = (inlet, fixtureId) => compareRectangularReducerGeometry({
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    fixtureId,
    provenance,
    inlet,
    transition,
    feetPerUnit: 2.28,
  });
  const origin = at({ x: 0, y: 0 }, "reducer-area-origin");
  const translated = at(
    { x: 9999.999999999965, y: 9999.99999999997 },
    "reducer-area-large-translation",
  );

  assert.equal(origin.status, "match");
  assert.equal(translated.status, "match");
  assert.ok(translated.metrics.maxScalarDelta <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
  assert.ok(
    Math.abs(origin.baseline.areaUnitsSquared - translated.baseline.areaUnitsSquared)
      <= GEOMETRY_COMPARISON_TOLERANCE_UNITS,
  );
});

test("is deterministic for identical versioned inputs", () => {
  const input = {
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    fixtureId: "deterministic-elbow",
    provenance,
    vertex: { x: -13.25, y: 42.5 },
    elbow: rectangularElbow({ angleDegrees: 45, turn: "left", inboundAngleDegrees: 137.5 }),
    feetPerUnit: 0.125,
  };
  assert.deepEqual(compareElbowGeometry(input), compareElbowGeometry(structuredClone(input)));
});

test("fails closed for stale provenance, non-finite geometry, and non-reducer transitions", () => {
  const commonElbow = {
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    fixtureId: "rejected-elbow",
    provenance,
    vertex: { x: 0, y: 0 },
    elbow: rectangularElbow(),
    feetPerUnit: 0.25,
  };
  const stale = compareElbowGeometry({
    ...commonElbow,
    provenance: { ...provenance, candidatePackageVersion: "1.6.11" },
  });
  assert.equal(stale.status, "rejected");
  assert.equal(stale.baseline, null);
  assert.equal(stale.candidate, null);

  const nonFinite = compareElbowGeometry({ ...commonElbow, vertex: { x: Number.NaN, y: 0 } });
  assert.equal(nonFinite.status, "rejected");
  assert.equal(nonFinite.metrics.candidateFinite, false);

  const sameSize = compareRectangularReducerGeometry({
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    fixtureId: "not-a-reducer",
    provenance,
    inlet: { x: 0, y: 0 },
    transition: rectangularReducer({
      outletSize: { shape: "rectangular", widthInches: 30, heightInches: 10 },
    }),
    feetPerUnit: 0.25,
  });
  assert.equal(sameSize.status, "rejected");
  assert.equal(sameSize.rejectionReason, "invalid-rectangular-reducer");
});
