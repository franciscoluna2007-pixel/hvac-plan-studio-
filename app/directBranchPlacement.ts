export type DirectBranchPoint = {
  x: number;
  y: number;
};

export type DirectBranchRun = {
  id: string;
  type: string;
  page: number;
  systemId: string;
  points: DirectBranchPoint[];
  eligible?: boolean;
  visible?: boolean;
  locked?: boolean;
};

export type DirectBranchProjection = {
  point: DirectBranchPoint;
  amount: number;
  length: number;
  distance: number;
  angle: number;
  side: 1 | -1;
};

export function projectDirectBranchStation(
  point: DirectBranchPoint,
  a: DirectBranchPoint,
  b: DirectBranchPoint,
): DirectBranchProjection | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return null;
  const length = Math.sqrt(lengthSquared);
  const amount = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  );
  const projected = {
    x: a.x + amount * dx,
    y: a.y + amount * dy,
  };
  const cross = dx * (point.y - projected.y) - dy * (point.x - projected.x);
  return {
    point: projected,
    amount,
    length,
    distance: Math.hypot(point.x - projected.x, point.y - projected.y),
    angle: Math.atan2(dy, dx),
    side: cross >= 0 ? 1 : -1,
  };
}

export type DirectBranchInputType = "mouse" | "pen" | "touch";

export type DirectBranchTrunkCandidate<T extends DirectBranchRun> =
  DirectBranchProjection & {
    run: T;
    segmentIndex: number;
    selected: boolean;
    activeSystem: boolean;
  };

const DIRECT_BRANCH_PICK_RADIUS_PX: Record<DirectBranchInputType, number> = {
  mouse: 14,
  pen: 14,
  touch: 24,
};

/**
 * Resolves one eligible trunk without allowing array order or a nearby crossing
 * to make the choice for the user. Adjacent segments from the same polyline are
 * collapsed to one run candidate, so clicking a real vertex is not ambiguous.
 */
export function resolveDirectBranchTrunkCandidate<T extends DirectBranchRun>({
  point,
  runs,
  page,
  activeSystemId,
  selectedRunId,
  ignoredRunId,
  zoom,
  inputType,
  radiusPx,
  ambiguityPx = 6,
}: {
  point: DirectBranchPoint;
  runs: readonly T[];
  page: number;
  activeSystemId?: string;
  selectedRunId?: string | null;
  ignoredRunId?: string | null;
  zoom: number;
  inputType: DirectBranchInputType;
  radiusPx?: Partial<Record<DirectBranchInputType, number>>;
  ambiguityPx?: number;
}): DirectBranchTrunkCandidate<T> | null {
  const resolvedZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const resolvedRadiusPx = radiusPx?.[inputType] ?? DIRECT_BRANCH_PICK_RADIUS_PX[inputType];
  const radius = Math.max(0, resolvedRadiusPx) / resolvedZoom;
  const perRun: DirectBranchTrunkCandidate<T>[] = [];

  for (const run of runs) {
    if (
      run.id === ignoredRunId ||
      run.page !== page ||
      run.type !== "supply" ||
      run.eligible === false ||
      run.visible === false ||
      run.locked === true ||
      run.points.length < 2
    ) continue;

    let bestForRun: DirectBranchTrunkCandidate<T> | null = null;
    for (let segmentIndex = 0; segmentIndex < run.points.length - 1; segmentIndex++) {
      const projection = projectDirectBranchStation(
        point,
        run.points[segmentIndex],
        run.points[segmentIndex + 1],
      );
      if (!projection || projection.distance > radius) continue;
      const candidate: DirectBranchTrunkCandidate<T> = {
        ...projection,
        run,
        segmentIndex,
        selected: run.id === selectedRunId,
        activeSystem: Boolean(activeSystemId) && run.systemId === activeSystemId,
      };
      if (
        !bestForRun ||
        candidate.distance < bestForRun.distance ||
        (candidate.distance === bestForRun.distance && candidate.segmentIndex < bestForRun.segmentIndex)
      ) bestForRun = candidate;
    }
    if (bestForRun) perRun.push(bestForRun);
  }

  const priority = (candidate: DirectBranchTrunkCandidate<T>) =>
    candidate.selected ? 0 : candidate.activeSystem ? 1 : 2;
  perRun.sort((left, right) =>
    priority(left) - priority(right) ||
    left.distance - right.distance ||
    left.run.id.localeCompare(right.run.id) ||
    left.segmentIndex - right.segmentIndex
  );

  const best = perRun[0];
  if (!best) return null;
  const bestPriority = priority(best);
  const ambiguity = Math.max(0, ambiguityPx) / resolvedZoom;
  const competingRun = perRun.find((candidate) =>
    candidate.run.id !== best.run.id &&
    priority(candidate) === bestPriority &&
    candidate.distance - best.distance < ambiguity
  );
  return competingRun ? null : best;
}

export type DirectBranchPolylineSpanFailure =
  | "invalid-polyline"
  | "center-off-polyline"
  | "insufficient-before"
  | "insufficient-after"
  | "self-intersection";

export type DirectBranchPolylineSpan = {
  valid: boolean;
  reason: DirectBranchPolylineSpanFailure | null;
  center: DirectBranchPoint;
  before: number;
  after: number;
  requiredBefore: number;
  requiredAfter: number;
  upstreamPoints: DirectBranchPoint[];
  downstreamPoints: DirectBranchPoint[];
};

function finiteDirectBranchPoint(point: DirectBranchPoint | undefined) {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

function preciseDirectBranchPoints(points: DirectBranchPoint[]) {
  return points.filter((point, index) =>
    index === 0 || Math.hypot(
      point.x - points[index - 1].x,
      point.y - points[index - 1].y,
    ) > 1e-7
  );
}

function directBranchSegmentsIntersect(
  a: DirectBranchPoint,
  b: DirectBranchPoint,
  c: DirectBranchPoint,
  d: DirectBranchPoint,
) {
  const epsilon = 1e-7;
  const cross = (p: DirectBranchPoint, q: DirectBranchPoint, r: DirectBranchPoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const within = (value: number, edgeA: number, edgeB: number) =>
    value >= Math.min(edgeA, edgeB) - epsilon && value <= Math.max(edgeA, edgeB) + epsilon;
  const onSegment = (p: DirectBranchPoint, q: DirectBranchPoint, r: DirectBranchPoint) =>
    Math.abs(cross(p, q, r)) <= epsilon &&
    within(r.x, p.x, q.x) &&
    within(r.y, p.y, q.y);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (
    ((abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon)) &&
    ((cdA > epsilon && cdB < -epsilon) || (cdA < -epsilon && cdB > epsilon))
  ) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

function directBranchSpanSelfIntersects(
  upstreamPoints: DirectBranchPoint[],
  outletPort: DirectBranchPoint,
  downstreamPoints: DirectBranchPoint[],
) {
  const fullPoints = [
    ...upstreamPoints,
    { ...outletPort },
    ...downstreamPoints.slice(1),
  ];
  const inletIndex = upstreamPoints.length - 1;
  const modifiedSegments = new Set<number>([
    inletIndex - 1,
    inletIndex,
    inletIndex + 1,
  ].filter((index) => index >= 0 && index < fullPoints.length - 1));
  for (const segmentIndex of modifiedSegments) {
    for (let otherIndex = 0; otherIndex < fullPoints.length - 1; otherIndex++) {
      if (
        otherIndex === segmentIndex ||
        Math.abs(otherIndex - segmentIndex) <= 1
      ) continue;
      if (directBranchSegmentsIntersect(
        fullPoints[segmentIndex],
        fullPoints[segmentIndex + 1],
        fullPoints[otherIndex],
        fullPoints[otherIndex + 1],
      )) return true;
    }
  }
  return false;
}

/**
 * Reserves the fitting around an exact station using distance along the whole
 * trunk, not only the clicked segment. Vertices inside the fitting reach are
 * removed, which safely straightens a small local bend while keeping the center
 * fixed. The returned runs never mutate the source polyline.
 */
export function reserveDirectBranchPolylineSpan({
  points,
  segmentIndex,
  center,
  inletPort,
  outletPort,
  minimumLeg = 0.5,
  centerTolerance = 0.05,
}: {
  points: readonly DirectBranchPoint[];
  segmentIndex: number;
  center: DirectBranchPoint;
  inletPort: DirectBranchPoint;
  outletPort: DirectBranchPoint;
  minimumLeg?: number;
  centerTolerance?: number;
}): DirectBranchPolylineSpan {
  const failure = (
    reason: DirectBranchPolylineSpanFailure,
    before = 0,
    after = 0,
    requiredBefore = 0,
    requiredAfter = 0,
  ): DirectBranchPolylineSpan => ({
    valid: false,
    reason,
    center: { ...center },
    before,
    after,
    requiredBefore,
    requiredAfter,
    upstreamPoints: [],
    downstreamPoints: [],
  });
  if (
    points.length < 2 ||
    segmentIndex < 0 ||
    segmentIndex >= points.length - 1 ||
    !points.every(finiteDirectBranchPoint) ||
    !finiteDirectBranchPoint(center) ||
    !finiteDirectBranchPoint(inletPort) ||
    !finiteDirectBranchPoint(outletPort)
  ) return failure("invalid-polyline");

  const segmentLengths: number[] = [];
  const cumulative = [0];
  for (let index = 0; index < points.length - 1; index++) {
    const length = Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].y - points[index].y,
    );
    segmentLengths.push(length);
    cumulative.push(cumulative[index] + length);
  }
  const projection = projectDirectBranchStation(
    center,
    points[segmentIndex],
    points[segmentIndex + 1],
  );
  if (!projection || projection.distance > Math.max(0, centerTolerance)) {
    return failure("center-off-polyline");
  }

  const centerDistance = cumulative[segmentIndex] + projection.amount * segmentLengths[segmentIndex];
  const before = centerDistance;
  const after = cumulative[cumulative.length - 1] - centerDistance;
  const inletReach = Math.hypot(center.x - inletPort.x, center.y - inletPort.y);
  const outletReach = Math.hypot(center.x - outletPort.x, center.y - outletPort.y);
  const resolvedMinimumLeg = Math.max(0, minimumLeg);
  const requiredBefore = inletReach + resolvedMinimumLeg;
  const requiredAfter = outletReach + resolvedMinimumLeg;
  if (before < requiredBefore) {
    return failure("insufficient-before", before, after, requiredBefore, requiredAfter);
  }
  if (after < requiredAfter) {
    return failure("insufficient-after", before, after, requiredBefore, requiredAfter);
  }

  const inletCutDistance = centerDistance - inletReach;
  const outletCutDistance = centerDistance + outletReach;
  const epsilon = 1e-7;
  const upstreamPoints = preciseDirectBranchPoints([
    ...points
      .filter((_point, index) => cumulative[index] < inletCutDistance - epsilon)
      .map((point) => ({ ...point })),
    { ...inletPort },
  ]);
  const downstreamPoints = preciseDirectBranchPoints([
    { ...outletPort },
    ...points
      .filter((_point, index) => cumulative[index] > outletCutDistance + epsilon)
      .map((point) => ({ ...point })),
  ]);
  if (upstreamPoints.length < 2 || downstreamPoints.length < 2) {
    return failure(
      upstreamPoints.length < 2 ? "insufficient-before" : "insufficient-after",
      before,
      after,
      requiredBefore,
      requiredAfter,
    );
  }
  if (directBranchSpanSelfIntersects(upstreamPoints, outletPort, downstreamPoints)) {
    return failure("self-intersection", before, after, requiredBefore, requiredAfter);
  }

  return {
    valid: true,
    reason: null,
    center: { ...center },
    before,
    after,
    requiredBefore,
    requiredAfter,
    upstreamPoints,
    downstreamPoints,
  };
}

export function directBranchStationClearance({
  segmentStart,
  segmentEnd,
  center,
  inletPort,
  outletPort,
  minimumLeg = 0.5,
}: {
  segmentStart: DirectBranchPoint;
  segmentEnd: DirectBranchPoint;
  center: DirectBranchPoint;
  inletPort: DirectBranchPoint;
  outletPort: DirectBranchPoint;
  minimumLeg?: number;
}) {
  const before = Math.hypot(center.x - segmentStart.x, center.y - segmentStart.y);
  const after = Math.hypot(segmentEnd.x - center.x, segmentEnd.y - center.y);
  const requiredBefore = Math.hypot(center.x - inletPort.x, center.y - inletPort.y) + minimumLeg;
  const requiredAfter = Math.hypot(center.x - outletPort.x, center.y - outletPort.y) + minimumLeg;
  return {
    valid: before >= requiredBefore && after >= requiredAfter,
    before,
    after,
    requiredBefore,
    requiredAfter,
  };
}

export function directBranchEndpointsFitPorts({
  endpoints,
  ports,
  radius,
}: {
  endpoints: [DirectBranchPoint, DirectBranchPoint, DirectBranchPoint];
  ports: [DirectBranchPoint, DirectBranchPoint, DirectBranchPoint];
  radius: number;
}) {
  const distances = endpoints.map((endpoint, index) => Math.hypot(
    endpoint.x - ports[index].x,
    endpoint.y - ports[index].y,
  )) as [number, number, number];
  return {
    valid: distances.every((distance) => distance <= radius),
    distances,
    score: distances.reduce((total, distance) => total + distance, 0),
  };
}

export type SafeLocalBranchEndpoint<T extends DirectBranchRun> = {
  run: T;
  endpointIndex: number;
  angle: number;
  side: 1 | -1;
  portDistance: number;
};

export function chooseSafeLocalBranchEndpoint<T extends DirectBranchRun>({
  center,
  mainRunId,
  mainAngle,
  page,
  systemId,
  zoom,
  assignedRunIds,
  runs,
  radiusPx,
  ambiguityPx,
  resolveBranchPort,
}: {
  center: DirectBranchPoint;
  mainRunId: string;
  mainAngle: number;
  page: number;
  systemId: string;
  zoom: number;
  assignedRunIds: ReadonlySet<string>;
  runs: readonly T[];
  radiusPx: number;
  ambiguityPx: number;
  resolveBranchPort: (candidate: {
    run: T;
    endpointIndex: number;
    angle: number;
    side: 1 | -1;
  }) => DirectBranchPoint;
}): SafeLocalBranchEndpoint<T> | null {
  const candidates: Array<SafeLocalBranchEndpoint<T> & { score: number }> = [];
  for (const run of runs) {
    if (
      run.id === mainRunId ||
      run.eligible === false ||
      assignedRunIds.has(run.id) ||
      run.page !== page ||
      run.type !== "supply" ||
      run.systemId !== systemId ||
      run.points.length < 2
    ) continue;
    const lastIndex = run.points.length - 1;
    for (const endpointIndex of [0, lastIndex]) {
      const endpoint = run.points[endpointIndex];
      const neighbor = endpointIndex === 0 ? run.points[1] : run.points[lastIndex - 1];
      const angle = Math.atan2(neighbor.y - endpoint.y, neighbor.x - endpoint.x);
      const divergence = Math.abs(Math.sin(angle - mainAngle));
      if (divergence < 0.22) continue;
      const cross = Math.cos(mainAngle) * Math.sin(angle) - Math.sin(mainAngle) * Math.cos(angle);
      const side: 1 | -1 = cross >= 0 ? 1 : -1;
      const branchPort = resolveBranchPort({ run, endpointIndex, angle, side });
      const portDistance = Math.hypot(
        endpoint.x - branchPort.x,
        endpoint.y - branchPort.y,
      );
      if (portDistance > radiusPx / zoom) continue;
      candidates.push({
        run,
        endpointIndex,
        angle,
        side,
        portDistance,
        score: portDistance - divergence * 8,
      });
    }
  }
  candidates.sort((left, right) => left.score - right.score);
  const best = candidates[0];
  if (!best) return null;
  const competingRun = candidates.find((candidate) => candidate.run.id !== best.run.id);
  if (competingRun && competingRun.score - best.score < ambiguityPx / zoom) return null;
  const { score: _score, ...match } = best;
  return match;
}

function cleanDirectBranchPoints(points: DirectBranchPoint[]) {
  return points.filter((point, index) =>
    index === 0 || Math.hypot(
      point.x - points[index - 1].x,
      point.y - points[index - 1].y,
    ) > 0.5
  );
}

export function buildDirectBranchGeometry({
  center,
  mainPoints,
  mainSegmentIndex,
  inletPort,
  outletPort,
  branchPort,
  upstreamId,
  downstreamId,
  branch,
}: {
  center: DirectBranchPoint;
  mainPoints: DirectBranchPoint[];
  mainSegmentIndex: number;
  inletPort: DirectBranchPoint;
  outletPort: DirectBranchPoint;
  branchPort: DirectBranchPoint;
  upstreamId: string;
  downstreamId: string;
  branch?: {
    id: string;
    endpointIndex: number;
    points: DirectBranchPoint[];
  };
}) {
  return {
    center: { ...center },
    upstreamPoints: cleanDirectBranchPoints([
      ...mainPoints.slice(0, mainSegmentIndex + 1),
      inletPort,
    ]),
    downstreamPoints: cleanDirectBranchPoints([
      outletPort,
      ...mainPoints.slice(mainSegmentIndex + 1),
    ]),
    branchPoints: branch
      ? branch.points.map((point, index) => index === branch.endpointIndex ? branchPort : point)
      : null,
    connectedIds: [upstreamId, downstreamId, branch?.id || ""] as [string, string, string],
  };
}
