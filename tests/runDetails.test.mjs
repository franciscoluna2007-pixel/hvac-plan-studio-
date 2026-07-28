import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  applyRunNumberEdits,
  buildRunNumberCandidates,
} = await loadTypescriptModule(new URL("../app/assistantRunDetails.ts", import.meta.url));

function run(overrides = {}) {
  return {
    id: "supply-1",
    type: "supply",
    page: 1,
    size: "8",
    roomName: "Bedroom 1",
    terminalLinked: true,
    firstPoint: { x: 10, y: 10 },
    ...overrides,
  };
}

test("numbering is deterministic, terminal-linked only, and collision-safe", () => {
  const runs = [
    run({ id: "existing-supply", runNumber: "f1", firstPoint: { x: 5, y: 5 } }),
    run({ id: "supply-later", firstPoint: { x: 20, y: 20 } }),
    run({ id: "supply-earlier", firstPoint: { x: 15, y: 10 } }),
    run({
      id: "supply-trunk",
      terminalLinked: false,
      firstPoint: { x: 1, y: 1 },
    }),
    run({
      id: "existing-return",
      type: "return",
      runNumber: "R1",
      firstPoint: { x: 1, y: 1 },
    }),
    run({
      id: "blank-return",
      type: "return",
      firstPoint: { x: 2, y: 2 },
    }),
  ];

  const candidates = buildRunNumberCandidates(runs);
  const reversed = buildRunNumberCandidates(runs.toReversed());

  assert.deepEqual(candidates, reversed, "input order must not change numbering");
  assert.deepEqual(
    candidates.map((candidate) => [candidate.drawingId, candidate.proposedRunNumber]),
    [
      ["supply-earlier", "F2"],
      ["supply-later", "F3"],
      ["blank-return", "R2"],
    ],
  );
  assert.equal(
    candidates.some((candidate) => candidate.drawingId === "supply-trunk"),
    false,
    "trunks and other non-terminal segments must not be auto-numbered",
  );
  assert.ok(candidates.every((candidate) => candidate.terminalLinked));
});

test("duplicate existing labels are surfaced without silent resequencing", () => {
  const candidates = buildRunNumberCandidates([
    run({ id: "supply-a", runNumber: "F4" }),
    run({ id: "supply-b", runNumber: "f4", firstPoint: { x: 20, y: 20 } }),
  ]);

  assert.equal(candidates.length, 2);
  assert.ok(candidates.every((candidate) => candidate.duplicateExistingNumber));
  assert.ok(candidates.every((candidate) => candidate.proposedRunNumber === "F4"));
});

test("applying a number changes only runNumber and preserves every other field", () => {
  const drawings = [{
    id: "supply-1",
    type: "supply",
    page: 2,
    points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
    size: "8",
    sizeReviewed: true,
    cfm: 140,
    cfmSource: "terminal-linked",
    systemId: "system-1",
    roomName: "Bedroom 1",
    fitting: { style: "wye45", ports: [{ size: "8" }] },
    runNumber: "",
  }];
  const original = structuredClone(drawings);
  const [candidate] = buildRunNumberCandidates([run({
    id: "supply-1",
    page: 2,
    size: "8",
  })]);

  const updated = applyRunNumberEdits(drawings, [{
    drawingId: candidate.drawingId,
    currentRunNumber: candidate.currentRunNumber,
    proposedRunNumber: candidate.proposedRunNumber,
    evidenceFingerprint: candidate.evidenceFingerprint,
  }]);

  assert.deepEqual(drawings, original, "the helper must not mutate its input");
  assert.deepEqual(updated, [{
    ...original[0],
    runNumber: "F1",
  }]);
  const beforeRest = { ...original[0] };
  const afterRest = { ...updated[0] };
  delete beforeRest.runNumber;
  delete afterRest.runNumber;
  assert.deepEqual(afterRest, beforeRest);
});

test("applying labels rejects collisions and stale overwrite attempts", () => {
  const drawings = [
    { id: "supply-1", runNumber: "" },
    { id: "supply-2", runNumber: "F1" },
  ];

  assert.throws(
    () => applyRunNumberEdits(drawings, [{
      drawingId: "supply-1",
      currentRunNumber: "",
      proposedRunNumber: "F1",
      evidenceFingerprint: "proof",
    }]),
    /already exists/i,
  );
  assert.throws(
    () => applyRunNumberEdits(
      [{ id: "supply-1", runNumber: "F7" }],
      [{
        drawingId: "supply-1",
        currentRunNumber: "",
        proposedRunNumber: "F8",
        evidenceFingerprint: "stale-proof",
      }],
    ),
    /stale|overwrite/i,
  );
});

test("an unrelated duplicate does not block a non-colliding blank label", () => {
  const drawings = [
    { id: "duplicate-a", runNumber: "F1", points: [{ x: 1, y: 1 }] },
    { id: "duplicate-b", runNumber: "f1", points: [{ x: 2, y: 2 }] },
    { id: "blank-run", runNumber: "", points: [{ x: 3, y: 3 }] },
  ];
  const updated = applyRunNumberEdits(drawings, [{
    drawingId: "blank-run",
    currentRunNumber: "",
    proposedRunNumber: "F2",
    evidenceFingerprint: "blank-run-proof",
  }]);

  assert.equal(updated.find((drawing) => drawing.id === "blank-run").runNumber, "F2");
  assert.equal(updated.find((drawing) => drawing.id === "duplicate-a").runNumber, "F1");
  assert.equal(updated.find((drawing) => drawing.id === "duplicate-b").runNumber, "f1");
});
