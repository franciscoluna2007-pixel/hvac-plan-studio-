import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const eraser = await loadTypescriptModule(
  new URL("../app/redlineEraser.ts", import.meta.url),
);

const binding = {
  sourceFingerprint: "pdf-1",
  page: 1,
};

function ink(id, points, overrides = {}) {
  return {
    id,
    kind: "ink",
    layerId: "field-redlines",
    binding,
    style: {
      color: "#dc2626",
      strokeWidth: 0.002,
      opacity: 1,
    },
    points,
    ...overrides,
  };
}

test("eraser size is bounded to a practical sheet-relative range", () => {
  assert.equal(
    eraser.normalizeRedlineEraserSize(-1),
    eraser.REDLINE_ERASER_MIN_SIZE,
  );
  assert.equal(
    eraser.normalizeRedlineEraserSize(1),
    eraser.REDLINE_ERASER_MAX_SIZE,
  );
  assert.equal(
    eraser.normalizeRedlineEraserSize(Number.NaN),
    eraser.REDLINE_ERASER_DEFAULT_SIZE,
  );
});

test("eraser size is remembered locally and storage failures stay safe", () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
  assert.equal(
    eraser.saveRedlineEraserSize(0.08, storage),
    0.08,
  );
  assert.equal(eraser.loadRedlineEraserSize(storage), 0.08);
  assert.equal(
    eraser.loadRedlineEraserSize({
      getItem() {
        throw new Error("blocked");
      },
      setItem() {},
    }),
    eraser.REDLINE_ERASER_DEFAULT_SIZE,
  );
  assert.doesNotThrow(() =>
    eraser.saveRedlineEraserSize(0.06, {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error("blocked");
      },
    }));
});

test("a swept eraser catches skipped-over strokes without touching distant work", () => {
  const annotations = [
    ink("crossed", [
      { x: 0.48, y: 0.4 },
      { x: 0.48, y: 0.6 },
    ]),
    ink("distant", [
      { x: 0.8, y: 0.4 },
      { x: 0.8, y: 0.6 },
    ]),
  ];
  assert.deepEqual(
    eraser.redlineEraserHitIds({
      annotations,
      binding,
      layerId: "field-redlines",
      from: { x: 0.2, y: 0.5 },
      to: { x: 0.7, y: 0.5 },
      size: 0.04,
      pageAspectRatio: 1.5,
    }),
    ["crossed"],
  );
});

test("square pen-tip corners erase as painted while circle corners stay empty", () => {
  const style = {
    color: "#dc2626",
    strokeWidth: 0.1,
    opacity: 1,
  };
  const common = {
    binding,
    layerId: "field-redlines",
    from: { x: 0.55, y: 0.55 },
    to: { x: 0.55, y: 0.55 },
    size: 0.01,
    pageAspectRatio: 1,
  };
  const square = ink(
    "square-tip",
    [{ x: 0.5, y: 0.5 }],
    { brushTip: "square", style },
  );
  const circle = ink(
    "circle-tip",
    [{ x: 0.5, y: 0.5 }],
    { brushTip: "circle", style },
  );

  assert.deepEqual(
    eraser.redlineEraserHitIds({
      ...common,
      annotations: [square, circle],
    }),
    ["square-tip"],
  );
});

test("square pen-tip erasing stays outside an unpainted side gap", () => {
  const square = ink(
    "square-tip",
    [{ x: 0.5, y: 0.5 }],
    {
      brushTip: "square",
      style: {
        color: "#dc2626",
        strokeWidth: 0.1,
        opacity: 1,
      },
    },
  );

  assert.deepEqual(
    eraser.redlineEraserHitIds({
      annotations: [square],
      binding,
      layerId: "field-redlines",
      from: { x: 0.57, y: 0.5 },
      to: { x: 0.57, y: 0.5 },
      size: 0.01,
      pageAspectRatio: 1,
    }),
    [],
  );
});

test("larger eraser sizes reach nearby marks and respect page and layer scope", () => {
  const nearby = ink("nearby", [
    { x: 0.55, y: 0.46 },
    { x: 0.55, y: 0.54 },
  ]);
  const otherPage = ink(
    "other-page",
    [{ x: 0.5, y: 0.5 }],
    { binding: { ...binding, page: 2 } },
  );
  const otherLayer = ink(
    "other-layer",
    [{ x: 0.5, y: 0.5 }],
    { layerId: "locked-notes" },
  );
  const common = {
    annotations: [nearby, otherPage, otherLayer],
    binding,
    layerId: "field-redlines",
    from: { x: 0.5, y: 0.5 },
    to: { x: 0.5, y: 0.5 },
    pageAspectRatio: 1,
  };
  assert.deepEqual(
    eraser.redlineEraserHitIds({ ...common, size: 0.04 }),
    [],
  );
  assert.deepEqual(
    eraser.redlineEraserHitIds({ ...common, size: 0.12 }),
    ["nearby"],
  );
});

test("eraser brush can remove a callout by crossing its visible area", () => {
  const rectangle = {
    id: "box",
    kind: "rectangle",
    layerId: "field-redlines",
    binding,
    style: {
      color: "#dc2626",
      strokeWidth: 0.002,
      opacity: 1,
    },
    start: { x: 0.3, y: 0.3 },
    end: { x: 0.5, y: 0.5 },
  };
  assert.deepEqual(
    eraser.redlineEraserHitIds({
      annotations: [rectangle],
      binding,
      layerId: "field-redlines",
      from: { x: 0.25, y: 0.4 },
      to: { x: 0.35, y: 0.4 },
      size: 0.02,
      pageAspectRatio: 1,
    }),
    ["box"],
  );
});

test("outlined shapes erase only at visible edges while solid marks erase inside", () => {
  const outline = {
    id: "outline",
    kind: "rectangle",
    layerId: "field-redlines",
    binding,
    style: {
      color: "#dc2626",
      strokeWidth: 0.002,
      opacity: 1,
    },
    start: { x: 0.2, y: 0.2 },
    end: { x: 0.6, y: 0.6 },
  };
  const solid = {
    ...outline,
    id: "solid",
    style: {
      ...outline.style,
      fillColor: "#dc2626",
    },
  };
  const common = {
    binding,
    layerId: "field-redlines",
    from: { x: 0.4, y: 0.4 },
    to: { x: 0.4, y: 0.4 },
    size: 0.02,
    pageAspectRatio: 1,
  };
  assert.deepEqual(
    eraser.redlineEraserHitIds({
      ...common,
      annotations: [outline],
    }),
    [],
  );
  assert.deepEqual(
    eraser.redlineEraserHitIds({
      ...common,
      annotations: [solid],
    }),
    ["solid"],
  );
});

test("outlined circles do not erase from empty corners or their empty center", () => {
  const circle = {
    id: "circle",
    kind: "circle",
    layerId: "field-redlines",
    binding,
    style: {
      color: "#dc2626",
      strokeWidth: 0.002,
      opacity: 1,
    },
    start: { x: 0.2, y: 0.2 },
    end: { x: 0.6, y: 0.6 },
  };
  const common = {
    annotations: [circle],
    binding,
    layerId: "field-redlines",
    size: 0.02,
    pageAspectRatio: 1,
  };
  assert.deepEqual(
    eraser.redlineEraserHitIds({
      ...common,
      from: { x: 0.4, y: 0.4 },
      to: { x: 0.4, y: 0.4 },
    }),
    [],
  );
  assert.deepEqual(
    eraser.redlineEraserHitIds({
      ...common,
      from: { x: 0.22, y: 0.22 },
      to: { x: 0.22, y: 0.22 },
    }),
    [],
  );
  assert.deepEqual(
    eraser.redlineEraserHitIds({
      ...common,
      from: { x: 0.39, y: 0.2 },
      to: { x: 0.41, y: 0.2 },
    }),
    ["circle"],
  );
});

test("visible long text and arrowheads are part of the erasable geometry", () => {
  const text = {
    id: "text",
    kind: "text",
    layerId: "field-redlines",
    binding,
    style: {
      color: "#dc2626",
      strokeWidth: 0.002,
      opacity: 1,
      textScale: 2,
    },
    start: { x: 0.1, y: 0.1 },
    end: { x: 0.12, y: 0.12 },
    text: "LONG FIELD NOTE OUTSIDE ITS ORIGINAL DRAG BOX",
  };
  const arrow = {
    id: "arrow",
    kind: "arrow",
    layerId: "field-redlines",
    binding,
    style: {
      color: "#dc2626",
      strokeWidth: 0.002,
      opacity: 1,
    },
    start: { x: 0.2, y: 0.5 },
    end: { x: 0.6, y: 0.5 },
  };
  assert.deepEqual(
    eraser.redlineEraserHitIds({
      annotations: [text],
      binding,
      layerId: "field-redlines",
      from: { x: 0.3, y: 0.12 },
      to: { x: 0.3, y: 0.12 },
      size: 0.01,
      pageAspectRatio: 1,
    }),
    ["text"],
  );
  assert.deepEqual(
    eraser.redlineEraserHitIds({
      annotations: [arrow],
      binding,
      layerId: "field-redlines",
      from: { x: 0.588, y: 0.493 },
      to: { x: 0.588, y: 0.493 },
      size: 0.01,
      pageAspectRatio: 1,
    }),
    ["arrow"],
  );
});
