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

test("connected supply assemblies copy runs, labels, fittings, and terminal links together", () => {
  const drawings = [
    {
      id: "run-a",
      type: "supply",
      points: [{ x: 0, y: 0 }, { x: 40, y: 0 }],
      page: 1,
      size: "12",
      runNumber: "S-1",
      labelOffset: { x: 4, y: -6 },
      systemId: "system-1",
    },
    {
      id: "fit-a",
      type: "branch",
      points: [{ x: 45, y: 0 }],
      page: 1,
      size: "12x10x8",
      systemId: "system-1",
      fitting: {
        angle: 0,
        branchAngle: Math.PI / 2,
        side: 1,
        style: "tee90",
        connectedIds: ["run-a", "run-b", "run-c"],
      },
    },
    { id: "run-b", type: "supply", points: [{ x: 50, y: 0 }, { x: 90, y: 0 }], page: 1, size: "10", runNumber: "S-2", systemId: "system-1" },
    { id: "run-c", type: "supply", points: [{ x: 45, y: 5 }, { x: 45, y: 45 }], page: 1, size: "8", runNumber: "S-3", systemId: "system-1" },
    {
      id: "terminal-a",
      type: "symbol",
      points: [{ x: 45, y: 45 }],
      page: 1,
      size: "12x12",
      systemId: "system-1",
      symbol: { kind: "diffuser", label: "12x12 SUPPLY", rotation: 0, connectedRunId: "run-c", connectedEnd: "end" },
    },
  ];
  const template = copy.buildPlanAssemblyCopyTemplate(drawings, ["run-a"], "pdf-a");
  assert.equal(template.version, 2);
  assert.deepEqual(template.sources.map((drawing) => drawing.id), ["run-a", "fit-a", "run-b", "run-c", "terminal-a"]);

  const placed = copy.materializePlanAssemblyCopy(template, {
    sourceFingerprint: "pdf-a",
    page: 2,
    point: { x: 300, y: 200 },
    systemId: "system-2",
    idFor: (sourceId) => `copy-${sourceId}`,
  });
  const fitting = placed.find((drawing) => drawing.fitting);
  const terminal = placed.find((drawing) => drawing.symbol);
  assert.deepEqual(fitting.fitting.connectedIds, ["copy-run-a", "copy-run-b", "copy-run-c"]);
  assert.equal(terminal.symbol.connectedRunId, "copy-run-c");
  assert.deepEqual(
    placed.filter((drawing) => drawing.type === "supply").map((drawing) => [drawing.size, drawing.runNumber]),
    [["12", "S-1"], ["10", "S-2"], ["8", "S-3"]],
  );
  assert.ok(placed.every((drawing) => drawing.page === 2 && drawing.systemId === "system-2"));
});

test("repeated assembly pastes remap every identity and never reconnect to the source", () => {
  const drawings = [
    { id: "a", type: "supply", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], page: 1, size: "10" },
    { id: "fit", type: "branch", points: [{ x: 15, y: 0 }], page: 1, size: "10x8x6", fitting: { connectedIds: ["a", "b", "c"] } },
    { id: "b", type: "supply", points: [{ x: 20, y: 0 }, { x: 30, y: 0 }], page: 1, size: "8" },
    { id: "c", type: "supply", points: [{ x: 15, y: 5 }, { x: 15, y: 20 }], page: 1, size: "6" },
  ];
  const template = copy.buildPlanAssemblyCopyTemplate(drawings, ["a"], "pdf-a");
  const first = copy.materializePlanAssemblyCopy(template, {
    sourceFingerprint: "pdf-a", page: 1, point: { x: 100, y: 100 }, idFor: (id) => `one-${id}`,
  });
  const second = copy.materializePlanAssemblyCopy(template, {
    sourceFingerprint: "pdf-a", page: 1, point: { x: 200, y: 200 }, idFor: (id) => `two-${id}`,
  });
  assert.equal(new Set([...first, ...second].map((drawing) => drawing.id)).size, 8);
  assert.ok(first.find((drawing) => drawing.fitting).fitting.connectedIds.every((id) => id.startsWith("one-")));
  assert.ok(second.find((drawing) => drawing.fitting).fitting.connectedIds.every((id) => id.startsWith("two-")));
});
