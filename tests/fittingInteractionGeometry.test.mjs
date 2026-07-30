import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  FITTING_COARSE_HIT_STROKE_PX,
  FITTING_HIT_STROKE_PX,
  fittingOverlayScale,
} = await loadTypescriptModule(
  new URL("../app/fittingInteractionGeometry.ts", import.meta.url),
);

test("T/Y interaction chrome stays compact in screen space", () => {
  assert.equal(FITTING_HIT_STROKE_PX, 16);
  assert.equal(FITTING_COARSE_HIT_STROKE_PX, 22);
  assert.equal(fittingOverlayScale(1), 1);
  assert.equal(fittingOverlayScale(2.72), 1 / 2.72);
  assert.equal(fittingOverlayScale(0), 1);
  assert.equal(fittingOverlayScale(Number.NaN), 1);
});

test("T/Y overlay scaling is bounded at extreme zoom levels", () => {
  assert.equal(fittingOverlayScale(100), 1 / 8);
  assert.equal(fittingOverlayScale(0.01), 4);
});
