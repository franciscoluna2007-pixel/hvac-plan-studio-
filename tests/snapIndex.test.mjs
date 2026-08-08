import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  evaluateSnapIntersectionShadow,
  snapSegmentIntersection,
} = await loadTypescriptModule(new URL("../app/snapIndex.ts", import.meta.url));

const crossingFixture = Object.freeze([
  Object.freeze({
    drawingId: "main",
    segmentIndex: 0,
    sourceOrdinal: 0,
    a: Object.freeze({ x: 0, y: 0 }),
    b: Object.freeze({ x: 10, y: 0 }),
  }),
  Object.freeze({
    drawingId: "branch-a",
    segmentIndex: 0,
    sourceOrdinal: 1,
    a: Object.freeze({ x: 5, y: -5 }),
    b: Object.freeze({ x: 5, y: 5 }),
  }),
  Object.freeze({
    drawingId: "branch-b",
    segmentIndex: 0,
    sourceOrdinal: 2,
    a: Object.freeze({ x: 0, y: 5 }),
    b: Object.freeze({ x: 10, y: -5 }),
  }),
]);

function pairSignatures(intersections) {
  return intersections.map((intersection) => [
    intersection.firstSourceOrdinal,
    intersection.secondSourceOrdinal,
    intersection.point,
  ]);
}

test("native exhaustive reference preserves stable pair order and exact intersections", () => {
  const result = evaluateSnapIntersectionShadow(crossingFixture);

  assert.equal(result.shadow, null);
  assert.deepEqual(pairSignatures(result.authoritative), [
    [0, 1, { x: 5, y: 0 }],
    [0, 2, { x: 5, y: 0 }],
    [1, 2, { x: 5, y: 0 }],
  ]);
});

test("reference keeps the production near-parallel threshold and endpoint inclusion", () => {
  assert.equal(
    snapSegmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0.00001 },
      { x: 10, y: 0.00002 },
    ),
    null,
  );
  assert.deepEqual(
    snapSegmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
    ),
    { x: 10, y: 0 },
  );
});

test("reference excludes pairs owned by the same drawing", () => {
  const sameDrawing = crossingFixture.map((segment) => ({ ...segment, drawingId: "one-polyline" }));
  const result = evaluateSnapIntersectionShadow(sameDrawing);

  assert.deepEqual(result.authoritative, []);
});

test("a candidate may reduce tested pairs while matching authoritative intersections", () => {
  const candidate = {
    id: "native-bbox-proof",
    collectPairs: () => [[2, 1], [0, 2], [1, 0], [0, 1]],
  };
  const result = evaluateSnapIntersectionShadow(crossingFixture, candidate);

  assert.equal(result.shadow.status, "match");
  assert.equal(result.shadow.candidatePairCount, 3);
  assert.deepEqual(pairSignatures(result.authoritative), [
    [0, 1, { x: 5, y: 0 }],
    [0, 2, { x: 5, y: 0 }],
    [1, 2, { x: 5, y: 0 }],
  ]);
});

test("a missing candidate pair reports mismatch without changing the authoritative answer", () => {
  const baseline = evaluateSnapIntersectionShadow(crossingFixture).authoritative;
  const result = evaluateSnapIntersectionShadow(crossingFixture, {
    id: "missing-pair",
    collectPairs: () => [[0, 1], [0, 2]],
  });

  assert.equal(result.shadow.status, "mismatch");
  assert.deepEqual(result.shadow.firstMismatch, {
    index: 2,
    expected: "1:2:5:0",
    observed: null,
  });
  assert.deepEqual(result.authoritative, baseline);
});

test("candidate errors fall back deterministically and cannot mutate the reference payload", () => {
  const baseline = evaluateSnapIntersectionShadow(crossingFixture).authoritative;
  const result = evaluateSnapIntersectionShadow(crossingFixture, {
    id: "mutating-candidate",
    collectPairs: (segments) => {
      segments[0].a.x = 999;
      return [];
    },
  });

  assert.equal(result.shadow.status, "candidate-error");
  assert.match(result.shadow.error, /read only|Cannot assign/i);
  assert.deepEqual(result.authoritative, baseline);
  assert.equal(crossingFixture[0].a.x, 0);
});

test("unknown or duplicate source ordinals never enter authoritative behavior", () => {
  const duplicateOrdinal = [crossingFixture[0], { ...crossingFixture[1], sourceOrdinal: 0 }];
  assert.throws(
    () => evaluateSnapIntersectionShadow(duplicateOrdinal),
    /unique integer source ordinals/,
  );

  const result = evaluateSnapIntersectionShadow(crossingFixture, {
    id: "unknown-ordinal",
    collectPairs: () => [[0, 99]],
  });
  assert.equal(result.shadow.status, "candidate-error");
  assert.match(result.shadow.error, /unknown segment ordinal/);
});
