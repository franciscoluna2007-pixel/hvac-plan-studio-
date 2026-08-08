import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { loadTypescriptModule } from "../tests/load-typescript-module.mjs";

const { resolveSnapIntersections } = await loadTypescriptModule(
  new URL("../app/snapIndex.ts", import.meta.url),
);
const { createFlatbushSnapPairCandidateAdapter } = await loadTypescriptModule(
  new URL("../app/snapIndexFlatbush.ts", import.meta.url),
);

const segmentCount = 1200;
const segments = Array.from({ length: segmentCount / 2 }, (_, junction) => {
  const x = (junction % 30) * 30;
  const y = Math.floor(junction / 30) * 30;
  return [
    {
      drawingId: `horizontal-${junction}`,
      segmentIndex: 0,
      sourceOrdinal: junction * 2,
      a: { x, y },
      b: { x: x + 12, y },
    },
    {
      drawingId: `vertical-${junction}`,
      segmentIndex: 0,
      sourceOrdinal: junction * 2 + 1,
      a: { x: x + 6, y: y - 6 },
      b: { x: x + 6, y: y + 6 },
    },
  ];
}).flat();

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function sample(iterations, operation) {
  return Array.from({ length: iterations }, () => {
    const startedAt = performance.now();
    operation();
    return performance.now() - startedAt;
  });
}

const legacyTimes = sample(9, () => {
  resolveSnapIntersections(segments, undefined, { forceLegacy: true });
});
const coldIndexedTimes = sample(9, () => {
  resolveSnapIntersections(segments, createFlatbushSnapPairCandidateAdapter());
});
const warmCandidate = createFlatbushSnapPairCandidateAdapter();
resolveSnapIntersections(segments, warmCandidate);
const warmIndexedTimes = sample(9, () => {
  resolveSnapIntersections(segments, warmCandidate);
});

const exhaustivePairCount = segmentCount * (segmentCount - 1) / 2;
const candidatePairCount = warmCandidate.collectPairs(segments).length;
const legacyProof = resolveSnapIntersections(segments, warmCandidate, { forceLegacy: true });
const indexedProof = resolveSnapIntersections(segments, warmCandidate);
assert.equal(indexedProof.source, "candidate");
assert.deepEqual(indexedProof.intersections, legacyProof.intersections);
const report = {
  fixture: "1200-run dense drawing with 600 isolated local junctions",
  exhaustivePairCount,
  candidatePairCount,
  exactIntersectionCount: indexedProof.intersections.length,
  pairReductionPercent: 100 * (1 - candidatePairCount / exhaustivePairCount),
  medianMilliseconds: {
    legacy: median(legacyTimes),
    flatbushCold: median(coldIndexedTimes),
    flatbushWarm: median(warmIndexedTimes),
  },
};

console.log(JSON.stringify(report, null, 2));

if (report.pairReductionPercent < 99 || report.medianMilliseconds.flatbushCold >= report.medianMilliseconds.legacy) {
  throw new Error("Flatbush did not meet the dense-plan proof threshold; keep the legacy rollback enabled.");
}
