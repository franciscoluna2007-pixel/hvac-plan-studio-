import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  createRigidTransition,
  createRigidTransitionContinuation,
  normalizeRigidTerminalConnection,
  normalizeRigidTransitionMeta,
  rigidTransitionGeometry,
  rigidTransitionIsReduction,
  rigidTransitionPolygon,
} = await loadTypescriptModule(new URL("../app/rigidTransitions.ts", import.meta.url));

const rectangular = {
  version: 1,
  kind: "straight",
  networkKind: "supply",
  construction: "rectangular",
  size: { shape: "rectangular", widthInches: 30, heightInches: 10 },
};

test("creates an explicit rectangular transition with reciprocal-ready ports", () => {
  const transition = createRigidTransition({
    fittingId: "transition-1",
    straightId: "straight-1",
    straight: rectangular,
    straightPortId: "end",
    outletSize: { shape: "rectangular", widthInches: 25, heightInches: 10 },
    lengthInches: 18,
    alignment: "top-flat",
    inboundAngleDegrees: 0,
  });
  assert.ok(transition);
  assert.equal(transition.lengthInches, 18);
  assert.equal(transition.alignment, "top-flat");
  assert.deepEqual(transition.ports.inlet.connectedTo, { drawingId: "straight-1", portId: "end" });
  assert.equal(transition.ports.outlet.connectedTo, undefined);
  assert.equal(rigidTransitionIsReduction(transition), true);
});

test("rejects enlargements and same-size fake reducers", () => {
  for (const outletSize of [
    { shape: "rectangular", widthInches: 32, heightInches: 10 },
    { shape: "rectangular", widthInches: 30, heightInches: 10 },
  ]) {
    assert.equal(createRigidTransition({
      fittingId: "transition-1",
      straightId: "straight-1",
      straight: rectangular,
      straightPortId: "end",
      outletSize,
      lengthInches: 12,
      alignment: "centered",
      inboundAngleDegrees: 0,
    }), null);
  }
});

test("creates centered round reducer geometry and reduced-size continuation", () => {
  const round = { ...rectangular, construction: "spiral", size: { shape: "round", diameterInches: 18 } };
  const transition = createRigidTransition({
    fittingId: "reducer-1",
    straightId: "straight-1",
    straight: round,
    straightPortId: "end",
    outletSize: { shape: "round", diameterInches: 16 },
    lengthInches: 12,
    alignment: "top-flat",
    inboundAngleDegrees: 90,
  });
  assert.ok(transition);
  assert.equal(transition.alignment, "centered");
  const geometry = rigidTransitionGeometry({ x: 10, y: 10 }, transition, .1);
  assert.deepEqual(geometry.outlet, { x: 10, y: 20 });
  const polygon = rigidTransitionPolygon({ inlet: { x: 10, y: 10 }, transition, feetPerUnit: .1, inletWidthUnits: 8, outletWidthUnits: 6 });
  assert.equal(polygon.points.length, 4);
  const continuation = createRigidTransitionContinuation({ transitionId: "reducer-1", transition, straightId: "straight-2" });
  assert.ok(continuation);
  assert.equal(continuation.straight.size.diameterInches, 16);
  assert.deepEqual(continuation.topology.ports.start.connectedTo, { drawingId: "reducer-1", portId: "outlet" });
  assert.deepEqual(continuation.transition.ports.outlet.connectedTo, { drawingId: "straight-2", portId: "start" });
});

test("normalizes terminal collars and rejects rectangular terminal construction", () => {
  const collar = normalizeRigidTerminalConnection({
    version: 1,
    kind: "supply-can-collar",
    construction: "round-metal",
    diameterInches: 8,
    collarType: "straight-collar",
    connectedTo: { drawingId: "straight-1", portId: "end" },
  });
  assert.ok(collar);
  assert.equal(collar.diameterInches, 8);
  assert.equal(normalizeRigidTerminalConnection({ ...collar, construction: "rectangular" }), null);
  assert.equal(normalizeRigidTransitionMeta({}), null);
});
