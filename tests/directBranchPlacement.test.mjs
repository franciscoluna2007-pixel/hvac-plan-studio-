import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  buildDirectBranchGeometry,
  chooseSafeLocalBranchEndpoint,
  directBranchEndpointsFitPorts,
  directBranchStationClearance,
  projectDirectBranchStation,
} = await loadTypescriptModule(
  new URL("../app/directBranchPlacement.ts", import.meta.url),
);

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
