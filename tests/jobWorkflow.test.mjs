import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const { deriveDrawFirstWorkflow } = await loadTypescriptModule(
  new URL("../app/jobWorkflow.ts", import.meta.url),
);

function completeFixture(overrides = {}) {
  return {
    pdfLoaded: true,
    hasPrimaryUnit: true,
    supplyRunCount: 4,
    supplyDeviceCount: 4,
    pendingSupplyNumbers: 0,
    pendingSupplySizes: 0,
    returnRunCount: 1,
    returnDeviceCount: 1,
    pendingReturnNumbers: 0,
    pendingReturnSizes: 0,
    connectionProblems: 0,
    connectionsComplete: true,
    ...overrides,
  };
}

test("starts with routes until the plan, unit, supply cans, and supply runs exist", () => {
  for (const overrides of [
    { pdfLoaded: false },
    { hasPrimaryUnit: false },
    { supplyDeviceCount: 0 },
    { supplyRunCount: 0 },
    { supplyRunCount: 2, supplyDeviceCount: 4 },
  ]) {
    const state = deriveDrawFirstWorkflow(completeFixture(overrides));
    assert.equal(state.stage, "routes");
    assert.equal(state.complete, false);
  }
});

test("moves from drawn supply routes to the flex-number and reviewed-size pass", () => {
  const missingNumbers = deriveDrawFirstWorkflow(completeFixture({
    pendingSupplyNumbers: 3,
  }));
  assert.equal(missingNumbers.stage, "flex-details");
  assert.equal(missingNumbers.title, "Add flex numbers and sizes");
  assert.match(missingNumbers.detail, /3 flex details need review/);

  const missingSizes = deriveDrawFirstWorkflow(completeFixture({
    pendingSupplySizes: 1,
  }));
  assert.equal(missingSizes.stage, "flex-details");
  assert.match(missingSizes.detail, /1 flex detail needs review/);
});

test("requires return devices, routes, numbers, and reviewed sizes after flex details", () => {
  const cases = [
    { returnDeviceCount: 0 },
    { returnRunCount: 0 },
    { pendingReturnNumbers: 1 },
    { pendingReturnSizes: 2 },
  ];

  for (const overrides of cases) {
    const state = deriveDrawFirstWorkflow(completeFixture(overrides));
    assert.equal(state.stage, "returns");
    assert.equal(state.complete, false);
  }
});

test("holds at connection repair until connection review is actually clear", () => {
  const incomplete = deriveDrawFirstWorkflow(completeFixture({
    connectionsComplete: false,
  }));
  assert.equal(incomplete.stage, "connections");
  assert.equal(incomplete.complete, false);

  const problemsRemain = deriveDrawFirstWorkflow(completeFixture({
    connectionProblems: 2,
  }));
  assert.equal(problemsRemain.stage, "connections");
  assert.match(problemsRemain.detail, /2 connections need review/);
});

test("reports complete only after every draw-first stage is complete", () => {
  const state = deriveDrawFirstWorkflow(completeFixture());

  assert.deepEqual(state, {
    stage: "complete",
    title: "Drawing and details complete",
    detail: "Routes, numbers, sizes, returns, and connections are ready",
    complete: true,
  });
});

test("prevents false completion when hidden post-draw details are still missing", () => {
  const falseCompletionCases = [
    { pendingSupplyNumbers: 1 },
    { pendingSupplySizes: 1 },
    { pendingReturnNumbers: 1 },
    { pendingReturnSizes: 1 },
    { connectionProblems: 1 },
    { connectionsComplete: false },
  ];

  for (const overrides of falseCompletionCases) {
    const state = deriveDrawFirstWorkflow(completeFixture(overrides));
    assert.notEqual(state.stage, "complete");
    assert.equal(state.complete, false);
  }
});
