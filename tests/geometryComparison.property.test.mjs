import assert from "node:assert/strict";
import test from "node:test";

import fc from "fast-check";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  FLATTEN_JS_CANDIDATE_VERSION,
  GEOMETRY_COMPARISON_CONTRACT_VERSION,
  GEOMETRY_COMPARISON_TOLERANCE_UNITS,
  compareElbowGeometry,
  compareRectangularReducerGeometry,
} = await loadTypescriptModule(new URL("../app/geometryComparison.ts", import.meta.url));

const provenance = {
  baselineRevision: "geometry-property-test-baseline",
  candidatePackageVersion: FLATTEN_JS_CANDIDATE_VERSION,
};

const finiteCoordinate = fc.double({ min: -10_000, max: 10_000, noNaN: true, noDefaultInfinity: true });
const feetPerUnitArbitrary = fc.integer({ min: 1, max: 400 }).map((value) => value / 100);
const quarterInches = fc.integer({ min: 0, max: 480 }).map((value) => value / 4);

const elbowArbitrary = fc.record({
  x: finiteCoordinate,
  y: finiteCoordinate,
  inboundAngleDegrees: fc.double({ min: -720, max: 720, noNaN: true, noDefaultInfinity: true }),
  angleDegrees: fc.constantFrom(45, 90),
  turn: fc.constantFrom("left", "right"),
  construction: fc.constantFrom("rectangular", "round-metal", "spiral"),
  inletTakeoutInches: quarterInches,
  outletTakeoutInches: quarterInches,
  feetPerUnit: feetPerUnitArbitrary,
});

function elbowInput(sample) {
  const rectangular = sample.construction === "rectangular";
  return {
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    fixtureId: "generated-elbow",
    provenance,
    vertex: { x: sample.x, y: sample.y },
    elbow: {
      version: 1,
      kind: "elbow",
      networkKind: "supply",
      construction: sample.construction,
      size: rectangular
        ? { shape: "rectangular", widthInches: 24, heightInches: 10 }
        : { shape: "round", diameterInches: 16 },
      angleDegrees: sample.angleDegrees,
      turn: sample.turn,
      ...(rectangular ? { rectangularStyle: "radius" } : {}),
      inboundAngleDegrees: sample.inboundAngleDegrees,
      ports: {
        inlet: { id: "inlet", takeoutInches: sample.inletTakeoutInches },
        outlet: { id: "outlet", takeoutInches: sample.outletTakeoutInches },
      },
    },
    feetPerUnit: sample.feetPerUnit,
  };
}

test("property: Flatten elbow tangents preserve the production takeout geometry", () => {
  fc.assert(fc.property(elbowArbitrary, (sample) => {
    const input = elbowInput(sample);
    const receipt = compareElbowGeometry(input);
    assert.equal(receipt.status, "match");
    assert.equal(receipt.candidate.tangentAtVertex, true);
    assert.equal(receipt.candidate.tangentIntersectionCount, 1);
    assert.ok(receipt.metrics.maxCoordinateDelta <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
    assert.ok(receipt.metrics.maxScalarDelta <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
    const expectedInlet = sample.inletTakeoutInches / 12 / sample.feetPerUnit;
    const expectedOutlet = sample.outletTakeoutInches / 12 / sample.feetPerUnit;
    assert.ok(Math.abs(receipt.candidate.inletTrimUnits - expectedInlet) <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
    assert.ok(Math.abs(receipt.candidate.outletTrimUnits - expectedOutlet) <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
    assert.deepEqual(receipt, compareElbowGeometry(structuredClone(input)));
  }), { seed: 0x48_56_41_43, numRuns: 500, endOnFailure: true });
});

const reducerArbitrary = fc.record({
  x: finiteCoordinate,
  y: finiteCoordinate,
  angle: fc.double({ min: -720, max: 720, noNaN: true, noDefaultInfinity: true }),
  inletWidthQuarter: fc.integer({ min: 8, max: 480 }),
  widthReductionSeed: fc.nat({ max: 10_000 }),
  inletHeightQuarter: fc.integer({ min: 8, max: 480 }),
  heightReductionSeed: fc.nat({ max: 10_000 }),
  lengthQuarter: fc.integer({ min: 4, max: 960 }),
  alignment: fc.constantFrom("centered", "top-flat", "bottom-flat", "left-flat", "right-flat"),
  feetPerUnit: feetPerUnitArbitrary,
}).map((sample) => {
  const outletWidthQuarter = 4 + (sample.widthReductionSeed % (sample.inletWidthQuarter - 3));
  const maximumOutletHeightQuarter = sample.inletHeightQuarter;
  const outletHeightQuarter = 4 + (sample.heightReductionSeed % (maximumOutletHeightQuarter - 3));
  return {
    ...sample,
    outletWidthQuarter: Math.min(outletWidthQuarter, sample.inletWidthQuarter - 1),
    outletHeightQuarter: Math.min(outletHeightQuarter, sample.inletHeightQuarter),
  };
});

function reducerInput(sample) {
  return {
    contractVersion: GEOMETRY_COMPARISON_CONTRACT_VERSION,
    fixtureId: "generated-rectangular-reducer",
    provenance,
    inlet: { x: sample.x, y: sample.y },
    transition: {
      version: 1,
      kind: "transition",
      networkKind: "supply",
      construction: "rectangular",
      inletSize: {
        shape: "rectangular",
        widthInches: sample.inletWidthQuarter / 4,
        heightInches: sample.inletHeightQuarter / 4,
      },
      outletSize: {
        shape: "rectangular",
        widthInches: sample.outletWidthQuarter / 4,
        heightInches: sample.outletHeightQuarter / 4,
      },
      lengthInches: sample.lengthQuarter / 4,
      alignment: sample.alignment,
      inboundAngleDegrees: sample.angle,
      ports: {
        inlet: { id: "inlet", takeoutInches: 0 },
        outlet: { id: "outlet", takeoutInches: 0 },
      },
    },
    feetPerUnit: sample.feetPerUnit,
  };
}

test("property: Flatten reducer polygons preserve baseline points, area, and deterministic receipts", () => {
  fc.assert(fc.property(reducerArbitrary, (sample) => {
    const input = reducerInput(sample);
    const receipt = compareRectangularReducerGeometry(input);
    assert.equal(receipt.status, "match");
    assert.equal(receipt.candidate.polygonValid, true);
    assert.ok(receipt.metrics.maxCoordinateDelta <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
    assert.ok(receipt.metrics.maxScalarDelta <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
    const expectedArea = receipt.candidate.lengthUnits
      * (receipt.candidate.inletWidthUnits + receipt.candidate.outletWidthUnits) / 2;
    assert.ok(Math.abs(receipt.candidate.areaUnitsSquared - expectedArea) <= GEOMETRY_COMPARISON_TOLERANCE_UNITS);
    assert.deepEqual(receipt, compareRectangularReducerGeometry(structuredClone(input)));
  }), { seed: 0x52_45_44_55, numRuns: 500, endOnFailure: true });
});

test("property: non-positive and non-finite scales fail closed without candidate evidence", () => {
  const invalidScale = fc.constantFrom(0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY);
  fc.assert(fc.property(elbowArbitrary, invalidScale, (sample, feetPerUnit) => {
    const receipt = compareElbowGeometry({ ...elbowInput(sample), feetPerUnit });
    assert.equal(receipt.status, "rejected");
    assert.equal(receipt.baseline, null);
    assert.equal(receipt.candidate, null);
    assert.equal(receipt.metrics.candidateFinite, false);
  }), { seed: 0x46_41_49_4c, numRuns: 100, endOnFailure: true });
});
