import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  redlineAnnotationVisualBounds,
  redlineCanvasArrowHeadPoints,
  redlineSelectionVisualBounds,
} = await loadTypescriptModule(
  new URL("../app/redlineVisualBounds.ts", import.meta.url),
);

function annotation(overrides = {}) {
  return {
    id: "redline-1",
    kind: "text",
    layerId: "field-redlines",
    binding: {
      sourceFingerprint: "source-1",
      page: 1,
    },
    style: {
      color: "#ff7a00",
      strokeWidth: 0.002,
      opacity: 1,
      textScale: 1,
    },
    start: { x: 0.2, y: 0.2 },
    end: { x: 0.21, y: 0.21 },
    text: "FIELD VERIFY",
    ...overrides,
  };
}

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

test("long multiline redline text expands beyond its raw drag box", () => {
  const visual = redlineAnnotationVisualBounds(
    annotation({
      text: "MOVE THIS SUPPLY DIFFUSER CLEAR OF THE LIGHT\nFIELD VERIFY",
      style: {
        color: "#ff7a00",
        strokeWidth: 0.002,
        opacity: 1,
        textScale: 4,
      },
    }),
    1000,
    700,
  );

  assert.equal(visual.x, 200);
  assert.equal(visual.y, 140);
  assert.ok(visual.width > 10, "visual text width should exceed the raw drag width");
  assert.ok(visual.height > 7, "multiline text height should exceed the raw drag height");
});

test("selection bounds union the full rendered footprints of every redline", () => {
  const visual = redlineSelectionVisualBounds(
    [
      annotation(),
      annotation({
        id: "redline-2",
        start: { x: 0.7, y: 0.65 },
        end: { x: 0.72, y: 0.67 },
        text: "RETURN AIR",
      }),
    ],
    1000,
    700,
  );

  assert.ok(visual);
  assert.equal(visual.x, 200);
  assert.equal(visual.y, 140);
  assert.ok(visual.width > 500);
  assert.ok(visual.height > 320);
});

test("stroke bounds include visible line thickness", () => {
  const visual = redlineAnnotationVisualBounds(
    annotation({
      kind: "ink",
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.3, y: 0.2 },
      ],
      style: {
        color: "#ff7a00",
        strokeWidth: 0.01,
        opacity: 1,
      },
    }),
    1000,
    700,
  );

  assert.ok(visual.x < 100);
  assert.ok(visual.y < 70);
  assert.ok(visual.width > 200);
  assert.ok(visual.height > 70);
});

test("rectangle, circle, and cloud bounds include the rendered callout stroke radius", () => {
  for (const kind of ["rectangle", "circle", "cloud"]) {
    const visual = redlineAnnotationVisualBounds(
      annotation({
        kind,
        start: { x: 0.2, y: 0.2 },
        end: { x: 0.4, y: 0.5 },
        style: {
          color: "#ff7a00",
          strokeWidth: 0.01,
          opacity: 1,
        },
      }),
      1000,
      700,
    );

    assert.deepEqual(
      visual,
      {
        x: 196.5,
        y: 136.5,
        width: 207,
        height: 217,
      },
      `${kind} should include half of its seven-pixel stroke on every edge`,
    );
  }
});

test("non-scaling callout strokes keep their full screen-space padding while zoomed out", () => {
  const visual = redlineAnnotationVisualBounds(
    annotation({
      kind: "rectangle",
      start: { x: 0.2, y: 0.2 },
      end: { x: 0.4, y: 0.5 },
      style: {
        color: "#ff7a00",
        strokeWidth: 0.01,
        opacity: 1,
      },
    }),
    1000,
    700,
    0.25,
  );

  assert.deepEqual(visual, {
    x: 186,
    y: 126,
    width: 228,
    height: 238,
  });
  assertClose(200 * 0.25 - visual.x * 0.25, 3.5, "screen stroke padding");
});

test("horizontal arrow bounds union the padded shaft with the exact rendered arrowhead", () => {
  const visual = redlineAnnotationVisualBounds(
    annotation({
      kind: "arrow",
      start: { x: 0.2, y: 0.5 },
      end: { x: 0.4, y: 0.5 },
      style: {
        color: "#ff7a00",
        strokeWidth: 0.01,
        opacity: 1,
      },
    }),
    1000,
    700,
  );

  assertClose(visual.x, 196.5, "padded shaft left");
  assertClose(visual.y, 342.3, "arrowhead top");
  assertClose(visual.width, 207, "padded shaft width");
  assertClose(visual.height, 15.4, "arrowhead height");
});

test("arrowhead point geometry matches the rendered tip and thirty-degree wings", () => {
  const points = redlineCanvasArrowHeadPoints(
    { x: 500, y: 100 },
    { x: 500, y: 300 },
    20,
  );

  assert.deepEqual(points[0], { x: 500, y: 300 });
  assertClose(points[1].x, 490, "first wing x");
  assertClose(
    points[1].y,
    300 - 20 * Math.cos(Math.PI / 6),
    "first wing y",
  );
  assertClose(points[2].x, 510, "second wing x");
  assertClose(
    points[2].y,
    300 - 20 * Math.cos(Math.PI / 6),
    "second wing y",
  );
});

test("selection union includes callout stroke and arrowhead overhang", () => {
  const visual = redlineSelectionVisualBounds(
    [
      annotation({
        id: "rectangle-1",
        kind: "rectangle",
        start: { x: 0.1, y: 0.1 },
        end: { x: 0.2, y: 0.2 },
        style: {
          color: "#ff7a00",
          strokeWidth: 0.01,
          opacity: 1,
        },
      }),
      annotation({
        id: "arrow-1",
        kind: "arrow",
        start: { x: 0.4, y: 0.5 },
        end: { x: 0.4, y: 0.7 },
        style: {
          color: "#ff7a00",
          strokeWidth: 0.01,
          opacity: 1,
        },
      }),
    ],
    1000,
    700,
  );

  assert.ok(visual);
  assertClose(visual.x, 96.5, "union left includes rectangle stroke");
  assert.ok(
    visual.x + visual.width > 407,
    "union right should include the vertical arrowhead wing",
  );
  assertClose(
    visual.y + visual.height,
    493.5,
    "union bottom includes the padded arrow shaft",
  );
});
