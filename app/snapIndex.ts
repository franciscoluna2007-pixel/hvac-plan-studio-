export type SnapIndexPoint = Readonly<{
  x: number;
  y: number;
}>;

export type SnapIndexSegment = Readonly<{
  drawingId: string;
  segmentIndex: number;
  sourceOrdinal: number;
  a: SnapIndexPoint;
  b: SnapIndexPoint;
}>;

export type SnapIndexPair = readonly [firstSourceOrdinal: number, secondSourceOrdinal: number];

export type SnapIntersection = Readonly<{
  point: SnapIndexPoint;
  firstSourceOrdinal: number;
  secondSourceOrdinal: number;
}>;

export type SnapPairCandidateAdapter = Readonly<{
  id: string;
  collectPairs: (segments: readonly SnapIndexSegment[]) => readonly SnapIndexPair[];
}>;

export type SnapShadowDiagnostic = Readonly<{
  candidateId: string;
  status: "match" | "mismatch" | "candidate-error";
  referenceIntersectionCount: number;
  candidateIntersectionCount: number | null;
  candidatePairCount: number | null;
  firstMismatch: Readonly<{
    index: number;
    expected: string | null;
    observed: string | null;
  }> | null;
  error: string | null;
}>;

export type SnapIntersectionEvaluation = Readonly<{
  /** The exhaustive reference is always the only result a product caller may use. */
  authoritative: readonly SnapIntersection[];
  /** Candidate output is diagnostic-only and can never replace authoritative output. */
  shadow: SnapShadowDiagnostic | null;
}>;

export type SnapIntersectionResolution = Readonly<{
  intersections: readonly SnapIntersection[];
  source: "candidate" | "legacy-switch" | "legacy-fallback";
  candidateId: string | null;
  error: string | null;
}>;

export type SnapSegmentIntersection = (
  a: SnapIndexPoint,
  b: SnapIndexPoint,
  c: SnapIndexPoint,
  d: SnapIndexPoint,
) => SnapIndexPoint | null;

export function snapSegmentIntersection(
  a: SnapIndexPoint,
  b: SnapIndexPoint,
  c: SnapIndexPoint,
  d: SnapIndexPoint,
) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < .001) return null;
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
  const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
    ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
    : null;
}

function exhaustiveIntersections(
  segments: readonly SnapIndexSegment[],
  intersect: SnapSegmentIntersection,
) {
  const intersections: SnapIntersection[] = [];
  for (let first = 0; first < segments.length; first++) {
    for (let second = first + 1; second < segments.length; second++) {
      if (segments[first].drawingId === segments[second].drawingId) continue;
      const point = intersect(
        segments[first].a,
        segments[first].b,
        segments[second].a,
        segments[second].b,
      );
      if (point) intersections.push({
        point,
        firstSourceOrdinal: segments[first].sourceOrdinal,
        secondSourceOrdinal: segments[second].sourceOrdinal,
      });
    }
  }
  return intersections;
}

function frozenCandidatePayload(segments: readonly SnapIndexSegment[]) {
  return Object.freeze(segments.map((segment) => Object.freeze({
    ...segment,
    a: Object.freeze({ ...segment.a }),
    b: Object.freeze({ ...segment.b }),
  })));
}

function canonicalCandidatePairs(
  pairs: readonly SnapIndexPair[],
  segmentsByOrdinal: ReadonlyMap<number, SnapIndexSegment>,
  segmentOrderByOrdinal: ReadonlyMap<number, number>,
) {
  const unique = new Map<string, SnapIndexPair>();
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error("Candidate returned a malformed segment pair.");
    const first = Number(pair[0]);
    const second = Number(pair[1]);
    if (!Number.isInteger(first) || !Number.isInteger(second) || first === second) {
      throw new Error("Candidate returned an invalid segment ordinal pair.");
    }
    const firstOrder = segmentOrderByOrdinal.get(first);
    const secondOrder = segmentOrderByOrdinal.get(second);
    if (firstOrder === undefined || secondOrder === undefined) {
      throw new Error("Candidate returned an unknown segment ordinal.");
    }
    const earlier = firstOrder < secondOrder ? first : second;
    const later = firstOrder < secondOrder ? second : first;
    const earlierSegment = segmentsByOrdinal.get(earlier);
    const laterSegment = segmentsByOrdinal.get(later);
    if (!earlierSegment || !laterSegment) throw new Error("Candidate returned an unknown segment ordinal.");
    if (earlierSegment.drawingId === laterSegment.drawingId) continue;
    unique.set(`${Math.min(firstOrder, secondOrder)}:${Math.max(firstOrder, secondOrder)}`, [earlier, later]);
  }
  return [...unique.values()].sort((left, right) => {
    const leftFirst = segmentOrderByOrdinal.get(left[0]) ?? Number.MAX_SAFE_INTEGER;
    const rightFirst = segmentOrderByOrdinal.get(right[0]) ?? Number.MAX_SAFE_INTEGER;
    const leftSecond = segmentOrderByOrdinal.get(left[1]) ?? Number.MAX_SAFE_INTEGER;
    const rightSecond = segmentOrderByOrdinal.get(right[1]) ?? Number.MAX_SAFE_INTEGER;
    return leftFirst - rightFirst || leftSecond - rightSecond;
  });
}

function intersectionsForPairs(
  pairs: readonly SnapIndexPair[],
  segmentsByOrdinal: ReadonlyMap<number, SnapIndexSegment>,
  intersect: SnapSegmentIntersection,
) {
  const intersections: SnapIntersection[] = [];
  for (const [firstSourceOrdinal, secondSourceOrdinal] of pairs) {
    const first = segmentsByOrdinal.get(firstSourceOrdinal);
    const second = segmentsByOrdinal.get(secondSourceOrdinal);
    if (!first || !second) throw new Error("Intersection pair referenced an unknown segment ordinal.");
    const point = intersect(first.a, first.b, second.a, second.b);
    if (point) intersections.push({ point, firstSourceOrdinal, secondSourceOrdinal });
  }
  return intersections;
}

function intersectionSignature(intersection: SnapIntersection | undefined) {
  if (!intersection) return null;
  return `${intersection.firstSourceOrdinal}:${intersection.secondSourceOrdinal}:${intersection.point.x}:${intersection.point.y}`;
}

function firstIntersectionMismatch(
  reference: readonly SnapIntersection[],
  candidate: readonly SnapIntersection[],
) {
  const count = Math.max(reference.length, candidate.length);
  for (let index = 0; index < count; index++) {
    const expected = intersectionSignature(reference[index]);
    const observed = intersectionSignature(candidate[index]);
    if (expected !== observed) return { index, expected, observed };
  }
  return null;
}

function indexSnapSegments(segments: readonly SnapIndexSegment[]) {
  const segmentsByOrdinal = new Map<number, SnapIndexSegment>();
  const segmentOrderByOrdinal = new Map<number, number>();
  segments.forEach((segment, order) => {
    if (!Number.isInteger(segment.sourceOrdinal) || segmentsByOrdinal.has(segment.sourceOrdinal)) {
      throw new Error("Snap segments require unique integer source ordinals.");
    }
    segmentsByOrdinal.set(segment.sourceOrdinal, segment);
    segmentOrderByOrdinal.set(segment.sourceOrdinal, order);
  });
  return { segmentsByOrdinal, segmentOrderByOrdinal };
}

function candidateIntersections(
  segments: readonly SnapIndexSegment[],
  candidate: SnapPairCandidateAdapter,
  intersect: SnapSegmentIntersection,
  segmentsByOrdinal: ReadonlyMap<number, SnapIndexSegment>,
  segmentOrderByOrdinal: ReadonlyMap<number, number>,
) {
  const pairs = canonicalCandidatePairs(
    candidate.collectPairs(frozenCandidatePayload(segments)),
    segmentsByOrdinal,
    segmentOrderByOrdinal,
  );
  return {
    intersections: intersectionsForPairs(pairs, segmentsByOrdinal, intersect),
    pairCount: pairs.length,
  };
}

/**
 * Uses a proven candidate broad phase for run-to-run intersections only. The
 * legacy narrow-phase geometry and ordering still produce every returned snap.
 * A rollback switch or any candidate failure synchronously uses the exhaustive
 * legacy traversal.
 */
export function resolveSnapIntersections(
  segments: readonly SnapIndexSegment[],
  candidate: SnapPairCandidateAdapter | undefined,
  options: Readonly<{
    forceLegacy?: boolean;
    intersect?: SnapSegmentIntersection;
  }> = {},
): SnapIntersectionResolution {
  const intersect = options.intersect ?? snapSegmentIntersection;
  const { segmentsByOrdinal, segmentOrderByOrdinal } = indexSnapSegments(segments);
  if (options.forceLegacy || !candidate) {
    return {
      intersections: exhaustiveIntersections(segments, intersect),
      source: "legacy-switch",
      candidateId: candidate?.id ?? null,
      error: null,
    };
  }

  try {
    return {
      intersections: candidateIntersections(
        segments,
        candidate,
        intersect,
        segmentsByOrdinal,
        segmentOrderByOrdinal,
      ).intersections,
      source: "candidate",
      candidateId: candidate.id,
      error: null,
    };
  } catch (error) {
    return {
      intersections: exhaustiveIntersections(segments, intersect),
      source: "legacy-fallback",
      candidateId: candidate.id,
      error: error instanceof Error ? error.message : "Candidate adapter failed.",
    };
  }
}

/**
 * Runs the current exhaustive segment-intersection behavior first and always
 * returns it as authoritative. A future spatial index may only propose pairs
 * against a frozen copy and receives no path to product state or returned snap
 * behavior.
 */
export function evaluateSnapIntersectionShadow(
  segments: readonly SnapIndexSegment[],
  candidate?: SnapPairCandidateAdapter,
  intersect: SnapSegmentIntersection = snapSegmentIntersection,
): SnapIntersectionEvaluation {
  const { segmentsByOrdinal, segmentOrderByOrdinal } = indexSnapSegments(segments);

  const authoritative = exhaustiveIntersections(segments, intersect);
  if (!candidate) return { authoritative, shadow: null };

  try {
    const candidateResult = candidateIntersections(
      segments,
      candidate,
      intersect,
      segmentsByOrdinal,
      segmentOrderByOrdinal,
    );
    const firstMismatch = firstIntersectionMismatch(authoritative, candidateResult.intersections);
    return {
      authoritative,
      shadow: {
        candidateId: candidate.id,
        status: firstMismatch ? "mismatch" : "match",
        referenceIntersectionCount: authoritative.length,
        candidateIntersectionCount: candidateResult.intersections.length,
        candidatePairCount: candidateResult.pairCount,
        firstMismatch,
        error: null,
      },
    };
  } catch (error) {
    return {
      authoritative,
      shadow: {
        candidateId: candidate.id,
        status: "candidate-error",
        referenceIntersectionCount: authoritative.length,
        candidateIntersectionCount: null,
        candidatePairCount: null,
        firstMismatch: null,
        error: error instanceof Error ? error.message : "Candidate adapter failed.",
      },
    };
  }
}
