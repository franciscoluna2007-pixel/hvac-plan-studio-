import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  BRANCH_ATTACH_RADIUS_PX,
  BRANCH_AUTO_MATCH_RADIUS_PX,
  BRANCH_PICK_RADIUS_PX,
  BRANCH_THREE_RUN_RADIUS_PX,
  FITTING_COARSE_HIT_STROKE_PX,
  FITTING_HIT_STROKE_PX,
  fittingPortReach,
  fittingPortReachForVersion,
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
  for (const zoom of [1, 2, 4, 8]) {
    assert.equal(6 * fittingOverlayScale(zoom) * zoom, 6);
  }
});

test("direct-placement T/Ys are smaller without changing saved v2 or legacy plans", () => {
  assert.equal(fittingPortReach("12", 0, true), 10.5);
  assert.equal(fittingPortReach("12", 1, true), 11);
  assert.equal(fittingPortReach("12", 2, true), 12);
  assert.equal(fittingPortReachForVersion("12", 0, 3), 6);
  assert.equal(fittingPortReachForVersion("12", 1, 3), 6.5);
  assert.equal(fittingPortReachForVersion("12", 2, 3), 7);
  assert.equal(fittingPortReachForVersion("12", 0, 2), 10.5);
  assert.ok(fittingPortReachForVersion("12", 2, 3) < fittingPortReachForVersion("12", 2, 2));
  assert.ok(fittingPortReach("12", 2, true) < fittingPortReach("12", 2, false));
  assert.ok(Math.abs(fittingPortReach("12", 2, false) - 20.56) < 1e-9);
});

test("T/Y placement uses narrow, intentional run matching", () => {
  assert.equal(BRANCH_PICK_RADIUS_PX, 24);
  assert.equal(BRANCH_ATTACH_RADIUS_PX, 28);
  assert.equal(BRANCH_AUTO_MATCH_RADIUS_PX, 18);
  assert.equal(BRANCH_THREE_RUN_RADIUS_PX, 28);
  assert.ok(BRANCH_AUTO_MATCH_RADIUS_PX < BRANCH_PICK_RADIUS_PX);
});
