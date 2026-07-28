import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  buildRepairPlan,
  safeStepActions,
  selectedReadyActions,
  validateRepairSelection,
} = await loadTypescriptModule(new URL("../app/repairPlan.ts", import.meta.url));
const {
  describeRepairMutationChanges,
  validateRepairMutationScope,
} = await loadTypescriptModule(
  new URL("../app/repairSafety.ts", import.meta.url),
);

function fieldDetailRecommendation() {
  return {
    id: "assistant-run-details",
    evidenceFingerprint: "field-detail-proof",
    severity: "warning",
    category: "Field details",
    title: "One terminal run needs a field number",
    detail: "The route is drawn but its field number is blank.",
    whyItMatters: "The field needs an unambiguous label.",
    proposedAction: "Fill the blank field number.",
    action: "focus",
    confidence: 0.99,
    evidence: ["Terminal-linked route"],
    resolved: false,
    priorityTier: "next",
    priorityScore: 55,
    priorityReason: "Finish labels before the field package.",
    relatedDrawingIds: [],
  };
}

function baseInput(overrides = {}) {
  return {
    systemId: "system-1",
    evidenceFingerprint: "system-proof",
    createdAt: "2026-07-27T00:00:00.000Z",
    recommendations: [fieldDetailRecommendation()],
    cfmCandidates: [],
    roomTargetsReviewed: true,
    sizeCandidates: [],
    runNumberCandidates: [{
      id: "run-number-supply-1",
      drawingId: "supply-1",
      type: "supply",
      page: 1,
      room: "Bedroom 1",
      size: "8",
      currentRunNumber: "",
      proposedRunNumber: "F1",
      terminalLinked: true,
      duplicateExistingNumber: false,
      evidenceFingerprint: "run-number-proof",
    }],
    branchCandidates: [],
    scaleVerified: true,
    ...overrides,
  };
}

test("repair plans never select or apply a fix by default", () => {
  const plan = buildRepairPlan(baseInput());
  const action = plan.actions.find((candidate) => candidate.kind === "run-number");

  assert.ok(action);
  assert.equal(action.readiness, "ready");
  assert.equal(action.safeForBatch, true);
  assert.equal(action.geometryChanges, false);
  assert.equal(action.stage, "metadata");
  assert.deepEqual(plan.selectedByDefault, []);
  assert.ok(plan.actions.every((candidate) => candidate.selectedByDefault === false));
  assert.deepEqual(selectedReadyActions(plan, []), []);
});

test("safe-step selection includes metadata alongside only the earliest calculation stage", () => {
  const plan = buildRepairPlan(baseInput());
  const metadata = plan.actions.find((action) => action.kind === "run-number");
  const airflow = {
    ...metadata,
    id: "repair-cfm-terminal-1",
    kind: "terminal-cfm",
    stage: "airflow",
    priority: "do-first",
  };
  const size = {
    ...metadata,
    id: "repair-size-supply-1",
    kind: "run-size",
    stage: "sizes",
    priority: "next",
  };
  const stagedPlan = {
    ...plan,
    actions: [size, metadata, airflow],
  };

  assert.deepEqual(
    safeStepActions(stagedPlan).map((action) => action.id).sort(),
    [airflow.id, metadata.id].sort(),
  );
  assert.equal(validateRepairSelection(stagedPlan, [airflow.id, metadata.id]).valid, true);

  const mixedSelection = validateRepairSelection(stagedPlan, [airflow.id, size.id]);
  assert.equal(mixedSelection.valid, false);
  assert.match(mixedSelection.reason, /separate steps/i);
});

test("a duplicate existing field number remains blocked for a person", () => {
  const plan = buildRepairPlan(baseInput({
    runNumberCandidates: [{
      ...baseInput().runNumberCandidates[0],
      currentRunNumber: "F1",
      proposedRunNumber: "F1",
      duplicateExistingNumber: true,
    }],
  }));
  const action = plan.actions.find((candidate) => candidate.kind === "run-number");

  assert.equal(action.readiness, "needs-input");
  assert.equal(action.safeForBatch, false);
  assert.equal(action.selectedByDefault, false);
  assert.match(action.blocker, /person/i);
  assert.deepEqual(action.changes, []);
});

test("mutation scope rejects out-of-scope point, size, and CFM changes", () => {
  const before = [{
    id: "supply-1",
    type: "supply",
    page: 1,
    points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    size: "8",
    cfm: 125,
    cfmSource: "manual",
    runNumber: "",
    systemId: "system-1",
  }];
  const after = [{
    ...before[0],
    points: [{ x: 11, y: 20 }, { x: 30, y: 40 }],
    size: "10",
    cfm: 150,
    runNumber: "F1",
  }];

  const violations = validateRepairMutationScope(before, after, [{
    kind: "run-number",
    drawingId: "supply-1",
  }]);

  assert.deepEqual(
    violations.map((violation) => violation.field).sort(),
    ["cfm", "points", "size"],
  );
  assert.ok(violations.every((violation) => /unreviewed/i.test(violation.reason)));
});

test("mutation scope permits the reviewed field but still rejects adjacent changes", () => {
  const before = [{
    id: "supply-1",
    type: "supply",
    page: 1,
    points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    size: "8",
    cfm: 125,
    cfmSource: "manual",
    runNumber: "F1",
    systemId: "system-1",
  }];
  const after = [{
    ...before[0],
    points: [{ x: 12, y: 20 }, { x: 30, y: 40 }],
    size: "10",
    cfm: 150,
  }];

  const violations = validateRepairMutationScope(before, after, [{
    kind: "run-size",
    drawingId: "supply-1",
  }]);

  assert.deepEqual(
    violations.map((violation) => violation.field).sort(),
    ["cfm", "points"],
  );
});

test("an already-correct duct size never becomes a selectable repair", () => {
  const plan = buildRepairPlan(baseInput({
    runNumberCandidates: [],
    sizeCandidates: [{
      id: "supply-1",
      type: "supply",
      room: "Bedroom 1",
      current: "10",
      recommended: "10.0",
      cfm: 300,
      currentVelocity: 550,
      velocity: 550,
      limit: 900,
      airflowSource: "manual",
      airflowReviewed: true,
      equipmentRooted: true,
      applyEligible: true,
      overCapacity: false,
    }],
  }));

  assert.equal(plan.actions.some((action) => action.kind === "run-size"), false);
  assert.equal(plan.readyCount, 0);
});

test("receipt changes describe every field mutated by CFM and fitting-size repairs", () => {
  const before = [{
    id: "terminal-1",
    cfm: 100,
    cfmSource: "manual",
  }, {
    id: "run-1",
    size: "8",
    sizeReviewed: true,
  }, {
    id: "fitting-1",
    size: "8×8×6",
    fitting: {
      connectedIds: ["run-1", "run-2", "run-3"],
      upstreamSize: "8",
      downstreamSize: "8",
      branchSize: "6",
    },
  }];
  const after = [{
    ...before[0],
    cfm: 125,
    cfmSource: "room-target",
  }, {
    ...before[1],
    size: "10",
    sizeReviewed: false,
  }, {
    ...before[2],
    size: "10×8×6",
    fitting: {
      ...before[2].fitting,
      upstreamSize: "10",
    },
  }];
  const changes = describeRepairMutationChanges(before, after, [{
    id: "cfm-action",
    kind: "terminal-cfm",
    drawingId: "terminal-1",
  }, {
    id: "size-action",
    kind: "run-size",
    drawingId: "run-1",
    affectedFittingIds: ["fitting-1"],
  }]);

  assert.deepEqual(
    changes.map(({ actionId, objectId, field }) => [actionId, objectId, field]),
    [
      ["cfm-action", "terminal-1", "CFM"],
      ["cfm-action", "terminal-1", "CFM source"],
      ["size-action", "run-1", "Run size"],
      ["size-action", "run-1", "Size review"],
      ["size-action", "fitting-1", "Fitting size label"],
      ["size-action", "fitting-1", "Fitting upstream size"],
    ],
  );
});

test("matching CFM with planning provenance becomes a source-only repair", () => {
  const plan = buildRepairPlan(baseInput({
    runNumberCandidates: [],
    cfmCandidates: [{
      id: "proposal-1",
      drawingId: "terminal-1",
      room: "Bedroom 1",
      label: "Supply diffuser",
      current: 125,
      currentSource: "planning-seed",
      proposed: 125,
      connected: true,
    }],
    roomTargetsReviewed: true,
  }));
  const action = plan.actions.find((candidate) => candidate.kind === "terminal-cfm");

  assert.equal(action.readiness, "ready");
  assert.equal(action.currentCfmSource, "planning-seed");
  assert.deepEqual(action.changes.map((change) => change.field), ["CFM source"]);
  assert.match(action.changeScope, /value or source/i);
});
