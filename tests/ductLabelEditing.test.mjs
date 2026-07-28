import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  DEFAULT_DUCT_LABEL_SCALE,
  MIN_DUCT_LABEL_SCALE,
  MAX_DUCT_LABEL_SCALE,
  DUCT_LABEL_SCALE_STEP,
  normalizedDuctLabelScale,
  resetDuctLabelScale,
  stepDuctLabelScale,
} = await loadTypescriptModule(
  new URL("../app/ductLabelEditing.ts", import.meta.url),
);

test("keeps missing legacy duct label scales at 100 percent", () => {
  assert.equal(DEFAULT_DUCT_LABEL_SCALE, 1);
  assert.equal(normalizedDuctLabelScale(), 1);
  assert.equal(normalizedDuctLabelScale(null), 1);
  assert.equal(normalizedDuctLabelScale(Number.NaN), 1);
  assert.equal(normalizedDuctLabelScale(Number.POSITIVE_INFINITY), 1);
  assert.equal(resetDuctLabelScale(), 1);
});

test("clamps duct label scales to a readable editing range", () => {
  assert.equal(MIN_DUCT_LABEL_SCALE, 0.4);
  assert.equal(MAX_DUCT_LABEL_SCALE, 2);
  assert.equal(normalizedDuctLabelScale(0.1), 0.4);
  assert.equal(normalizedDuctLabelScale(0.65), 0.65);
  assert.equal(normalizedDuctLabelScale(9), 2);
});

test("steps duct labels deterministically and stops at each limit", () => {
  assert.equal(DUCT_LABEL_SCALE_STEP, 0.05);
  assert.equal(stepDuctLabelScale(undefined, -1), 0.95);
  assert.equal(stepDuctLabelScale(0.65, -1), 0.6);
  assert.equal(stepDuctLabelScale(0.4, -1), 0.4);
  assert.equal(stepDuctLabelScale(1.95, 1), 2);
  assert.equal(stepDuctLabelScale(2, 1), 2);
});
