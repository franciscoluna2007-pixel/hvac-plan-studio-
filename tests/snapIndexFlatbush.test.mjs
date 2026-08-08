import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  evaluateSnapIntersectionShadow,
  resolveSnapIntersections,
} = await loadTypescriptModule(
  new URL("../app/snapIndex.ts", import.meta.url),
);
const { createFlatbushSnapPairCandidateAdapter } = await loadTypescriptModule(
  new URL("../app/snapIndexFlatbush.ts", import.meta.url),
);

function segment(drawingId, sourceOrdinal, a, b, segmentIndex = 0) {
  return { drawingId, sourceOrdinal, segmentIndex, a, b };
}

const indexedFixture = Object.freeze([
  segment("main", 0, { x: 0, y: 0 }, { x: 10, y: 0 }),
  segment("branch", 1, { x: 5, y: -5 }, { x: 5, y: 5 }),
  segment("far-a", 2, { x: 100, y: 100 }, { x: 110, y: 100 }),
  segment("far-b", 3, { x: 105, y: 95 }, { x: 105, y: 105 }),
]);

test("Flatbush broad phase matches exhaustive intersections while reducing candidate pairs", () => {
  const candidate = createFlatbushSnapPairCandidateAdapter();
  const result = evaluateSnapIntersectionShadow(indexedFixture, candidate);

  assert.equal(candidate.id, "flatbush-4.6.2");
  assert.equal(result.shadow.status, "match");
  assert.equal(result.shadow.referenceIntersectionCount, 2);
  assert.equal(result.shadow.candidateIntersectionCount, 2);
  assert.equal(result.shadow.candidatePairCount, 2);
  assert.deepEqual(result.authoritative.map(({ firstSourceOrdinal, secondSourceOrdinal, point }) => ({
    firstSourceOrdinal,
    secondSourceOrdinal,
    point,
  })), [
    { firstSourceOrdinal: 0, secondSourceOrdinal: 1, point: { x: 5, y: 0 } },
    { firstSourceOrdinal: 2, secondSourceOrdinal: 3, point: { x: 105, y: 100 } },
  ]);
});

test("Flatbush includes touching endpoint boxes for the exact narrow phase", () => {
  const candidate = createFlatbushSnapPairCandidateAdapter();
  const touching = [
    segment("first", 0, { x: 0, y: 0 }, { x: 10, y: 0 }),
    segment("second", 1, { x: 10, y: 0 }, { x: 10, y: 8 }),
  ];
  const result = evaluateSnapIntersectionShadow(touching, candidate);

  assert.equal(result.shadow.status, "match");
  assert.equal(result.shadow.candidatePairCount, 1);
  assert.deepEqual(result.authoritative[0].point, { x: 10, y: 0 });
});

test("Flatbush memoizes an unchanged geometry revision", () => {
  const candidate = createFlatbushSnapPairCandidateAdapter();
  const firstPairs = candidate.collectPairs(indexedFixture);
  const firstDiagnostics = candidate.diagnostics();
  const secondPairs = candidate.collectPairs(indexedFixture.map((item) => ({
    ...item,
    a: { ...item.a },
    b: { ...item.b },
  })));

  assert.strictEqual(secondPairs, firstPairs);
  assert.deepEqual(candidate.diagnostics(), firstDiagnostics);
  assert.deepEqual(firstDiagnostics, {
    revision: 1,
    indexBuildCount: 1,
    indexedSegmentCount: 4,
    hasPackedIndex: true,
  });
});

test("Flatbush invalidates the packed index for geometry, order, or ownership changes", () => {
  const candidate = createFlatbushSnapPairCandidateAdapter();
  candidate.collectPairs(indexedFixture);

  const moved = indexedFixture.map((item, index) => index === 1
    ? { ...item, a: { x: 6, y: -5 }, b: { x: 6, y: 5 } }
    : item);
  candidate.collectPairs(moved);
  assert.deepEqual(candidate.diagnostics(), {
    revision: 2,
    indexBuildCount: 2,
    indexedSegmentCount: 4,
    hasPackedIndex: true,
  });

  candidate.collectPairs([...moved].reverse());
  assert.equal(candidate.diagnostics().revision, 3);
  assert.equal(candidate.diagnostics().indexBuildCount, 3);

  candidate.collectPairs(moved.map((item, index) => index === 1
    ? { ...item, drawingId: "main" }
    : item));
  assert.equal(candidate.diagnostics().revision, 4);
  assert.equal(candidate.diagnostics().indexBuildCount, 4);
});

test("Flatbush failures are fail-closed and leave exhaustive snaps authoritative", () => {
  const candidate = createFlatbushSnapPairCandidateAdapter();
  const invalid = [
    segment("first", 0, { x: 0, y: 0 }, { x: 10, y: 0 }),
    segment("invalid", 1, { x: Number.NaN, y: -5 }, { x: 5, y: 5 }),
  ];
  const result = evaluateSnapIntersectionShadow(invalid, candidate);

  assert.equal(result.shadow.status, "candidate-error");
  assert.match(result.shadow.error, /finite segment coordinates/);
  assert.deepEqual(result.authoritative, []);
  assert.deepEqual(candidate.diagnostics(), {
    revision: 0,
    indexBuildCount: 0,
    indexedSegmentCount: 0,
    hasPackedIndex: false,
  });

  const resolved = resolveSnapIntersections(invalid, candidate);
  assert.equal(resolved.source, "legacy-fallback");
  assert.match(resolved.error, /finite segment coordinates/);
  assert.deepEqual(resolved.intersections, result.authoritative);
});

test("Flatbush safely handles an empty page without constructing an invalid zero-item index", () => {
  const candidate = createFlatbushSnapPairCandidateAdapter();
  const result = evaluateSnapIntersectionShadow([], candidate);

  assert.equal(result.shadow.status, "match");
  assert.equal(result.shadow.candidatePairCount, 0);
  assert.deepEqual(result.authoritative, []);
  assert.deepEqual(candidate.diagnostics(), {
    revision: 1,
    indexBuildCount: 0,
    indexedSegmentCount: 0,
    hasPackedIndex: false,
  });
});

test("the explicit rollback switch bypasses Flatbush and preserves legacy order", () => {
  let candidateCalls = 0;
  const candidate = {
    id: "must-not-run",
    collectPairs: () => {
      candidateCalls += 1;
      throw new Error("rollback switch failed");
    },
  };
  const resolved = resolveSnapIntersections(indexedFixture, candidate, { forceLegacy: true });

  assert.equal(candidateCalls, 0);
  assert.equal(resolved.source, "legacy-switch");
  assert.deepEqual(resolved.intersections.map(({ firstSourceOrdinal, secondSourceOrdinal }) => [
    firstSourceOrdinal,
    secondSourceOrdinal,
  ]), [[0, 1], [2, 3]]);
});

test("malformed Flatbush candidate output falls back synchronously", () => {
  const legacy = resolveSnapIntersections(indexedFixture, undefined).intersections;
  const resolved = resolveSnapIntersections(indexedFixture, {
    id: "malformed-proof",
    collectPairs: () => [[0, 99]],
  });

  assert.equal(resolved.source, "legacy-fallback");
  assert.match(resolved.error, /unknown segment ordinal/);
  assert.deepEqual(resolved.intersections, legacy);
});

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test("Flatbush matches legacy intersections exactly across seeded plan geometries", () => {
  const candidate = createFlatbushSnapPairCandidateAdapter();
  for (let seed = 1; seed <= 100; seed += 1) {
    const random = seededRandom(seed);
    const segments = Array.from({ length: 64 }, (_, sourceOrdinal) => {
      const x = Math.floor(random() * 400) - 200;
      const y = Math.floor(random() * 400) - 200;
      const dx = Math.floor(random() * 121) - 60;
      const dy = Math.floor(random() * 121) - 60;
      return segment(
        `drawing-${sourceOrdinal % 11}`,
        sourceOrdinal,
        { x, y },
        { x: x + dx, y: y + dy },
        sourceOrdinal % 4,
      );
    });
    const legacy = resolveSnapIntersections(segments, candidate, { forceLegacy: true });
    const indexed = resolveSnapIntersections(segments, candidate);

    assert.equal(indexed.source, "candidate", `seed ${seed} unexpectedly fell back`);
    assert.deepEqual(indexed.intersections, legacy.intersections, `seed ${seed} changed intersections`);
  }
});

test("page integration indexes only intersections and preserves the legacy final snap comparator", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const snapStart = pageSource.indexOf("function snapResult(");
  const snapEnd = pageSource.indexOf("function snapPoint(", snapStart);
  const snapSource = pageSource.slice(snapStart, snapEnd);

  assert.match(pageSource, /NEXT_PUBLIC_SNAP_INTERSECTION_INDEX === "legacy"/);
  assert.match(snapSource, /resolveSnapIntersections\(/);
  assert.match(snapSource, /const nearest = nearestSegment\(point, ignoredId\)/);
  assert.match(snapSource, /candidates\.sort\(\(a, b\) => a\.priority - b\.priority \|\| a\.distance - b\.distance\)/);
  assert.ok(snapSource.indexOf("resolveSnapIntersections(") < snapSource.indexOf("nearestSegment(point, ignoredId)"));
});
