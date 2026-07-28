import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  PLAN_VIEWPORT_SCALE,
  feetPerDrawingUnitFromRatio,
  resolveDetectedDrawingScale,
  scaleRatioFromLabel,
} = await loadTypescriptModule(
  new URL("../app/drawingScale.ts", import.meta.url),
);

const approximatelyEqual = (actual, expected, tolerance = 1e-12) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test("converts a detected architectural ratio to drawing feet without a preset allow-list", () => {
  const resolved = resolveDetectedDrawingScale({
    label: '1/4" = 1\'-0"',
    ratio: 48,
  });

  assert.ok(resolved);
  assert.equal(resolved.label, '1/4" = 1\'-0"');
  assert.equal(resolved.ratio, 48);
  approximatelyEqual(resolved.feetPerUnit, 1 / 24.3);
  approximatelyEqual(
    resolved.feetPerUnit,
    feetPerDrawingUnitFromRatio(48, PLAN_VIEWPORT_SCALE),
  );
});

test("accepts uncommon numeric candidates even when their display label is not parseable", () => {
  const resolved = resolveDetectedDrawingScale({
    label: "Engineer-confirmed sheet scale",
    ratio: 75,
  });

  assert.ok(resolved);
  assert.equal(resolved.ratio, 75);
  approximatelyEqual(resolved.feetPerUnit, 75 / (12 * 72 * 1.35));
});

test("parses metric, equivalent fractions, and decimal architectural labels", () => {
  assert.equal(scaleRatioFromLabel("1:100"), 100);
  assert.equal(scaleRatioFromLabel('2/8" = 1\'-0"'), 48);
  assert.equal(scaleRatioFromLabel('0.25" = 1\'-0"'), 48);

  const metric = resolveDetectedDrawingScale({
    label: "1 : 100",
    ratio: null,
  });
  assert.ok(metric);
  assert.equal(metric.ratio, 100);
  approximatelyEqual(metric.feetPerUnit, 100 / (12 * 72 * 1.35));
});

test("rejects NTS and invalid ratios so the UI can request calibration", () => {
  assert.equal(scaleRatioFromLabel("NTS"), null);
  assert.equal(scaleRatioFromLabel("NOT TO SCALE"), null);
  assert.equal(resolveDetectedDrawingScale({ label: "NTS", ratio: null }), null);
  assert.equal(resolveDetectedDrawingScale({ label: "1:0", ratio: 0 }), null);
  assert.equal(feetPerDrawingUnitFromRatio(0), null);
  assert.equal(feetPerDrawingUnitFromRatio(48, 0), null);
});
