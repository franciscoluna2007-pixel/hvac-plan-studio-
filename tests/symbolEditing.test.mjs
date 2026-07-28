import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  DEFAULT_EQUIPMENT_LABEL_SCALE,
  DEFAULT_EQUIPMENT_SYMBOL_SCALE,
  DEFAULT_OTHER_LABEL_SCALE,
  DEFAULT_OTHER_SYMBOL_SCALE,
  DEFAULT_TERMINAL_LABEL_SCALE,
  DEFAULT_TERMINAL_SYMBOL_SCALE,
  MAX_SYMBOL_LABEL_OFFSET,
  clampSymbolLabelOffset,
  defaultSymbolLabelScale,
  defaultSymbolScale,
  estimateSymbolLabelBox,
  normalizedSymbolLabelScale,
  normalizedSymbolScale,
  signedCornerScale,
} = await loadTypescriptModule(
  new URL("../app/symbolEditing.ts", import.meta.url),
);

test("keeps missing legacy icon and label scales at 100 percent", () => {
  assert.equal(normalizedSymbolScale(), 1);
  assert.equal(normalizedSymbolScale(null), 1);
  assert.equal(normalizedSymbolScale(Number.NaN), 1);
  assert.equal(normalizedSymbolLabelScale(), 1);
  assert.equal(normalizedSymbolLabelScale(null), 1);
  assert.equal(normalizedSymbolLabelScale(Number.POSITIVE_INFINITY), 1);
});

test("clamps persisted icon and label scales to safe visual ranges", () => {
  assert.equal(normalizedSymbolScale(0.1), 0.4);
  assert.equal(normalizedSymbolScale(9), 3);
  assert.equal(normalizedSymbolScale(1.35), 1.35);
  assert.equal(normalizedSymbolLabelScale(0.1), 0.65);
  assert.equal(normalizedSymbolLabelScale(9), 1.75);
  assert.equal(normalizedSymbolLabelScale(1.2), 1.2);
});

test("provides smaller explicit defaults without changing legacy normalization", () => {
  assert.equal(defaultSymbolScale("diffuser"), DEFAULT_TERMINAL_SYMBOL_SCALE);
  assert.equal(defaultSymbolScale("returnGrille"), DEFAULT_TERMINAL_SYMBOL_SCALE);
  assert.equal(defaultSymbolScale("equipment"), DEFAULT_EQUIPMENT_SYMBOL_SCALE);
  assert.equal(defaultSymbolScale("fan"), DEFAULT_OTHER_SYMBOL_SCALE);
  assert.equal(defaultSymbolLabelScale("diffuser"), DEFAULT_TERMINAL_LABEL_SCALE);
  assert.equal(defaultSymbolLabelScale("returnGrille"), DEFAULT_TERMINAL_LABEL_SCALE);
  assert.equal(defaultSymbolLabelScale("equipment"), DEFAULT_EQUIPMENT_LABEL_SCALE);
  assert.equal(defaultSymbolLabelScale("note"), DEFAULT_OTHER_LABEL_SCALE);

  assert.ok(defaultSymbolScale("diffuser") < normalizedSymbolScale());
  assert.ok(defaultSymbolScale("equipment") < normalizedSymbolScale());
  assert.ok(defaultSymbolLabelScale("note") < normalizedSymbolLabelScale());
});

test("estimates deterministic padded label boxes and applies label scale", () => {
  const short = estimateSymbolLabelBox("EF-1", 1);
  const long = estimateSymbolLabelBox("SYSTEM 1 · 3 TON AIR HANDLER", 1);
  const scaled = estimateSymbolLabelBox("SYSTEM 1 · 3 TON AIR HANDLER", 0.75);

  assert.ok(short.width >= 28);
  assert.ok(long.width > short.width);
  assert.equal(long.height, 16);
  assert.equal(scaled.width, long.width * 0.75);
  assert.equal(scaled.height, 12);
  assert.equal(long.halfWidth, long.width / 2);
  assert.equal(long.halfHeight, long.height / 2);
});

test("bounds symbol label offsets radially and repairs malformed values", () => {
  assert.deepEqual(clampSymbolLabelOffset(), { x: 0, y: 0 });
  assert.deepEqual(clampSymbolLabelOffset({ x: Number.NaN, y: 12 }), { x: 0, y: 12 });
  assert.deepEqual(clampSymbolLabelOffset({ x: 30, y: 40 }), { x: 30, y: 40 });

  const bounded = clampSymbolLabelOffset({ x: 300, y: 400 });
  assert.ok(Math.abs(Math.hypot(bounded.x, bounded.y) - MAX_SYMBOL_LABEL_OFFSET) < 1e-9);
  assert.ok(Math.abs(bounded.x / bounded.y - 0.75) < 1e-9);
});

test("uses the active corner sign and clamps after crossing the center", () => {
  assert.equal(signedCornerScale(30, 1, 20), 1.5);
  assert.equal(signedCornerScale(-30, -1, 20), 1.5);

  // Crossing the center stays at the minimum instead of rebounding to 1.5.
  assert.equal(signedCornerScale(-30, 1, 20), 0.4);
  assert.equal(signedCornerScale(30, -1, 20), 0.4);
  assert.equal(signedCornerScale(200, 1, 20), 3);
});

test("falls back to the current scale for invalid resize geometry", () => {
  assert.equal(signedCornerScale(Number.NaN, 1, 20, 1.4), 1.4);
  assert.equal(signedCornerScale(20, 1, 0, 0.2), 0.4);
  assert.equal(signedCornerScale(20, 0, 20, 1.25), 1.25);
});
