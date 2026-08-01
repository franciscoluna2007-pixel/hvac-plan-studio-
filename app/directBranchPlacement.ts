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
