import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  smoothRedlineStrokePath,
} = await loadTypescriptModule(
  new URL("../app/redlineStrokePath.ts", import.meta.url),
);

test("freehand path is empty without points and visible for a single tap", () => {
  assert.equal(smoothRedlineStrokePath([]), "");
  assert.equal(
    smoothRedlineStrokePath([{ x: 12, y: 18 }]),
    "M 12 18 l 0.01 0",
  );
});

test("freehand path uses midpoint quadratic curves instead of angular segments", () => {
  const path = smoothRedlineStrokePath([
    { x: 0, y: 0 },
    { x: 10, y: 20 },
    { x: 20, y: 10 },
    { x: 30, y: 30 },
  ]);

  assert.equal(
    path,
    "M 0 0 Q 10 20 15 15 Q 20 10 25 20 Q 30 30 30 30",
  );
  assert.doesNotMatch(path, /\sL\s/);
});

test("two-point freehand paths preserve their exact endpoints", () => {
  assert.equal(
    smoothRedlineStrokePath([
      { x: 1.23456, y: 2.34567 },
      { x: 8.76543, y: 9.87654 },
    ]),
    "M 1.235 2.346 L 8.765 9.877",
  );
});
