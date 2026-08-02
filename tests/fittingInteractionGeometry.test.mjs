import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  BRANCH_ATTACH_RADIUS_PX,
  BRANCH_AUTO_MATCH_RADIUS_PX,
  BRANCH_PICK_RADIUS_PX,
  BRANCH_THREE_RUN_RADIUS_PX,
  FITTING_COARSE_HIT_STROKE_PX,
  FITTING_GHOST_MAX_DIAMETER_PX,
  FITTING_HIT_STROKE_PX,
  fittingGhostScale,
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

test("T/Y repair chrome and run grips remain screen-sized at 668% zoom", () => {
  const zoom = 6.68;
  const scale = fittingOverlayScale(zoom);
  for (const pixels of [4, 7, 8, 10, 12]) {
    assert.ok(Math.abs(pixels * scale * zoom - pixels) < 1e-9);
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

test("geometry v4 is compact while legacy, v2, and v3 reaches remain exact", () => {
  const expectedByVersion = new Map([
    [undefined, [
      [14, 15.04, 16.56, 18.08],
      [14.52, 16.04, 17.56, 19.08],
      [17.52, 19.04, 20.56, 22.08],
    ]],
    [2, [
      [9, 9.5, 10.5, 11.5],
      [9, 10, 11, 12],
      [10, 11, 12, 13],
    ]],
    [3, [
      [6, 6, 6, 6.5],
      [6, 6, 6.5, 7],
      [6, 6.5, 7, 7.5],
    ]],
    [4, [
      [4, 4, 4.25, 4.5],
      [4.25, 4.5, 4.75, 5],
      [4.75, 5, 5.25, 5.5],
    ]],
  ]);
  const sizes = ["4", "8", "12", "16"];

  for (const [version, expectedByPort] of expectedByVersion) {
    for (const port of [0, 1, 2]) {
      assert.deepEqual(
        sizes.map((size) => Number(fittingPortReachForVersion(size, port, version).toFixed(5))),
        expectedByPort[port],
      );
    }
  }

  for (const size of sizes) {
    for (const port of [0, 1, 2]) {
      assert.ok(
        fittingPortReachForVersion(size, port, 4) <=
          fittingPortReachForVersion(size, port, 3) * .8,
        `expected v4 ${size}-inch port ${port + 1} to be at least 20% smaller than v3`,
      );
    }
  }
});

test("T/Y ghost display stays within 48 screen pixels from 25% through 800% zoom", () => {
  assert.equal(FITTING_GHOST_MAX_DIAMETER_PX, 48);
  const portSizes = ["16", "16", "16"];

  for (const version of [undefined, 2, 3, 4]) {
    const maximumReach = Math.max(
      ...portSizes.map((size, port) => fittingPortReachForVersion(size, port, version)),
    );
    for (const zoom of [.25, .5, 1, 2, 4, 8]) {
      const scale = fittingGhostScale(portSizes, version, zoom);
      assert.ok(scale > 0 && scale <= 1);
      assert.ok(
        maximumReach * 2 * zoom * scale <= FITTING_GHOST_MAX_DIAMETER_PX,
        `expected v${version ?? "legacy"} at ${zoom * 100}% to stay within the screen-space cap`,
      );
    }
  }

  const maximumReach = fittingPortReachForVersion("16", 2, 4);
  assert.equal(fittingGhostScale(portSizes, 4, .25), 1);
  assert.equal(fittingGhostScale(portSizes, 4, 8), 48 / (maximumReach * 2 * 8));
  assert.equal(fittingGhostScale(portSizes, 4, 0), 1);
  assert.equal(fittingGhostScale(portSizes, 4, Number.NaN), 1);
});

test("T/Y placement uses narrow, intentional run matching", () => {
  assert.equal(BRANCH_PICK_RADIUS_PX, 24);
  assert.equal(BRANCH_ATTACH_RADIUS_PX, 28);
  assert.equal(BRANCH_AUTO_MATCH_RADIUS_PX, 18);
  assert.equal(BRANCH_THREE_RUN_RADIUS_PX, 28);
  assert.ok(BRANCH_AUTO_MATCH_RADIUS_PX < BRANCH_PICK_RADIUS_PX);
});
