import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  CURRENT_PROJECT_SCHEMA_VERSION,
  migrateSavedProject,
} = await loadTypescriptModule(new URL("../app/projectSchema.ts", import.meta.url));

const legacyDrawing = {
  id: "supply-1",
  type: "supply",
  points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
  size: "8",
  page: 1,
};

test("migrates representative legacy saves without changing their drawings", () => {
  for (const version of [1, 5, 9]) {
    const input = { version, fileName: "fixture.pdf", drawings: [legacyDrawing], savedAt: "now" };
    const before = structuredClone(input);
    const result = migrateSavedProject(input);
    assert.equal(result.ok, true);
    assert.equal(result.project.version, CURRENT_PROJECT_SCHEMA_VERSION);
    assert.deepEqual(result.project.drawings, [legacyDrawing]);
    assert.deepEqual(input, before);
  }
});

test("migrates Phase 1 straight duct into canonical v11 topology", () => {
  const drawings = [
    {
      id: "rect-1", type: "rigid", page: 1, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], size: "wrong",
      rigid: { version: 1, kind: "straight", networkKind: "supply", construction: "rectangular", size: { shape: "rectangular", widthInches: 24, heightInches: 12 } },
    },
    ...["round-metal", "spiral"].map((construction, index) => ({
      id: `round-${index}`, type: "rigid", page: 1, points: [{ x: 0, y: index + 1 }, { x: 100, y: index + 1 }], size: "wrong",
      rigid: { version: 1, kind: "straight", networkKind: "return", construction, size: { shape: "round", diameterInches: 10 } },
    })),
  ];
  const first = migrateSavedProject({ version: 10, fileName: "fixture.pdf", savedAt: "now", drawings });
  assert.equal(first.ok, true);
  assert.deepEqual(first.project.drawings.map((drawing) => drawing.size), ["24×12", "10", "10"]);
  assert.ok(first.project.drawings.every((drawing) => drawing.rigidTopology?.ports.start.takeoutInches === 0));
  const second = migrateSavedProject(first.project);
  assert.equal(second.ok, true);
  assert.deepEqual(second.project, first.project);
});

test("round-trips explicit v11 elbow topology and takeouts", () => {
  const fitting = {
    id: "elbow-1", type: "rigid-fitting", page: 1, points: [{ x: 100, y: 100 }],
    rigidFitting: {
      version: 1, kind: "elbow", networkKind: "supply", construction: "rectangular",
      size: { shape: "rectangular", widthInches: 24, heightInches: 12 },
      angleDegrees: 90, turn: "right", rectangularStyle: "radius", inboundAngleDegrees: 0,
      ports: {
        inlet: { id: "inlet", takeoutInches: 12, connectedTo: { drawingId: "rect-1", portId: "end" } },
        outlet: { id: "outlet", takeoutInches: 18 },
      },
    },
  };
  const first = migrateSavedProject({ version: 11, drawings: [fitting] });
  assert.equal(first.ok, true);
  assert.deepEqual(first.project.drawings, [fitting]);
  const second = migrateSavedProject(first.project);
  assert.equal(second.ok, true);
  assert.deepEqual(second.project, first.project);
});

test("migrates v11 transitions and rigid supply-can collars into the current schema", () => {
  const drawings = [
    {
      id: "transition-1", type: "rigid-fitting", page: 1, points: [{ x: 10, y: 10 }],
      rigidTransition: {
        version: 1, kind: "transition", networkKind: "supply", construction: "rectangular",
        inletSize: { shape: "rectangular", widthInches: 30, heightInches: 10 },
        outletSize: { shape: "rectangular", widthInches: 25, heightInches: 10 },
        lengthInches: 18, alignment: "centered", inboundAngleDegrees: 0,
        ports: {
          inlet: { id: "inlet", takeoutInches: 0, connectedTo: { drawingId: "straight-1", portId: "end" } },
          outlet: { id: "outlet", takeoutInches: 0 },
        },
      },
    },
    {
      id: "can-1", type: "symbol", page: 1, points: [{ x: 20, y: 10 }], size: "12×12",
      symbol: {
        kind: "diffuser", label: "Supply can", rotation: 0, variant: "supply-can", neckSize: "8",
        rigidTerminal: {
          version: 1, kind: "supply-can-collar", construction: "spiral", diameterInches: 8,
          collarType: "straight-collar", connectedTo: { drawingId: "straight-2", portId: "end" },
        },
      },
    },
  ];
  const result = migrateSavedProject({ version: 11, drawings });
  assert.equal(result.ok, true);
  assert.equal(result.project.version, CURRENT_PROJECT_SCHEMA_VERSION);
  assert.deepEqual(result.project.drawings, drawings);
  assert.deepEqual(migrateSavedProject(result.project).project, result.project);
});

test("migrates schema v12 return-can collars into canonical schema v13", () => {
  const returnCan = {
    id: "return-can-1", type: "symbol", page: 1, points: [{ x: 20, y: 10 }], size: "20×12",
    symbol: {
      kind: "returnGrille", label: "Return can", rotation: 0, variant: "return-can", neckSize: "12",
      rigidTerminal: {
        version: 1, kind: "return-can-collar", construction: "round-metal", diameterInches: 12,
        collarType: "straight-collar", connectedTo: { drawingId: "return-straight", portId: "start" },
      },
    },
  };
  const result = migrateSavedProject({ version: 12, drawings: [returnCan] });
  assert.equal(result.ok, true);
  assert.equal(result.project.version, 13);
  assert.deepEqual(result.project.drawings, [returnCan]);
  assert.deepEqual(migrateSavedProject(result.project).project, result.project);
});

test("quarantines only invalid rigid objects and rejects unsafe envelopes", () => {
  const invalidRigid = {
    id: "bad-rigid", type: "rigid", page: 1, points: [{ x: 0, y: 0 }], size: "8",
    rigid: { version: 1, kind: "straight", networkKind: "supply", construction: "spiral", size: { shape: "rectangular", widthInches: 8, heightInches: 8 } },
  };
  const result = migrateSavedProject({ version: 9, drawings: [legacyDrawing, invalidRigid] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.project.drawings, [legacyDrawing]);
  assert.equal(result.project.rigidDrawingQuarantine.length, 1);
  assert.match(result.warnings[0], /1 invalid rigid drawing was quarantined/);
  assert.deepEqual(migrateSavedProject({ version: 99, drawings: [] }), { ok: false, reason: "unsupported-version" });
  assert.deepEqual(migrateSavedProject({ version: 9, drawings: "nope" }), { ok: false, reason: "malformed-project" });
});

test("quarantines unsafe transition geometry and strips malformed terminal metadata", () => {
  const unsafeTransition = {
    id: "bad-transition", type: "rigid-fitting", page: 1, points: [{ x: 10, y: 10 }],
    rigidTransition: {
      version: 1, kind: "transition", networkKind: "supply", construction: "round-metal",
      inletSize: { shape: "round", diameterInches: 12 },
      outletSize: { shape: "round", diameterInches: 16 },
      lengthInches: 12, alignment: "centered", inboundAngleDegrees: 0,
      ports: {
        inlet: { id: "inlet", takeoutInches: 0 },
        outlet: { id: "outlet", takeoutInches: 0 },
      },
    },
  };
  const malformedTerminal = {
    id: "can-unsafe", type: "symbol", page: 1, points: [{ x: 20, y: 10 }],
    symbol: {
      kind: "diffuser", label: "Supply can", rotation: 0, variant: "supply-can", neckSize: "8",
      rigidTerminal: { version: 1, kind: "wrong-kind", connectedTo: { drawingId: "missing", portId: "end" } },
    },
  };
  const result = migrateSavedProject({ version: 11, drawings: [unsafeTransition, malformedTerminal] });
  assert.equal(result.ok, true);
  assert.equal(result.project.rigidDrawingQuarantine.length, 1);
  assert.equal(result.project.drawings.length, 1);
  assert.equal("rigidTerminal" in result.project.drawings[0].symbol, false);
});
