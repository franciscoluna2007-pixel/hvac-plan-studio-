import Flatbush from "flatbush";

import type {
  SnapIndexPair,
  SnapIndexSegment,
  SnapPairCandidateAdapter,
} from "./snapIndex";

export type FlatbushSnapCandidateDiagnostics = Readonly<{
  revision: number;
  indexBuildCount: number;
  indexedSegmentCount: number;
  hasPackedIndex: boolean;
}>;

export type FlatbushSnapPairCandidateAdapter = SnapPairCandidateAdapter & Readonly<{
  diagnostics: () => FlatbushSnapCandidateDiagnostics;
}>;

type SegmentBounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

type CachedFlatbushRevision = Readonly<{
  geometryRevision: string;
  index: Flatbush | null;
  pairs: readonly SnapIndexPair[];
}>;

function finiteBounds(segment: SnapIndexSegment): SegmentBounds {
  const coordinates = [segment.a.x, segment.a.y, segment.b.x, segment.b.y];
  if (!coordinates.every(Number.isFinite)) {
    throw new Error("Flatbush snap candidates require finite segment coordinates.");
  }
  return {
    minX: Math.min(segment.a.x, segment.b.x),
    minY: Math.min(segment.a.y, segment.b.y),
    maxX: Math.max(segment.a.x, segment.b.x),
    maxY: Math.max(segment.a.y, segment.b.y),
  };
}

function exactGeometryRevision(segments: readonly SnapIndexSegment[]) {
  return JSON.stringify(segments.map((segment) => [
    segment.sourceOrdinal,
    segment.drawingId,
    segment.segmentIndex,
    segment.a.x,
    segment.a.y,
    segment.b.x,
    segment.b.y,
  ]));
}

/**
 * Creates a static Flatbush broad-phase adapter. The exact input revision owns
 * both the packed index and its candidate-pair result; any order, ownership,
 * identity, or coordinate change rebuilds them together.
 */
export function createFlatbushSnapPairCandidateAdapter(): FlatbushSnapPairCandidateAdapter {
  let cache: CachedFlatbushRevision | null = null;
  let revision = 0;
  let indexBuildCount = 0;
  let indexedSegmentCount = 0;

  const collectPairs = (segments: readonly SnapIndexSegment[]) => {
    const bounds = segments.map(finiteBounds);
    const geometryRevision = exactGeometryRevision(segments);
    if (geometryRevision === cache?.geometryRevision) return cache.pairs;

    const pairs: SnapIndexPair[] = [];
    let index: Flatbush | null = null;
    if (segments.length > 0) {
      const nextIndex = new Flatbush(segments.length);
      bounds.forEach(({ minX, minY, maxX, maxY }) => nextIndex.add(minX, minY, maxX, maxY));
      nextIndex.finish();
      indexBuildCount += 1;

      bounds.forEach(({ minX, minY, maxX, maxY }, firstIndex) => {
        for (const secondIndex of nextIndex.search(minX, minY, maxX, maxY)) {
          if (secondIndex <= firstIndex) continue;
          if (segments[firstIndex].drawingId === segments[secondIndex].drawingId) continue;
          pairs.push([
            segments[firstIndex].sourceOrdinal,
            segments[secondIndex].sourceOrdinal,
          ]);
        }
      });
      index = nextIndex;
    }

    cache = Object.freeze({
      geometryRevision,
      index,
      pairs: Object.freeze(pairs.map((pair) => Object.freeze(pair))),
    });
    revision += 1;
    indexedSegmentCount = segments.length;
    return cache.pairs;
  };

  return Object.freeze({
    id: "flatbush-4.6.2",
    collectPairs,
    diagnostics: () => Object.freeze({
      revision,
      indexBuildCount,
      indexedSegmentCount,
      hasPackedIndex: cache?.index !== null && cache?.index !== undefined,
    }),
  });
}
