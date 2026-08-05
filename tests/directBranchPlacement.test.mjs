import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  buildDirectBranchGeometry,
  chooseSafeLocalBranchEndpoint,
  directBranchEndpointsFitPorts,
  directBranchStationClearance,
  projectDirectBranchStation,
  reserveDirectBranchPolylineSpan,
  resolveDirectBranchIntent,
  resolveDirectBranchTrunkCandidate,
} = await loadTypescriptModule(
  new URL("../app/directBranchPlacement.ts", import.meta.url),
);

const { fittingPortReachForVersion } = await loadTypescriptModule(
  new URL("../app/fittingInteractionGeometry.ts", import.meta.url),
);

test("press-drag-release intent freely aims the T Branch toward the release direction", () => {
  const intent = resolveDirectBranchIntent({
    center: { x: 100, y: 100 },
    mainAngle: 0,
    fallbackSide: 1,
    style: "tee90",
    intentPoint: { x: 127, y: 119 },
    minimumDistance: 10,
  });
  assert.equal(intent.followsPointer, true);
  assert.equal(intent.side, 1);
  assert.ok(Math.abs(intent.angle - Math.atan2(19, 27)) < 1e-9);
  assert.notEqual(intent.angle, Math.PI / 2);
});

test("a click without a directional drag keeps a predictable T Branch default", () => {
  const intent = resolveDirectBranchIntent({
    center: { x: 100, y: 100 },
    mainAngle: 0,
    fallbackSide: -1,
    style: "wye45",
    intentPoint: { x: 103, y: 101 },
    minimumDistance: 10,
  });
  assert.equal(intent.followsPointer, false);
  assert.equal(intent.side, -1);
  assert.ok(Math.abs(intent.angle + Math.PI / 4) < 1e-9);
});

test("direct placement projects to the exact requested station without a hidden end margin", () => {
  const projection = projectDirectBranchStation(
    { x: 3, y: 5 },
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  );
  assert.deepEqual(projection.point, { x: 3, y: 0 });
  assert.equal(projection.amount, 0.03);
  assert.equal(projection.distance, 5);

  const invalid = directBranchStationClearance({
    segmentStart: { x: 0, y: 0 },
    segmentEnd: { x: 100, y: 0 },
    center: projection.point,
    inletPort: { x: -3, y: 0 },
    outletPort: { x: 9, y: 0 },
  });
  assert.equal(invalid.valid, false);

  const valid = directBranchStationClearance({
    segmentStart: { x: 0, y: 0 },
    segmentEnd: { x: 100, y: 0 },
    center: { x: 40, y: 0 },
    inletPort: { x: 34, y: 0 },
    outletPort: { x: 46, y: 0 },
  });
  assert.equal(valid.valid, true);
});

test("smaller v3 geometry accepts a clear station that oversized v2 geometry rejected", () => {
  const center = { x: 8, y: 0 };
  const v2InletReach = fittingPortReachForVersion("12", 0, 2);
  const v2OutletReach = fittingPortReachForVersion("12", 1, 2);
  const v3InletReach = fittingPortReachForVersion("12", 0, 3);
  const v3OutletReach = fittingPortReachForVersion("12", 1, 3);
  const station = {
    segmentStart: { x: 0, y: 0 },
    segmentEnd: { x: 100, y: 0 },
    center,
  };

  assert.equal(directBranchStationClearance({
    ...station,
    inletPort: { x: center.x - v2InletReach, y: 0 },
    outletPort: { x: center.x + v2OutletReach, y: 0 },
  }).valid, false);
  assert.equal(directBranchStationClearance({
    ...station,
    inletPort: { x: center.x - v3InletReach, y: 0 },
    outletPort: { x: center.x + v3OutletReach, y: 0 },
  }).valid, true);
});

test("direct placement preserves the clicked station and creates an open Port 3", () => {
  const center = { x: 40, y: 0 };
  const mainPoints = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  const originalMainPoints = structuredClone(mainPoints);
  const inletPort = { x: 34, y: 0 };
  const outletPort = { x: 46, y: 0 };
  const branchPort = { x: 40, y: 10 };
  const result = buildDirectBranchGeometry({
    center,
    mainPoints,
    mainSegmentIndex: 0,
    inletPort,
    outletPort,
    branchPort,
    upstreamId: "main",
    downstreamId: "downstream",
  });

  assert.deepEqual(result.center, center);
  assert.deepEqual(result.upstreamPoints, [{ x: 0, y: 0 }, inletPort]);
  assert.deepEqual(result.downstreamPoints, [outletPort, { x: 100, y: 0 }]);
  assert.equal(result.branchPoints, null);
  assert.deepEqual(result.connectedIds, ["main", "downstream", ""]);
  assert.deepEqual(mainPoints, originalMainPoints);
});

test("safe local auto-connect moves only the selected branch endpoint", () => {
  const branchPort = { x: 40, y: 10 };
  for (const endpointIndex of [0, 2]) {
    const points = [
      { x: 40, y: 14 },
      { x: 72, y: 42 },
      { x: 96, y: 60 },
    ];
    const original = structuredClone(points);
    const result = buildDirectBranchGeometry({
      center: { x: 40, y: 0 },
      mainPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      mainSegmentIndex: 0,
      inletPort: { x: 34, y: 0 },
      outletPort: { x: 46, y: 0 },
      branchPort,
      upstreamId: "main",
      downstreamId: "downstream",
      branch: { id: "branch-1", endpointIndex, points },
    });
    assert.deepEqual(
      result.branchPoints,
      points.map((point, index) => index === endpointIndex ? branchPort : point),
    );
    assert.deepEqual(result.connectedIds, ["main", "downstream", "branch-1"]);
    assert.deepEqual(points, original);
  }
});

test("local matching uses endpoints and rejects unsafe contexts and final-port jumps", () => {
  const center = { x: 40, y: 0 };
  const base = {
    type: "supply",
    page: 1,
    systemId: "supply-a",
    eligible: true,
  };
  const valid = { ...base, id: "valid", points: [{ x: 40, y: 14 }, { x: 40, y: 44 }] };
  const runs = [
    { ...base, id: "main", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    valid,
    { ...base, id: "interior-crossing", points: [{ x: 0, y: 40 }, center, { x: 80, y: 40 }] },
    { ...base, id: "return", type: "return", points: [{ x: 40, y: 12 }, { x: 40, y: 40 }] },
    { ...base, id: "wrong-page", page: 2, points: [{ x: 40, y: 12 }, { x: 40, y: 40 }] },
    { ...base, id: "wrong-system", systemId: "supply-b", points: [{ x: 40, y: 12 }, { x: 40, y: 40 }] },
    { ...base, id: "assigned", points: [{ x: 39, y: 12 }, { x: 39, y: 40 }] },
    { ...base, id: "parallel", points: [{ x: 42, y: 10 }, { x: 72, y: 10 }] },
    { ...base, id: "near-center-far-port", points: [center, { x: 40, y: 30 }] },
  ];
  const result = chooseSafeLocalBranchEndpoint({
    center,
    mainRunId: "main",
    mainAngle: 0,
    page: 1,
    systemId: "supply-a",
    zoom: 1,
    assignedRunIds: new Set(["assigned"]),
    runs,
    radiusPx: 18,
    ambiguityPx: 6,
    resolveBranchPort: ({ run }) => run.id === "near-center-far-port"
      ? { x: 40, y: 20 }
      : { x: 40, y: 10 },
  });

  assert.equal(result.run.id, "valid");
  assert.equal(result.endpointIndex, 0);
  assert.equal(result.portDistance, 4);
});

test("ambiguous local endpoints leave Port 3 open", () => {
  const base = {
    type: "supply",
    page: 1,
    systemId: "supply-a",
    eligible: true,
  };
  const candidate = chooseSafeLocalBranchEndpoint({
    center: { x: 40, y: 0 },
    mainRunId: "main",
    mainAngle: 0,
    page: 1,
    systemId: "supply-a",
    zoom: 1,
    assignedRunIds: new Set(),
    runs: [
      { ...base, id: "branch-a", points: [{ x: 38, y: 12 }, { x: 38, y: 42 }] },
      { ...base, id: "branch-b", points: [{ x: 42, y: 12 }, { x: 42, y: 42 }] },
    ],
    radiusPx: 18,
    ambiguityPx: 6,
    resolveBranchPort: () => ({ x: 40, y: 10 }),
  });
  assert.equal(candidate, null);

  const geometry = buildDirectBranchGeometry({
    center: { x: 40, y: 0 },
    mainPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    mainSegmentIndex: 0,
    inletPort: { x: 34, y: 0 },
    outletPort: { x: 46, y: 0 },
    branchPort: { x: 40, y: 10 },
    upstreamId: "main",
    downstreamId: "downstream",
  });
  assert.deepEqual(geometry.connectedIds, ["main", "downstream", ""]);
});

test("three-run shortcuts require every endpoint to fit its final port", () => {
  const ports = [
    { x: 30, y: 40 },
    { x: 50, y: 40 },
    { x: 40, y: 50 },
  ];
  const safe = directBranchEndpointsFitPorts({
    endpoints: [
      { x: 29, y: 40 },
      { x: 51, y: 40 },
      { x: 40, y: 52 },
    ],
    ports,
    radius: 18,
  });
  assert.equal(safe.valid, true);
  assert.deepEqual(safe.distances, [1, 1, 2]);

  const unsafe = directBranchEndpointsFitPorts({
    endpoints: [
      { x: 29, y: 40 },
      { x: 51, y: 40 },
      { x: 40, y: 69 },
    ],
    ports,
    radius: 18,
  });
  assert.equal(unsafe.valid, false);
});

test("trunk resolver prefers the selected run, then the active system, without moving the station", () => {
  const base = {
    type: "supply",
    page: 1,
    eligible: true,
  };
  const runs = [
    { ...base, id: "other", systemId: "system-b", points: [{ x: 0, y: 1 }, { x: 100, y: 1 }] },
    { ...base, id: "active", systemId: "system-a", points: [{ x: 0, y: 2 }, { x: 100, y: 2 }] },
    { ...base, id: "selected", systemId: "system-b", points: [{ x: 0, y: 3 }, { x: 100, y: 3 }] },
  ];

  const selected = resolveDirectBranchTrunkCandidate({
    point: { x: 37, y: 0 },
    runs,
    page: 1,
    activeSystemId: "system-a",
    selectedRunId: "selected",
    zoom: 1,
    inputType: "pen",
  });
  assert.equal(selected.run.id, "selected");
  assert.deepEqual(selected.point, { x: 37, y: 3 });
  assert.equal(selected.segmentIndex, 0);

  const active = resolveDirectBranchTrunkCandidate({
    point: { x: 37, y: 0 },
    runs,
    page: 1,
    activeSystemId: "system-a",
    zoom: 1,
    inputType: "mouse",
  });
  assert.equal(active.run.id, "active");
  assert.deepEqual(active.point, { x: 37, y: 2 });
});

test("trunk resolver uses input-specific screen radii and rejects real ambiguity", () => {
  const base = {
    type: "supply",
    page: 1,
    systemId: "system-a",
    eligible: true,
  };
  const distant = { ...base, id: "touch-only", points: [{ x: 0, y: 20 }, { x: 100, y: 20 }] };
  const point = { x: 50, y: 0 };

  assert.equal(resolveDirectBranchTrunkCandidate({
    point,
    runs: [distant],
    page: 1,
    activeSystemId: "system-a",
    zoom: 1,
    inputType: "mouse",
  }), null);
  assert.equal(resolveDirectBranchTrunkCandidate({
    point,
    runs: [distant],
    page: 1,
    activeSystemId: "system-a",
    zoom: 1,
    inputType: "pen",
  }), null);
  assert.equal(resolveDirectBranchTrunkCandidate({
    point,
    runs: [distant],
    page: 1,
    activeSystemId: "system-a",
    zoom: 1,
    inputType: "touch",
  }).run.id, "touch-only");

  const crossingRuns = [
    { ...base, id: "horizontal", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    { ...base, id: "vertical", points: [{ x: 50, y: -50 }, { x: 50, y: 50 }] },
  ];
  assert.equal(resolveDirectBranchTrunkCandidate({
    point,
    runs: crossingRuns,
    page: 1,
    activeSystemId: "system-a",
    zoom: 2,
    inputType: "pen",
  }), null);

  const sameRunBend = { ...base, id: "bend", points: [{ x: 0, y: 0 }, point, { x: 50, y: 50 }] };
  assert.equal(resolveDirectBranchTrunkCandidate({
    point,
    runs: [sameRunBend],
    page: 1,
    activeSystemId: "system-a",
    zoom: 2,
    inputType: "pen",
  }).segmentIndex, 0);
});

test("trunk resolver excludes ineligible context and is deterministic across run order", () => {
  const candidate = {
    id: "valid",
    type: "supply",
    page: 1,
    systemId: "system-a",
    points: [{ x: 0, y: 3 }, { x: 100, y: 3 }],
  };
  const excluded = [
    { ...candidate, id: "hidden", visible: false, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    { ...candidate, id: "locked", locked: true, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    { ...candidate, id: "return", type: "return", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    { ...candidate, id: "other-page", page: 2, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    { ...candidate, id: "disabled", eligible: false, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
  ];
  for (const runs of [[candidate, ...excluded], [...excluded].reverse().concat(candidate)]) {
    const resolved = resolveDirectBranchTrunkCandidate({
      point: { x: 25, y: 0 },
      runs,
      page: 1,
      activeSystemId: "system-a",
      zoom: 1,
      inputType: "mouse",
    });
    assert.equal(resolved.run.id, "valid");
    assert.deepEqual(resolved.point, { x: 25, y: 3 });
  }
});

test("polyline span crosses collinear vertices while preserving the exact station", () => {
  const center = { x: 30, y: 0 };
  const result = reserveDirectBranchPolylineSpan({
    points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 }, { x: 100, y: 0 }],
    segmentIndex: 1,
    center,
    inletPort: { x: 24, y: 0 },
    outletPort: { x: 36, y: 0 },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.center, center);
  assert.deepEqual(result.upstreamPoints, [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 24, y: 0 }]);
  assert.deepEqual(result.downstreamPoints, [{ x: 36, y: 0 }, { x: 40, y: 0 }, { x: 100, y: 0 }]);
  assert.equal(result.before, 30);
  assert.equal(result.after, 70);
});

test("polyline span safely reserves across adjacent bends without relocating the center", () => {
  const center = { x: 30, y: 5 };
  const result = reserveDirectBranchPolylineSpan({
    points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 60, y: 10 }],
    segmentIndex: 1,
    center,
    inletPort: { x: 30, y: -1 },
    outletPort: { x: 30, y: 11 },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.center, center);
  assert.deepEqual(result.upstreamPoints, [{ x: 0, y: 0 }, { x: 30, y: -1 }]);
  assert.deepEqual(result.downstreamPoints, [{ x: 30, y: 11 }, { x: 60, y: 10 }]);
});

test("polyline span rejects true total-length and self-intersection failures", () => {
  const tooShort = reserveDirectBranchPolylineSpan({
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    segmentIndex: 0,
    center: { x: 3, y: 0 },
    inletPort: { x: -1, y: 0 },
    outletPort: { x: 7, y: 0 },
  });
  assert.equal(tooShort.valid, false);
  assert.equal(tooShort.reason, "insufficient-before");

  const crossing = reserveDirectBranchPolylineSpan({
    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }],
    segmentIndex: 2,
    center: { x: 5, y: 5 },
    inletPort: { x: 3, y: 7 },
    outletPort: { x: 7, y: 3 },
    minimumLeg: 0,
  });
  assert.equal(crossing.valid, false);
  assert.equal(crossing.reason, "self-intersection");
});
