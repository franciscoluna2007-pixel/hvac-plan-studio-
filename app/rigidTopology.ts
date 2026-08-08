import {
  normalizeRigidStraightMeta,
  type RigidConstruction,
  type RigidNetworkKind,
  type RigidPoint,
  type RigidSize,
  type RigidStraightMetaV1,
} from "./rigidDuct";

export type RigidStraightPortId = "start" | "end";
export type RigidElbowPortId = "inlet" | "outlet";
export type RigidPortId = RigidStraightPortId | RigidElbowPortId;

export type RigidConnectionRef = {
  drawingId: string;
  portId: RigidPortId;
};

export type RigidStraightPortState = {
  id: RigidStraightPortId;
  connectedTo?: RigidConnectionRef;
  /** Explicit fitting takeout at this end. Zero is valid for an open end. */
  takeoutInches: number | null;
};

export type RigidStraightTopologyV1 = {
  version: 1;
  ports: {
    start: RigidStraightPortState;
    end: RigidStraightPortState;
  };
};

export type RigidElbowPortState = {
  id: RigidElbowPortId;
  connectedTo?: RigidConnectionRef;
  /** User-entered takeout. Null blocks finished-length ordering. */
  takeoutInches: number | null;
};

export type RigidElbowMetaV1 = {
  version: 1;
  kind: "elbow";
  networkKind: RigidNetworkKind;
  construction: RigidConstruction;
  size: RigidSize;
  angleDegrees: 45 | 90;
  turn: "left" | "right";
  rectangularStyle?: "radius" | "square";
  inboundAngleDegrees: number;
  ports: {
    inlet: RigidElbowPortState;
    outlet: RigidElbowPortState;
  };
};

export type RigidFinishedLength = {
  centerlineFeet: number;
  finishedFeet: number | null;
  takeoutFeet: number | null;
  status: "ready" | "takeout-required";
};

export type RigidContinuation = {
  elbow: RigidElbowMetaV1;
  straight: RigidStraightMetaV1;
  topology: RigidStraightTopologyV1;
};

export type RigidExistingConnectionFailure =
  | "invalid-elbow"
  | "invalid-straight"
  | "outlet-connected"
  | "outlet-takeout-required"
  | "straight-port-connected"
  | "incompatible-rigid"
  | "invalid-geometry"
  | "endpoint-too-far"
  | "axis-misaligned"
  | "connected-far-end-would-move"
  | "straight-too-short";

export type RigidExistingConnectionPlan = {
  ok: true;
  elbow: RigidElbowMetaV1;
  topology: RigidStraightTopologyV1;
  points: [RigidPoint, RigidPoint];
  straightPortId: RigidStraightPortId;
  endpointMoveUnits: number;
  farEndpointCorrectionUnits: number;
  outletDistanceUnits: number;
};

export type RigidExistingConnectionRejection = {
  ok: false;
  reason: RigidExistingConnectionFailure;
};

const MAX_TAKEOUT_INCHES = 120;

function finiteTakeout(value: unknown) {
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > MAX_TAKEOUT_INCHES) return undefined;
  return Math.round(number * 4) / 4;
}

function connectionRef(value: unknown): RigidConnectionRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  const ref = value as Partial<RigidConnectionRef>;
  if (typeof ref.drawingId !== "string" || !ref.drawingId.trim()) return undefined;
  if (!["start", "end", "inlet", "outlet"].includes(String(ref.portId))) return undefined;
  return { drawingId: ref.drawingId, portId: ref.portId as RigidPortId };
}

export function emptyRigidStraightTopology(): RigidStraightTopologyV1 {
  return {
    version: 1,
    ports: {
      start: { id: "start", takeoutInches: 0 },
      end: { id: "end", takeoutInches: 0 },
    },
  };
}

export function rigidStraightHasConnection(topology: RigidStraightTopologyV1) {
  return Boolean(topology.ports.start.connectedTo || topology.ports.end.connectedTo);
}

export function normalizeRigidStraightTopology(input: unknown): RigidStraightTopologyV1 {
  const fallback = emptyRigidStraightTopology();
  if (!input || typeof input !== "object") return fallback;
  const candidate = input as Partial<RigidStraightTopologyV1>;
  if (candidate.version !== 1 || !candidate.ports || typeof candidate.ports !== "object") return fallback;
  const normalizePort = (id: RigidStraightPortId): RigidStraightPortState => {
    const raw = candidate.ports?.[id] as Partial<RigidStraightPortState> | undefined;
    const takeout = finiteTakeout(raw?.takeoutInches);
    return {
      id,
      takeoutInches: takeout === undefined ? 0 : takeout,
      ...(connectionRef(raw?.connectedTo) ? { connectedTo: connectionRef(raw?.connectedTo) } : {}),
    };
  };
  return { version: 1, ports: { start: normalizePort("start"), end: normalizePort("end") } };
}

export function normalizeRigidElbowMeta(input: unknown): RigidElbowMetaV1 | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<RigidElbowMetaV1>;
  const straightShape = normalizeRigidStraightMeta({
    version: 1,
    kind: "straight",
    networkKind: candidate.networkKind,
    construction: candidate.construction,
    size: candidate.size,
  });
  if (
    candidate.version !== 1 ||
    candidate.kind !== "elbow" ||
    !straightShape ||
    ![45, 90].includes(Number(candidate.angleDegrees)) ||
    !["left", "right"].includes(String(candidate.turn)) ||
    !Number.isFinite(Number(candidate.inboundAngleDegrees)) ||
    !candidate.ports ||
    typeof candidate.ports !== "object"
  ) return null;
  if (
    straightShape.construction === "rectangular" &&
    !["radius", "square"].includes(String(candidate.rectangularStyle))
  ) return null;
  const normalizePort = (id: RigidElbowPortId): RigidElbowPortState | null => {
    const raw = candidate.ports?.[id] as Partial<RigidElbowPortState> | undefined;
    const takeout = finiteTakeout(raw?.takeoutInches);
    if (takeout === undefined) return null;
    return {
      id,
      takeoutInches: takeout,
      ...(connectionRef(raw?.connectedTo) ? { connectedTo: connectionRef(raw?.connectedTo) } : {}),
    };
  };
  const inlet = normalizePort("inlet");
  const outlet = normalizePort("outlet");
  if (!inlet || !outlet) return null;
  return {
    version: 1,
    kind: "elbow",
    networkKind: straightShape.networkKind,
    construction: straightShape.construction,
    size: straightShape.size,
    angleDegrees: Number(candidate.angleDegrees) as 45 | 90,
    turn: candidate.turn as "left" | "right",
    ...(straightShape.construction === "rectangular"
      ? { rectangularStyle: candidate.rectangularStyle as "radius" | "square" }
      : {}),
    inboundAngleDegrees: ((Number(candidate.inboundAngleDegrees) % 360) + 360) % 360,
    ports: { inlet, outlet },
  };
}

export function rigidFinishedStraightLength(
  centerlineFeet: number | null,
  topology: RigidStraightTopologyV1,
): RigidFinishedLength | null {
  if (centerlineFeet == null || !Number.isFinite(centerlineFeet) || centerlineFeet < 0) return null;
  const takeouts = [topology.ports.start.takeoutInches, topology.ports.end.takeoutInches];
  if (takeouts.some((value) => value == null)) {
    return { centerlineFeet, finishedFeet: null, takeoutFeet: null, status: "takeout-required" };
  }
  const takeoutFeet = (takeouts[0]! + takeouts[1]!) / 12;
  return {
    centerlineFeet,
    finishedFeet: Math.max(0, centerlineFeet - takeoutFeet),
    takeoutFeet,
    status: "ready",
  };
}

function direction(angleDegrees: number) {
  const radians = angleDegrees * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

export function rigidElbowGeometry(
  vertex: RigidPoint,
  elbow: RigidElbowMetaV1,
  feetPerUnit: number,
) {
  if (!Number.isFinite(feetPerUnit) || feetPerUnit <= 0) return null;
  const inletTakeout = elbow.ports.inlet.takeoutInches;
  const outletTakeout = elbow.ports.outlet.takeoutInches;
  if (inletTakeout == null || outletTakeout == null) return null;
  const inbound = direction(elbow.inboundAngleDegrees);
  const sign = elbow.turn === "left" ? -1 : 1;
  const outbound = direction(elbow.inboundAngleDegrees + sign * elbow.angleDegrees);
  const inletUnits = inletTakeout / 12 / feetPerUnit;
  const outletUnits = outletTakeout / 12 / feetPerUnit;
  return {
    vertex,
    inlet: { x: vertex.x - inbound.x * inletUnits, y: vertex.y - inbound.y * inletUnits },
    outlet: { x: vertex.x + outbound.x * outletUnits, y: vertex.y + outbound.y * outletUnits },
    inbound,
    outbound,
  };
}

export function inboundAngleForStraight(points: readonly RigidPoint[], portId: RigidStraightPortId) {
  if (points.length !== 2) return null;
  const from = portId === "end" ? points[0] : points[1];
  const to = portId === "end" ? points[1] : points[0];
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return null;
  if (from.x === to.x && from.y === to.y) return null;
  return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
}

export function createRigidElbow(input: {
  straightId: string;
  straight: RigidStraightMetaV1;
  straightPortId: RigidStraightPortId;
  angleDegrees: 45 | 90;
  turn: "left" | "right";
  rectangularStyle?: "radius" | "square";
  inboundAngleDegrees: number;
  inletTakeoutInches: number;
  outletTakeoutInches: number;
  fittingId: string;
}): RigidElbowMetaV1 | null {
  const candidate: RigidElbowMetaV1 = {
    version: 1,
    kind: "elbow",
    networkKind: input.straight.networkKind,
    construction: input.straight.construction,
    size: input.straight.size,
    angleDegrees: input.angleDegrees,
    turn: input.turn,
    ...(input.straight.construction === "rectangular"
      ? { rectangularStyle: input.rectangularStyle || "radius" }
      : {}),
    inboundAngleDegrees: input.inboundAngleDegrees,
    ports: {
      inlet: {
        id: "inlet",
        takeoutInches: input.inletTakeoutInches,
        connectedTo: { drawingId: input.straightId, portId: input.straightPortId },
      },
      outlet: { id: "outlet", takeoutInches: input.outletTakeoutInches },
    },
  };
  return normalizeRigidElbowMeta(candidate);
}

export function createRigidContinuation(input: {
  elbowId: string;
  elbow: RigidElbowMetaV1;
  straightId: string;
}): RigidContinuation | null {
  const elbow = normalizeRigidElbowMeta(input.elbow);
  if (
    !elbow ||
    elbow.ports.outlet.connectedTo ||
    elbow.ports.outlet.takeoutInches == null ||
    !input.elbowId.trim() ||
    !input.straightId.trim()
  ) return null;
  const straight = normalizeRigidStraightMeta({
    version: 1,
    kind: "straight",
    networkKind: elbow.networkKind,
    construction: elbow.construction,
    size: elbow.size,
  });
  if (!straight) return null;
  return {
    elbow: {
      ...elbow,
      ports: {
        ...elbow.ports,
        outlet: {
          ...elbow.ports.outlet,
          connectedTo: { drawingId: input.straightId, portId: "start" },
        },
      },
    },
    straight,
    topology: {
      version: 1,
      ports: {
        start: {
          id: "start",
          takeoutInches: elbow.ports.outlet.takeoutInches,
          connectedTo: { drawingId: input.elbowId, portId: "outlet" },
        },
        end: { id: "end", takeoutInches: 0 },
      },
    },
  };
}

function rigidIdentityMatches(
  elbow: RigidElbowMetaV1,
  straight: RigidStraightMetaV1,
) {
  if (
    elbow.networkKind !== straight.networkKind ||
    elbow.construction !== straight.construction ||
    elbow.size.shape !== straight.size.shape
  ) return false;
  if (elbow.size.shape === "rectangular" && straight.size.shape === "rectangular") {
    return elbow.size.widthInches === straight.size.widthInches &&
      elbow.size.heightInches === straight.size.heightInches;
  }
  return elbow.size.shape === "round" && straight.size.shape === "round" &&
    elbow.size.diameterInches === straight.size.diameterInches;
}

/**
 * Plans an explicit elbow-outlet connection to an already drawn straight.
 * The elbow owns the connection vertex and outbound axis. The reviewed straight
 * endpoint moves to that vertex; its far endpoint is projected only by the
 * supplied alignment tolerance so the connection cannot invent another bend.
 */
export function planRigidExistingConnection(input: {
  elbowId: string;
  elbow: RigidElbowMetaV1;
  elbowVertex: RigidPoint;
  straightId: string;
  straight: RigidStraightMetaV1;
  straightTopology: RigidStraightTopologyV1;
  straightPoints: readonly RigidPoint[];
  straightPortId: RigidStraightPortId;
  feetPerUnit: number;
  maxEndpointMoveUnits: number;
  axisToleranceUnits: number;
  minimumBeyondOutletUnits?: number;
}): RigidExistingConnectionPlan | RigidExistingConnectionRejection {
  const elbow = normalizeRigidElbowMeta(input.elbow);
  if (!elbow || !input.elbowId.trim() || input.elbowId === input.straightId) {
    return { ok: false, reason: "invalid-elbow" };
  }
  const straight = normalizeRigidStraightMeta(input.straight);
  if (!straight || !input.straightId.trim()) {
    return { ok: false, reason: "invalid-straight" };
  }
  if (elbow.ports.outlet.connectedTo) return { ok: false, reason: "outlet-connected" };
  if (elbow.ports.outlet.takeoutInches == null) {
    return { ok: false, reason: "outlet-takeout-required" };
  }
  if (!rigidIdentityMatches(elbow, straight)) {
    return { ok: false, reason: "incompatible-rigid" };
  }
  const topology = normalizeRigidStraightTopology(input.straightTopology);
  const selectedPort = topology.ports[input.straightPortId];
  if (selectedPort.connectedTo) return { ok: false, reason: "straight-port-connected" };
  if (
    input.straightPoints.length !== 2 ||
    ![
      input.elbowVertex.x,
      input.elbowVertex.y,
      ...input.straightPoints.flatMap((point) => [point.x, point.y]),
      input.maxEndpointMoveUnits,
      input.axisToleranceUnits,
    ].every(Number.isFinite) ||
    input.maxEndpointMoveUnits < 0 ||
    input.axisToleranceUnits < 0
  ) return { ok: false, reason: "invalid-geometry" };
  const geometry = rigidElbowGeometry(input.elbowVertex, elbow, input.feetPerUnit);
  if (!geometry) return { ok: false, reason: "invalid-geometry" };

  const selectedIndex = input.straightPortId === "start" ? 0 : 1;
  const farIndex = selectedIndex === 0 ? 1 : 0;
  const endpoint = input.straightPoints[selectedIndex];
  const farEndpoint = input.straightPoints[farIndex];
  const endpointMoveUnits = Math.hypot(
    endpoint.x - input.elbowVertex.x,
    endpoint.y - input.elbowVertex.y,
  );
  if (endpointMoveUnits > input.maxEndpointMoveUnits) {
    return { ok: false, reason: "endpoint-too-far" };
  }

  const farDelta = {
    x: farEndpoint.x - input.elbowVertex.x,
    y: farEndpoint.y - input.elbowVertex.y,
  };
  const outletDistanceUnits = Math.hypot(
    geometry.outlet.x - input.elbowVertex.x,
    geometry.outlet.y - input.elbowVertex.y,
  );
  const farAlong = farDelta.x * geometry.outbound.x + farDelta.y * geometry.outbound.y;
  const farCross = farDelta.x * geometry.outbound.y - farDelta.y * geometry.outbound.x;
  const rawFarEndpointCorrectionUnits = Math.abs(farCross);
  const farEndpointCorrectionUnits = rawFarEndpointCorrectionUnits <= 1e-9
    ? 0
    : rawFarEndpointCorrectionUnits;
  if (farEndpointCorrectionUnits > input.axisToleranceUnits) {
    return { ok: false, reason: "axis-misaligned" };
  }
  const farPortId: RigidStraightPortId = input.straightPortId === "start" ? "end" : "start";
  if (topology.ports[farPortId].connectedTo && farEndpointCorrectionUnits > 1e-6) {
    return { ok: false, reason: "connected-far-end-would-move" };
  }
  if (farAlong <= outletDistanceUnits + Math.max(0, input.minimumBeyondOutletUnits || 0)) {
    return { ok: false, reason: "straight-too-short" };
  }

  const adjustedFarEndpoint = farEndpointCorrectionUnits <= 1e-9
    ? { ...farEndpoint }
    : {
        x: input.elbowVertex.x + geometry.outbound.x * farAlong,
        y: input.elbowVertex.y + geometry.outbound.y * farAlong,
      };
  const points = input.straightPoints.map((point) => ({ ...point })) as [RigidPoint, RigidPoint];
  points[selectedIndex] = { ...input.elbowVertex };
  points[farIndex] = adjustedFarEndpoint;
  return {
    ok: true,
    elbow: {
      ...elbow,
      ports: {
        ...elbow.ports,
        outlet: {
          ...elbow.ports.outlet,
          connectedTo: { drawingId: input.straightId, portId: input.straightPortId },
        },
      },
    },
    topology: {
      ...topology,
      ports: {
        ...topology.ports,
        [input.straightPortId]: {
          ...selectedPort,
          takeoutInches: elbow.ports.outlet.takeoutInches,
          connectedTo: { drawingId: input.elbowId, portId: "outlet" },
        },
      },
    },
    points,
    straightPortId: input.straightPortId,
    endpointMoveUnits,
    farEndpointCorrectionUnits,
    outletDistanceUnits,
  };
}

export function projectRigidContinuationPoint(input: {
  vertex: RigidPoint;
  elbow: RigidElbowMetaV1;
  pointer: RigidPoint;
  feetPerUnit: number;
}) {
  const geometry = rigidElbowGeometry(input.vertex, input.elbow, input.feetPerUnit);
  if (!geometry) return null;
  const pointerDistance =
    (input.pointer.x - input.vertex.x) * geometry.outbound.x +
    (input.pointer.y - input.vertex.y) * geometry.outbound.y;
  const outletDistance = Math.hypot(
    geometry.outlet.x - input.vertex.x,
    geometry.outlet.y - input.vertex.y,
  );
  const distance = Math.max(outletDistance, pointerDistance);
  return {
    vertex: { ...input.vertex },
    outlet: geometry.outlet,
    point: {
      x: input.vertex.x + geometry.outbound.x * distance,
      y: input.vertex.y + geometry.outbound.y * distance,
    },
    outbound: geometry.outbound,
    outletDistance,
    distanceBeyondOutlet: distance - outletDistance,
  };
}
