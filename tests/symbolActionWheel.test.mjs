import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  DEFAULT_SYMBOL_ACTION_WHEEL_INSET,
  DEFAULT_SYMBOL_ACTION_WHEEL_RADIUS,
  positionSymbolActionWheel,
} = await loadTypescriptModule(
  new URL("../app/symbolActionWheel.ts", import.meta.url),
);

function input(overrides = {}) {
  return {
    anchor: { x: 500, y: 350 },
    viewport: { width: 1000, height: 700 },
    objectRadius: 20,
    zoom: 1,
    ...overrides,
  };
}

function assertFinite(position) {
  for (const value of [
    position.center.x,
    position.center.y,
    position.offset.x,
    position.offset.y,
    position.objectRadiusPx,
    position.wheelRadius,
    position.inset,
  ]) {
    assert.equal(Number.isFinite(value), true, `expected ${value} to be finite`);
  }
}

function assertInside(position, viewport) {
  assert.ok(
    position.center.x - position.wheelRadius >= position.inset,
    "wheel should stay inside the left inset",
  );
  assert.ok(
    position.center.x + position.wheelRadius <= viewport.width - position.inset,
    "wheel should stay inside the right inset",
  );
  assert.ok(
    position.center.y - position.wheelRadius >= position.inset,
    "wheel should stay inside the top inset",
  );
  assert.ok(
    position.center.y + position.wheelRadius <= viewport.height - position.inset,
    "wheel should stay inside the bottom inset",
  );
}

function assertDoesNotOverlap(position, anchor, gap = 12) {
  const separation = Math.hypot(position.offset.x, position.offset.y);
  assert.ok(
    separation >= position.objectRadiusPx + position.wheelRadius + gap,
    "wheel footprint should not overlap the selected symbol",
  );
  assert.deepEqual(
    {
      x: position.center.x - anchor.x,
      y: position.center.y - anchor.y,
    },
    position.offset,
  );
}

test("places a fixed-size wheel deterministically beside a centered symbol", () => {
  const position = positionSymbolActionWheel(input());

  assert.equal(position.hidden, false);
  assert.equal(position.placement, "right");
  assert.deepEqual(position.center, { x: 628, y: 350 });
  assert.deepEqual(position.offset, { x: 128, y: 0 });
  assert.equal(position.wheelRadius, DEFAULT_SYMBOL_ACTION_WHEEL_RADIUS);
  assert.equal(position.inset, DEFAULT_SYMBOL_ACTION_WHEEL_INSET);
  assertInside(position, { width: 1000, height: 700 });
  assertDoesNotOverlap(position, { x: 500, y: 350 });
});

test("flips the wheel inward when a symbol is near each viewport edge", () => {
  const cases = [
    [{ x: 990, y: 350 }, "left"],
    [{ x: 10, y: 350 }, "right"],
    [{ x: 500, y: 10 }, "below"],
    [{ x: 500, y: 690 }, "above"],
  ];

  for (const [anchor, expectedPlacement] of cases) {
    const position = positionSymbolActionWheel(input({ anchor }));
    assert.equal(position.hidden, false);
    assert.equal(position.placement, expectedPlacement);
    assertInside(position, { width: 1000, height: 700 });
    assertDoesNotOverlap(position, anchor);
  }
});

test("uses zoomed object radius to keep a large selected symbol clear", () => {
  const anchor = { x: 500, y: 350 };
  const position = positionSymbolActionWheel(input({
    anchor,
    objectRadius: 40,
    zoom: 3,
  }));

  assert.equal(position.hidden, false);
  assert.equal(position.objectRadiusPx, 120);
  assertInside(position, { width: 1000, height: 700 });
  assertDoesNotOverlap(position, anchor);
});

test("clamps a near-corner wheel to the twelve-pixel safe inset", () => {
  const anchor = { x: 5, y: 5 };
  const viewport = { width: 600, height: 400 };
  const position = positionSymbolActionWheel(input({ anchor, viewport }));

  assert.equal(position.hidden, false);
  assertInside(position, viewport);
  assertDoesNotOverlap(position, anchor);
});

test("hides for offscreen anchors or when no non-overlapping wheel can fit", () => {
  const offscreen = positionSymbolActionWheel(input({
    anchor: { x: -1, y: 350 },
  }));
  assert.equal(offscreen.hidden, true);
  assertFinite(offscreen);

  const tooSmall = positionSymbolActionWheel(input({
    anchor: { x: 90, y: 90 },
    viewport: { width: 180, height: 180 },
  }));
  assert.equal(tooSmall.hidden, true);
  assertFinite(tooSmall);

  const objectFillsViewport = positionSymbolActionWheel(input({
    objectRadius: 10_000,
  }));
  assert.equal(objectFillsViewport.hidden, true);
  assertFinite(objectFillsViewport);
});

test("keeps every returned coordinate finite across extreme zoom inputs", () => {
  for (const zoom of [
    0,
    Number.MIN_VALUE,
    1e-9,
    1,
    64,
    1e9,
    Number.POSITIVE_INFINITY,
    -3,
  ]) {
    const position = positionSymbolActionWheel(input({ zoom }));
    assertFinite(position);
  }

  const invalidAnchor = positionSymbolActionWheel(input({
    anchor: { x: Number.NaN, y: Number.POSITIVE_INFINITY },
  }));
  assert.equal(invalidAnchor.hidden, true);
  assertFinite(invalidAnchor);
});
