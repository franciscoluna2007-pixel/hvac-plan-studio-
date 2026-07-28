import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  buildConnectionRepairPlan,
  prepareConnectionRepairBatch,
} = await loadTypescriptModule(new URL("../app/connectionRepair.ts", import.meta.url));

function fittingTarget(overrides = {}) {
  return {
    id: "fitting:ty-1:0",
    kind: "fitting",
    drawingId: "ty-1",
    label: "T/Y fitting - Port 1",
    detail: "Open T/Y connection",
    page: 1,
    systemId: "system-1",
    ductType: "supply",
    port: 0,
    targetPoint: { x: 0, y: 0 },
    expectedDirection: { x: -1, y: 0 },
    expectedSize: "8",
    ...overrides,
  };
}

function supplyRun(overrides = {}) {
  return {
    id: "run-1",
    page: 1,
    systemId: "system-1",
    type: "supply",
    size: "8",
    points: [{ x: -6, y: 0 }, { x: -50, y: 0 }],
    ...overrides,
  };
}

function terminalTarget(overrides = {}) {
  return {
    id: "device:supply-1",
    kind: "device",
    drawingId: "supply-1",
    label: "Supply can 1",
    detail: "Supply can connection",
    page: 1,
    systemId: "system-1",
    ductType: "supply",
    slot: "terminal",
    targetPoint: { x: 0, y: 0 },
    ...overrides,
  };
}

test("unsaved T/Y port prepares a high-confidence existing-endpoint repair", () => {
  const runs = [supplyRun()];
  const originalRuns = structuredClone(runs);
  const plan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs,
    targets: [fittingTarget()],
  });

  assert.equal(plan.version, "connection-repair-v120.0");
  assert.equal(plan.counts.ready, 1);
  assert.equal(plan.items[0].status, "ready");
  assert.equal(plan.items[0].candidate.runId, "run-1");
  assert.equal(plan.items[0].candidate.end, "start");
  assert.equal(plan.items[0].candidate.sizeMatch, true);
  assert.equal(plan.items[0].candidate.directionErrorDegrees, 0);
  assert.match(plan.items[0].reason, /High-confidence existing-run match/);

  const batch = prepareConnectionRepairBatch(
    plan,
    [plan.items[0].id],
    plan.fingerprint,
  );
  assert.equal(batch.ok, true);
  assert.deepEqual(batch.operations, [{
    itemId: "fitting:ty-1:0",
    kind: "fitting",
    drawingId: "ty-1",
    slot: undefined,
    port: 0,
    runId: "run-1",
    end: "start",
    from: { x: -6, y: 0 },
    to: { x: 0, y: 0 },
  }]);
  assert.deepEqual(runs, originalRuns, "planning a repair must not mutate or create run geometry");
});

test("saved T/Y port never falls back to another nearby run", () => {
  const plan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs: [supplyRun({ id: "nearby-but-not-saved" })],
    targets: [fittingTarget({ savedRunId: "missing-saved-run" })],
  });

  assert.equal(plan.counts.blocked, 1);
  assert.equal(plan.items[0].status, "blocked");
  assert.equal(plan.items[0].saved, true);
  assert.deepEqual(plan.items[0].candidates, []);
  assert.match(plan.items[0].reason, /saved T\/Y run is missing/);
});

test("similar nearby endpoints remain an explicit user choice", () => {
  const plan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs: [
      supplyRun({
        id: "run-a",
        points: [{ x: -6, y: 1 }, { x: -50, y: 1 }],
      }),
      supplyRun({
        id: "run-b",
        points: [{ x: -6, y: -1 }, { x: -50, y: -1 }],
      }),
    ],
    targets: [fittingTarget()],
  });

  assert.equal(plan.counts.choice, 1);
  assert.equal(plan.items[0].status, "choice");
  assert.equal(plan.items[0].candidate, undefined);
  assert.deepEqual(
    plan.items[0].candidates.slice(0, 2).map((candidate) => candidate.runId),
    ["run-a", "run-b"],
  );
  assert.match(plan.items[0].reason, /score similarly/);
});

test("same-sheet, same-system, and matching-duct guards reject other runs", () => {
  const plan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs: [
      supplyRun({ id: "other-system", systemId: "system-2" }),
      supplyRun({ id: "other-sheet", page: 2 }),
      supplyRun({ id: "return-run", type: "return" }),
    ],
    targets: [fittingTarget()],
  });

  assert.equal(plan.counts.blocked, 1);
  assert.equal(plan.items[0].status, "blocked");
  assert.deepEqual(plan.items[0].candidates, []);
});

test("size and direction signals deterministically favor the compatible endpoint", () => {
  const plan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs: [
      supplyRun({
        id: "near-wrong-size",
        size: "6",
        points: [{ x: -4, y: 0 }, { x: -50, y: 0 }],
      }),
      supplyRun({
        id: "matching-size",
        points: [{ x: -10, y: 0 }, { x: -50, y: 0 }],
      }),
    ],
    targets: [fittingTarget()],
  });

  assert.equal(plan.items[0].status, "ready");
  assert.equal(plan.items[0].candidate.runId, "matching-size");
  assert.equal(plan.items[0].candidate.sizeMatch, true);
  assert.ok(
    plan.items[0].candidate.score <
    plan.items[0].candidates.find((candidate) => candidate.runId === "near-wrong-size").score,
  );
});

test("two targets cannot automatically claim the same run endpoint", () => {
  const plan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs: [supplyRun()],
    targets: [
      fittingTarget(),
      fittingTarget({
        id: "fitting:ty-2:0",
        drawingId: "ty-2",
        label: "Second T/Y fitting - Port 1",
        targetPoint: { x: 0, y: .5 },
      }),
    ],
  });

  assert.equal(plan.counts.choice, 2);
  assert.ok(plan.items.every((item) => item.candidate === undefined));
});

test("stale fingerprints stop a reviewed endpoint operation", () => {
  const plan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs: [supplyRun()],
    targets: [fittingTarget()],
  });
  const batch = prepareConnectionRepairBatch(
    plan,
    [plan.items[0].id],
    "step1-stale",
  );

  assert.deepEqual(batch, {
    ok: false,
    reason: "The plan changed after this review. Refresh Step 1 before applying.",
    operations: [],
  });
});

test("verified plan scale converts physical snap limits to plan units", () => {
  const runs = [supplyRun({
    points: [{ x: -50, y: 0 }, { x: -90, y: 0 }],
  })];
  const targets = [terminalTarget()];
  const legacyPlan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs,
    targets,
  });
  const scaledPlan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs,
    targets,
    scale: { verified: true, feetPerUnit: .1 },
  });
  const unverifiedScalePlan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs,
    targets,
    scale: { verified: false, feetPerUnit: .1 },
  });

  assert.notEqual(legacyPlan.items[0].status, "blocked", "legacy 70-unit terminal limit remains the fallback");
  assert.equal(scaledPlan.items[0].status, "blocked", "3 ft becomes a 30-unit terminal limit");
  assert.notEqual(unverifiedScalePlan.items[0].status, "blocked", "unverified scale must not change snap limits");
  assert.notEqual(scaledPlan.fingerprint, legacyPlan.fingerprint);
  assert.notEqual(scaledPlan.fingerprint, unverifiedScalePlan.fingerprint);
});

test("per-sheet scale uses the target sheet threshold instead of the global or page-one scale", () => {
  const runs = [supplyRun({
    page: 2,
    points: [{ x: -50, y: 0 }, { x: -90, y: 0 }],
  })];
  const targets = [terminalTarget({ page: 2 })];
  const globalScalePlan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs,
    targets,
    scale: { verified: true, feetPerUnit: .01 },
  });
  const perSheetScalePlan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs,
    targets,
    scale: {
      verified: true,
      feetPerUnit: .01,
      byPage: {
        "1": { verified: true, feetPerUnit: .01 },
        "2": { verified: true, feetPerUnit: .1 },
      },
    },
  });

  assert.notEqual(
    globalScalePlan.items[0].status,
    "blocked",
    "the global/page-one scale would allow a 50-unit snap",
  );
  assert.equal(
    perSheetScalePlan.items[0].status,
    "blocked",
    "page 2 uses its own 3 ft / .1 = 30-unit terminal limit",
  );
  assert.notEqual(perSheetScalePlan.fingerprint, globalScalePlan.fingerprint);
});

test("candidate signals explain scope, availability, duct type, and scaled distance", () => {
  const plan = buildConnectionRepairPlan({
    systemId: "system-1",
    runs: [supplyRun({
      points: [{ x: -10, y: 0 }, { x: -50, y: 0 }],
    })],
    targets: [fittingTarget()],
    scale: { verified: true, feetPerUnit: .1 },
  });
  const signals = plan.items[0].candidates[0].signals;

  assert.ok(signals.includes("same sheet and system"));
  assert.ok(signals.includes("supply run"));
  assert.ok(signals.includes("endpoint unused"));
  assert.ok(signals.includes("1 ft away"));
});
