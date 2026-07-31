import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  persistProjectSnapshot,
  projectStorageKey,
  resolveProjectRestore,
} = await loadTypescriptModule(
  new URL("../app/projectStorage.ts", import.meta.url),
);

test("uses the PDF fingerprint to keep same-named plan files separate", () => {
  assert.equal(
    projectStorageKey("House Plan", "source-a"),
    "hvac-plan-studio:house plan:source-a",
  );
  assert.notEqual(
    projectStorageKey("House Plan", "source-a"),
    projectStorageKey("House Plan", "source-b"),
  );
});

test("restores only a snapshot that matches the opened PDF contents", () => {
  const matching = JSON.stringify({ pdfFingerprint: "source-a", drawings: [{ id: "run-1" }] });
  const result = resolveProjectRestore(matching, null, "source-a");

  assert.equal(result.status, "restored");
  assert.deepEqual(result.project.drawings, [{ id: "run-1" }]);
});

test("opens a same-named but different PDF as a new job", () => {
  const prior = JSON.stringify({ pdfFingerprint: "source-a", drawings: [{ id: "old-run" }] });
  const result = resolveProjectRestore(null, prior, "source-b");

  assert.deepEqual(result, { status: "source-mismatch", project: null });
});

test("treats corrupt local snapshots as new jobs", () => {
  assert.deepEqual(
    resolveProjectRestore(null, "{bad-json", "source-a"),
    { status: "new", project: null },
  );
});

test("round-trips a placed supply run and plan icon in the local snapshot", () => {
  const values = new Map();
  const project = {
    version: 9,
    fileName: "Field Plan",
    pdfFingerprint: "source-field",
    savedAt: "2026-07-30T18:00:00.000Z",
    drawings: [
      {
        id: "supply-run-1",
        type: "supply",
        page: 1,
        points: [{ x: 18, y: 22 }, { x: 108, y: 22 }],
        size: "12x8",
      },
      {
        id: "supply-icon-1",
        type: "symbol",
        symbol: "supply-register",
        page: 1,
        points: [{ x: 108, y: 22 }],
      },
    ],
  };
  const key = projectStorageKey(project.fileName, project.pdfFingerprint);

  assert.equal(
    persistProjectSnapshot(
      { setItem: (storageKey, value) => values.set(storageKey, value) },
      key,
      project,
    ),
    "saved",
  );

  const restored = resolveProjectRestore(values.get(key), null, "source-field");
  assert.equal(restored.status, "restored");
  assert.deepEqual(restored.project.drawings, project.drawings);
});

test("reports a limited save when detailed analysis exceeds browser storage", () => {
  const writes = [];
  const result = persistProjectSnapshot(
    {
      setItem: (_key, value) => {
        writes.push(JSON.parse(value));
        if (writes.length === 1) throw new Error("quota");
      },
    },
    "plan-key",
    {
      pdfFingerprint: "source-a",
      drawings: [{ id: "run-1" }],
      activePlanAnalysis: { sheets: new Array(100).fill("detail") },
    },
  );

  assert.equal(result, "limited");
  assert.equal(writes.length, 2);
  assert.equal(writes[1].activePlanAnalysis, null);
  assert.deepEqual(writes[1].drawings, [{ id: "run-1" }]);
});

test("reports an error instead of claiming success when browser storage rejects both writes", () => {
  assert.equal(
    persistProjectSnapshot(
      { setItem: () => { throw new Error("quota"); } },
      "plan-key",
      { pdfFingerprint: "source-a", drawings: [{ id: "run-1" }] },
    ),
    "error",
  );
});

test("preserves every placed object in a large field plan snapshot", () => {
  let stored = "";
  const drawings = Array.from({ length: 1_500 }, (_, index) =>
    index % 2 === 0
      ? {
          id: `run-${index}`,
          type: "supply",
          page: (index % 12) + 1,
          points: [{ x: index, y: 10 }, { x: index + 40, y: 10 }],
        }
      : {
          id: `icon-${index}`,
          type: "symbol",
          symbol: "supply-register",
          page: (index % 12) + 1,
          points: [{ x: index, y: 10 }],
        },
  );

  assert.equal(
    persistProjectSnapshot(
      { setItem: (_key, value) => { stored = value; } },
      "large-plan",
      {
        pdfFingerprint: "source-large",
        savedAt: "2026-07-30T18:00:00.000Z",
        drawings,
      },
    ),
    "saved",
  );

  const restored = resolveProjectRestore(stored, null, "source-large");
  assert.equal(restored.status, "restored");
  assert.equal(restored.project.drawings.length, drawings.length);
  assert.equal(restored.project.drawings.at(-1).id, "icon-1499");
});
