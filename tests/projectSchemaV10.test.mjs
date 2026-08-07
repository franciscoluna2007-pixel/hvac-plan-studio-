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

test("round-trips every Phase 1 rigid construction canonically", () => {
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
  const second = migrateSavedProject(first.project);
  assert.equal(second.ok, true);
  assert.deepEqual(second.project, first.project);
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
