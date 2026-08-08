import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRigidStraightMeta,
  rigidCompactPhysicalWidthInches,
  rigidCompactPlanWidthUnits,
  rigidCompactScreenPlanWidthUnits,
  rigidEdgeLines,
  rigidHorizontalLengthFeet,
  rigidPlanWidthUnits,
  rigidRoundBands,
  rigidSizeLabel,
  rigidSpiralSeams,
} from "../app/rigidDuct.ts";

const rectangular = {
  version: 1,
  kind: "straight",
  networkKind: "supply",
  construction: "rectangular",
  size: { shape: "rectangular", widthInches: 24, heightInches: 12 },
};

test("normalizes first-class rectangular, round-metal, and spiral sizes", () => {
  assert.deepEqual(normalizeRigidStraightMeta(rectangular), rectangular);
  for (const construction of ["round-metal", "spiral"]) {
    const meta = normalizeRigidStraightMeta({
      version: 1,
      kind: "straight",
      networkKind: "return",
      construction,
      size: { shape: "round", diameterInches: 10 },
    });
    assert.equal(meta?.construction, construction);
    assert.equal(rigidSizeLabel(meta), "10");
  }
  assert.equal(normalizeRigidStraightMeta({ ...rectangular, construction: "spiral" }), null);
});

test("derives true plan width and calibrated horizontal length independently", () => {
  const meta = normalizeRigidStraightMeta(rectangular);
  assert.ok(meta);
  assert.equal(rigidPlanWidthUnits(meta, 1 / 24), 48);
  assert.equal(rigidHorizontalLengthFeet([{ x: 10, y: 20 }, { x: 250, y: 20 }], 1 / 24), 10);
  assert.equal(rigidHorizontalLengthFeet([{ x: 10, y: 20 }, { x: 250, y: 20 }], 1 / 24, false), null);
});

test("compresses only drafting width while exact dimensions and calibrated geometry stay truthful", () => {
  const sizes = [12, 30, 40, 72].map((widthInches) => normalizeRigidStraightMeta({
    ...rectangular,
    size: { shape: "rectangular", widthInches, heightInches: 10 },
  }));
  assert.ok(sizes.every(Boolean));
  const [twelve, thirty, forty, seventyTwo] = sizes;
  assert.equal(rigidCompactPhysicalWidthInches(twelve), 12);
  assert.ok(rigidCompactPhysicalWidthInches(thirty) < 19);
  assert.ok(rigidCompactPhysicalWidthInches(forty) < 20);
  assert.ok(rigidCompactPhysicalWidthInches(forty) > rigidCompactPhysicalWidthInches(thirty));
  assert.ok(rigidCompactPhysicalWidthInches(seventyTwo) > rigidCompactPhysicalWidthInches(forty));
  assert.ok(rigidCompactPhysicalWidthInches(seventyTwo) < 22);
  assert.ok(Math.abs(rigidPlanWidthUnits(forty, 1 / 24) - 80) < 1e-9);
  assert.ok(rigidCompactPlanWidthUnits(forty, 1 / 24) < 40);
  assert.equal(rigidSizeLabel(forty), "40×10");
  assert.equal(rigidHorizontalLengthFeet([{ x: 0, y: 0 }, { x: 240, y: 0 }], 1 / 24), 10);
});

test("keeps the compact drafting footprint stable in screen space at every zoom", () => {
  for (const zoom of [.25, 1, 4.08, 12]) {
    const planWidth = rigidCompactScreenPlanWidthUnits(zoom);
    assert.ok(Math.abs(planWidth * zoom - 10.4) < 1e-9);
  }
  assert.equal(rigidCompactScreenPlanWidthUnits(0), 0);
  assert.equal(rigidCompactScreenPlanWidthUnits(4, 10), 2.5);
});

test("builds stable physical edges and bounded spiral seam geometry", () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  assert.deepEqual(rigidEdgeLines(points, 20), [
    [{ x: 0, y: 10 }, { x: 100, y: 10 }],
    [{ x: 0, y: -10 }, { x: 100, y: -10 }],
  ]);
  const seams = rigidSpiralSeams(points, 10, 5);
  assert.ok(seams.length > 0 && seams.length <= 5);
  assert.ok(seams.every(([start, end]) => start.y > 0 && end.y < 0));
  const bands = rigidRoundBands(points, 10, 5);
  assert.ok(bands.length > 0 && bands.length <= 5);
  assert.ok(bands.every(([start, end]) => start.x === end.x && start.y > 0 && end.y < 0));
});
