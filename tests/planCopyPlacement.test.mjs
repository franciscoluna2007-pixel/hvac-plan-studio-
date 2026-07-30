import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const copy = await loadTypescriptModule(
  new URL("../app/planCopyPlacement.ts", import.meta.url),
);

function diffuser() {
  return {
    id: "supply-1",
    type: "symbol",
    points: [{ x: 100, y: 80 }],
    page: 1,
    size: "12×12",
    cfm: 225,
    cfmSource: "room-target",
    systemId: "system-1",
    roomName: "Bedroom 2",
    roomType: "bedroom",
    symbol: {
      kind: "diffuser",
      label: "12×12 SUPPLY",
      rotation: 15,
      scaleX: 0.7,
      scaleY: 0.7,
      labelScale: 0.65,
      connectedRunId: "run-9",
      connectedEnd: "end",
      returnRunId: "return-2",
      returnEnd: "start",
      roomMarkup: {
        candidateId: "candidate-1",
        reviewer: "reviewer",
      },
    },
  };
}

test("all standalone HVAC symbols can become immutable mouse templates", () => {
  for (const kind of [
    "diffuser",
    "returnGrille",
    "equipment",
    "fan",
    "damper",
    "motorDamper",
    "reducer",
    "thermostat",
    "smoke",
    "airflow",
    "note",
  ]) {
    const source = diffuser();
    source.symbol.kind = kind;
    const template = copy.buildStandalonePlanCopyTemplate(source, "pdf-a");
    assert.ok(template, kind);
    assert.notEqual(template.source, source);
  }
});

test("placed HVAC copies follow the mouse and shed stale connections and evidence", () => {
  const source = diffuser();
  const template = copy.buildStandalonePlanCopyTemplate(source, "pdf-a");
  const placed = copy.materializeStandalonePlanCopy(template, {
    sourceFingerprint: "pdf-a",
    page: 2,
    point: { x: 440, y: 260 },
    id: "copy-1",
    systemId: "system-2",
    feetPerUnit: 0.25,
  });

  assert.deepEqual(placed.points, [{ x: 440, y: 260 }]);
  assert.equal(placed.id, "copy-1");
  assert.equal(placed.page, 2);
  assert.equal(placed.systemId, "system-2");
  assert.equal(placed.symbol.kind, "diffuser");
  assert.equal(placed.symbol.rotation, 15);
  assert.equal(placed.symbol.scaleX, 0.7);
  assert.equal(placed.symbol.connectedRunId, undefined);
  assert.equal(placed.symbol.returnRunId, undefined);
  assert.equal(placed.symbol.roomMarkup, undefined);
  assert.equal(placed.roomName, undefined);
  assert.equal(placed.roomType, undefined);
  assert.equal(placed.cfmSource, "planning-seed");

  assert.equal(source.symbol.connectedRunId, "run-9");
  assert.equal(template.source.symbol.connectedRunId, "run-9");
});

test("repeated placements mint independent identities from the same source", () => {
  const template = copy.buildStandalonePlanCopyTemplate(diffuser(), "pdf-a");
  const first = copy.materializeStandalonePlanCopy(template, {
    sourceFingerprint: "pdf-a",
    page: 1,
    point: { x: 200, y: 200 },
    id: "copy-1",
  });
  const second = copy.materializeStandalonePlanCopy(template, {
    sourceFingerprint: "pdf-a",
    page: 1,
    point: { x: 300, y: 300 },
    id: "copy-2",
  });

  assert.notEqual(first.id, second.id);
  assert.deepEqual(first.points, [{ x: 200, y: 200 }]);
  assert.deepEqual(second.points, [{ x: 300, y: 300 }]);
});

test("copy placement rejects connected routes and cross-PDF payloads", () => {
  assert.equal(copy.buildStandalonePlanCopyTemplate({
    id: "run-1",
    type: "supply",
    points: [{ x: 0, y: 0 }, { x: 20, y: 20 }],
    page: 1,
    size: "10",
  }, "pdf-a"), null);

  const template = copy.buildStandalonePlanCopyTemplate(diffuser(), "pdf-a");
  assert.equal(copy.materializeStandalonePlanCopy(template, {
    sourceFingerprint: "pdf-b",
    page: 1,
    point: { x: 200, y: 200 },
    id: "copy-1",
  }), null);
});

test("measurement copies use the destination sheet scale", () => {
  const template = copy.buildStandalonePlanCopyTemplate({
    id: "measure-1",
    type: "measurement",
    points: [{ x: 10, y: 10 }, { x: 30, y: 10 }],
    page: 1,
    size: "10.0 FT",
    measurement: { feet: 10 },
  }, "pdf-a");
  const placed = copy.materializeStandalonePlanCopy(template, {
    sourceFingerprint: "pdf-a",
    page: 2,
    point: { x: 100, y: 100 },
    id: "measure-2",
    feetPerUnit: 0.25,
  });

  assert.deepEqual(placed.points, [
    { x: 90, y: 100 },
    { x: 110, y: 100 },
  ]);
  assert.equal(placed.measurement.feet, 5);
  assert.equal(placed.size, "5.0 FT");
});
