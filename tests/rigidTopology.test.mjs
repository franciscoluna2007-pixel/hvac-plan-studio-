import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  createRigidElbow,
  createRigidContinuation,
  emptyRigidStraightTopology,
  inboundAngleForStraight,
  normalizeRigidElbowMeta,
  normalizeRigidStraightTopology,
  projectRigidContinuationPoint,
  rigidElbowGeometry,
  rigidFinishedStraightLength,
  rigidStraightHasConnection,
} = await loadTypescriptModule(new URL("../app/rigidTopology.ts", import.meta.url));

const straight = {
  version: 1,
  kind: "straight",
  networkKind: "supply",
  construction: "rectangular",
  size: { shape: "rectangular", widthInches: 24, heightInches: 12 },
};

test("v11 straight topology starts open with zero takeout and normalizes stable port ids", () => {
  assert.deepEqual(emptyRigidStraightTopology(), {
    version: 1,
    ports: {
      start: { id: "start", takeoutInches: 0 },
      end: { id: "end", takeoutInches: 0 },
    },
  });
  const normalized = normalizeRigidStraightTopology({
    version: 1,
    ports: {
      start: { id: "wrong", takeoutInches: 1.26 },
      end: { id: "end", takeoutInches: null, connectedTo: { drawingId: "elbow-1", portId: "inlet" } },
    },
  });
  assert.equal(normalized.ports.start.id, "start");
  assert.equal(normalized.ports.start.takeoutInches, 1.25);
  assert.deepEqual(normalized.ports.end.connectedTo, { drawingId: "elbow-1", portId: "inlet" });
});

test("finished straight length subtracts explicit takeouts and blocks missing connected takeout", () => {
  const topology = emptyRigidStraightTopology();
  topology.ports.start.takeoutInches = 6;
  topology.ports.end.takeoutInches = 12;
  assert.deepEqual(rigidFinishedStraightLength(20, topology), {
    centerlineFeet: 20,
    finishedFeet: 18.5,
    takeoutFeet: 1.5,
    status: "ready",
  });
  topology.ports.end.takeoutInches = null;
  assert.deepEqual(rigidFinishedStraightLength(20, topology), {
    centerlineFeet: 20,
    finishedFeet: null,
    takeoutFeet: null,
    status: "takeout-required",
  });
});

test("creates explicit 45 and 90 elbows without inferred takeout", () => {
  for (const angleDegrees of [45, 90]) {
    const elbow = createRigidElbow({
      straightId: "straight-1",
      straight,
      straightPortId: "end",
      angleDegrees,
      turn: "right",
      rectangularStyle: "square",
      inboundAngleDegrees: 0,
      inletTakeoutInches: 12,
      outletTakeoutInches: 18,
      fittingId: "elbow-1",
    });
    assert.equal(elbow?.angleDegrees, angleDegrees);
    assert.equal(elbow?.rectangularStyle, "square");
    assert.equal(elbow?.ports.inlet.takeoutInches, 12);
    assert.equal(elbow?.ports.outlet.takeoutInches, 18);
  }
  assert.equal(normalizeRigidElbowMeta({ ...createRigidElbow({
    straightId: "straight-1", straight, straightPortId: "end", angleDegrees: 90,
    turn: "left", inboundAngleDegrees: 0, inletTakeoutInches: 12,
    outletTakeoutInches: 12, fittingId: "elbow-1",
  }), ports: { inlet: { id: "inlet", takeoutInches: null }, outlet: { id: "outlet", takeoutInches: 12 } } })?.ports.inlet.takeoutInches, null);
});

test("derives elbow render geometry from calibrated explicit takeouts", () => {
  const elbow = createRigidElbow({
    straightId: "straight-1", straight, straightPortId: "end", angleDegrees: 90,
    turn: "right", inboundAngleDegrees: 0, inletTakeoutInches: 12,
    outletTakeoutInches: 24, fittingId: "elbow-1",
  });
  assert.ok(elbow);
  assert.equal(inboundAngleForStraight([{ x: 0, y: 0 }, { x: 100, y: 0 }], "end"), 0);
  const geometry = rigidElbowGeometry({ x: 100, y: 100 }, elbow, 1 / 12);
  assert.deepEqual(geometry?.inlet, { x: 88, y: 100 });
  assert.ok(Math.abs(geometry.outlet.x - 100) < 1e-9);
  assert.ok(Math.abs(geometry.outlet.y - 124) < 1e-9);
});

test("uses the same elbow path for supply, return, and fresh rigid networks", () => {
  for (const networkKind of ["supply", "return", "fresh"]) {
    const elbow = createRigidElbow({
      straightId: `${networkKind}-straight`,
      straight: { ...straight, networkKind, construction: "spiral", size: { shape: "round", diameterInches: 10 } },
      straightPortId: "start", angleDegrees: 45, turn: "left", inboundAngleDegrees: 180,
      inletTakeoutInches: 8, outletTakeoutInches: 8, fittingId: `${networkKind}-elbow`,
    });
    assert.equal(elbow?.networkKind, networkKind);
    assert.equal(elbow?.construction, "spiral");
    assert.ok(rigidElbowGeometry({ x: 50, y: 50 }, elbow, 1 / 24));
  }
});

test("creates one reciprocal open-outlet continuation without changing rigid identity", () => {
  const elbow = createRigidElbow({
    straightId: "upstream", straight, straightPortId: "end", angleDegrees: 90,
    turn: "right", rectangularStyle: "radius", inboundAngleDegrees: 0,
    inletTakeoutInches: 12, outletTakeoutInches: 18, fittingId: "elbow-1",
  });
  const continuation = createRigidContinuation({
    elbowId: "elbow-1",
    elbow,
    straightId: "downstream",
  });
  assert.ok(continuation);
  assert.deepEqual(continuation.elbow.ports.outlet.connectedTo, {
    drawingId: "downstream",
    portId: "start",
  });
  assert.deepEqual(continuation.topology.ports.start, {
    id: "start",
    takeoutInches: 18,
    connectedTo: { drawingId: "elbow-1", portId: "outlet" },
  });
  assert.deepEqual(continuation.topology.ports.end, { id: "end", takeoutInches: 0 });
  assert.equal(rigidStraightHasConnection(continuation.topology), true);
  assert.equal(rigidStraightHasConnection(emptyRigidStraightTopology()), false);
  assert.deepEqual(continuation.straight, straight);
  assert.equal(createRigidContinuation({
    elbowId: "elbow-1",
    elbow: continuation.elbow,
    straightId: "duplicate",
  }), null);
});

test("projects continuation gestures onto the explicit elbow outlet ray", () => {
  const elbow = createRigidElbow({
    straightId: "upstream", straight, straightPortId: "end", angleDegrees: 90,
    turn: "right", rectangularStyle: "radius", inboundAngleDegrees: 0,
    inletTakeoutInches: 12, outletTakeoutInches: 24, fittingId: "elbow-1",
  });
  const projection = projectRigidContinuationPoint({
    vertex: { x: 100, y: 100 },
    elbow,
    pointer: { x: 160, y: 180 },
    feetPerUnit: 1 / 12,
  });
  assert.ok(projection);
  assert.ok(Math.abs(projection.point.x - 100) < 1e-9);
  assert.ok(Math.abs(projection.point.y - 180) < 1e-9);
  assert.equal(projection.outletDistance, 24);
  assert.equal(projection.distanceBeyondOutlet, 56);

  const backward = projectRigidContinuationPoint({
    vertex: { x: 100, y: 100 },
    elbow,
    pointer: { x: 100, y: 50 },
    feetPerUnit: 1 / 12,
  });
  assert.deepEqual(backward.point, backward.outlet);
  assert.equal(backward.distanceBeyondOutlet, 0);
});

test("continuation is network-kind agnostic across 45 and 90 degree metal elbows", () => {
  const cases = [
    ["supply", "rectangular", 45],
    ["return", "round-metal", 90],
    ["fresh", "spiral", 45],
  ];
  for (const [networkKind, construction, angleDegrees] of cases) {
    const source = {
      ...straight,
      networkKind,
      construction,
      size: construction === "rectangular"
        ? { shape: "rectangular", widthInches: 20, heightInches: 10 }
        : { shape: "round", diameterInches: 12 },
    };
    const elbow = createRigidElbow({
      straightId: `${networkKind}-upstream`, straight: source, straightPortId: "end",
      angleDegrees, turn: "left", rectangularStyle: "square", inboundAngleDegrees: 30,
      inletTakeoutInches: 10, outletTakeoutInches: 14, fittingId: `${networkKind}-elbow`,
    });
    const continuation = createRigidContinuation({
      elbowId: `${networkKind}-elbow`, elbow, straightId: `${networkKind}-downstream`,
    });
    assert.equal(continuation?.straight.networkKind, networkKind);
    assert.equal(continuation?.straight.construction, construction);
    assert.deepEqual(continuation?.straight.size, source.size);
    assert.equal(continuation?.topology.ports.start.takeoutInches, 14);
  }
});
