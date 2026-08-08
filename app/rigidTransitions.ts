import {
  normalizeRigidStraightMeta,
  type RigidConstruction,
  type RigidNetworkKind,
  type RigidPoint,
  type RigidSize,
  type RigidStraightMetaV1,
} from "./rigidDuct";
import {
  normalizeRigidStraightTopology,
  type RigidConnectionRef,
  type RigidStraightPortId,
} from "./rigidTopology";

export type RigidTransitionAlignment =
  | "centered"
  | "top-flat"
  | "bottom-flat"
  | "left-flat"
  | "right-flat";

export type RigidTransitionPortState = {
  id: "inlet" | "outlet";
  connectedTo?: RigidConnectionRef;
  /** Plane-to-plane takeout owned by the fitting. Zero is explicit and valid. */
  takeoutInches: number;
};

export type RigidTransitionMetaV1 = {
  version: 1;
  kind: "transition";
  networkKind: RigidNetworkKind;
  construction: RigidConstruction;
  inletSize: RigidSize;
  outletSize: RigidSize;
  lengthInches: number;
  alignment: RigidTransitionAlignment;
  inboundAngleDegrees: number;
  ports: {
    inlet: RigidTransitionPortState;
    outlet: RigidTransitionPortState;
  };
};

export type RigidTerminalConnectionV1 = {
  version: 1;
  kind: "supply-can-collar" | "return-can-collar";
  construction: "round-metal" | "spiral";
  diameterInches: number;
  collarType: "straight-collar";
  connectedTo: RigidConnectionRef;
};

const ALIGNMENTS: readonly RigidTransitionAlignment[] = [
  "centered",
  "top-flat",
  "bottom-flat",
  "left-flat",
  "right-flat",
];

function finiteQuarter(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) return null;
  return Math.round(number * 4) / 4;
}

function normalizedConnection(value: unknown): RigidConnectionRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<RigidConnectionRef>;
  if (typeof candidate.drawingId !== "string" || !candidate.drawingId.trim()) return undefined;
  if (!["start", "end", "inlet", "outlet", "neck"].includes(String(candidate.portId))) return undefined;
  return { drawingId: candidate.drawingId, portId: candidate.portId as RigidConnectionRef["portId"] };
}

function normalizeSizeForConstruction(construction: RigidConstruction, input: unknown): RigidSize | null {
  const candidate = normalizeRigidStraightMeta({
    version: 1,
    kind: "straight",
    networkKind: "supply",
    construction,
    size: input,
  });
  return candidate?.size || null;
}

export function normalizeRigidTransitionMeta(input: unknown): RigidTransitionMetaV1 | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<RigidTransitionMetaV1>;
  if (
    candidate.version !== 1 ||
    candidate.kind !== "transition" ||
    !["supply", "return", "fresh"].includes(String(candidate.networkKind)) ||
    !["rectangular", "round-metal", "spiral"].includes(String(candidate.construction)) ||
    !ALIGNMENTS.includes(candidate.alignment as RigidTransitionAlignment) ||
    !Number.isFinite(Number(candidate.inboundAngleDegrees)) ||
    !candidate.ports ||
    typeof candidate.ports !== "object"
  ) return null;
  const construction = candidate.construction as RigidConstruction;
  const inletSize = normalizeSizeForConstruction(construction, candidate.inletSize);
  const outletSize = normalizeSizeForConstruction(construction, candidate.outletSize);
  const lengthInches = finiteQuarter(candidate.lengthInches, 1, 240);
  if (!inletSize || !outletSize || !lengthInches || inletSize.shape !== outletSize.shape) return null;
  const port = (id: "inlet" | "outlet"): RigidTransitionPortState | null => {
    const raw = candidate.ports?.[id] as Partial<RigidTransitionPortState> | undefined;
    const takeoutInches = finiteQuarter(raw?.takeoutInches, 0, 120);
    if (takeoutInches == null) return null;
    const connectedTo = normalizedConnection(raw?.connectedTo);
    return { id, takeoutInches, ...(connectedTo ? { connectedTo } : {}) };
  };
  const inlet = port("inlet");
  const outlet = port("outlet");
  if (!inlet || !outlet) return null;
  return {
    version: 1,
    kind: "transition",
    networkKind: candidate.networkKind as RigidNetworkKind,
    construction,
    inletSize,
    outletSize,
    lengthInches,
    alignment: candidate.alignment as RigidTransitionAlignment,
    inboundAngleDegrees: ((Number(candidate.inboundAngleDegrees) % 360) + 360) % 360,
    ports: { inlet, outlet },
  };
}

export function normalizeRigidTerminalConnection(input: unknown): RigidTerminalConnectionV1 | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<RigidTerminalConnectionV1>;
  const diameterInches = finiteQuarter(candidate.diameterInches, 1, 72);
  const connectedTo = normalizedConnection(candidate.connectedTo);
  if (
    candidate.version !== 1 ||
    !["supply-can-collar", "return-can-collar"].includes(String(candidate.kind)) ||
    !["round-metal", "spiral"].includes(String(candidate.construction)) ||
    candidate.collarType !== "straight-collar" ||
    !diameterInches ||
    !connectedTo ||
    !["start", "end"].includes(connectedTo.portId)
  ) return null;
  return {
    version: 1,
    kind: candidate.kind as RigidTerminalConnectionV1["kind"],
    construction: candidate.construction as "round-metal" | "spiral",
    diameterInches,
    collarType: "straight-collar",
    connectedTo,
  };
}

export function rigidTerminalNetworkKind(
  connection: Pick<RigidTerminalConnectionV1, "kind">,
): Extract<RigidNetworkKind, "supply" | "return"> {
  return connection.kind === "return-can-collar" ? "return" : "supply";
}

export function rigidSizeMatches(left: RigidSize, right: RigidSize) {
  if (left.shape !== right.shape) return false;
  if (left.shape === "rectangular" && right.shape === "rectangular") {
    return left.widthInches === right.widthInches && left.heightInches === right.heightInches;
  }
  return left.shape === "round" && right.shape === "round" && left.diameterInches === right.diameterInches;
}

export function rigidTransitionIsReduction(input: RigidTransitionMetaV1) {
  if (input.inletSize.shape === "rectangular" && input.outletSize.shape === "rectangular") {
    return input.outletSize.widthInches <= input.inletSize.widthInches &&
      input.outletSize.heightInches <= input.inletSize.heightInches &&
      !rigidSizeMatches(input.inletSize, input.outletSize);
  }
  return input.inletSize.shape === "round" && input.outletSize.shape === "round" &&
    input.outletSize.diameterInches < input.inletSize.diameterInches;
}

export function createRigidTransition(input: {
  fittingId: string;
  straightId: string;
  straight: RigidStraightMetaV1;
  straightPortId: RigidStraightPortId;
  outletSize: RigidSize;
  lengthInches: number;
  alignment: RigidTransitionAlignment;
  inboundAngleDegrees: number;
}): RigidTransitionMetaV1 | null {
  const candidate = normalizeRigidTransitionMeta({
    version: 1,
    kind: "transition",
    networkKind: input.straight.networkKind,
    construction: input.straight.construction,
    inletSize: input.straight.size,
    outletSize: input.outletSize,
    lengthInches: input.lengthInches,
    alignment: input.straight.construction === "rectangular" ? input.alignment : "centered",
    inboundAngleDegrees: input.inboundAngleDegrees,
    ports: {
      inlet: {
        id: "inlet",
        takeoutInches: 0,
        connectedTo: { drawingId: input.straightId, portId: input.straightPortId },
      },
      outlet: { id: "outlet", takeoutInches: 0 },
    },
  });
  return candidate && rigidTransitionIsReduction(candidate) ? candidate : null;
}

function direction(angleDegrees: number) {
  const radians = angleDegrees * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

export function rigidTransitionGeometry(
  inlet: RigidPoint,
  transition: RigidTransitionMetaV1,
  feetPerUnit: number,
) {
  if (!Number.isFinite(feetPerUnit) || feetPerUnit <= 0) return null;
  const axis = direction(transition.inboundAngleDegrees);
  const lengthUnits = transition.lengthInches / 12 / feetPerUnit;
  return {
    inlet: { ...inlet },
    outlet: { x: inlet.x + axis.x * lengthUnits, y: inlet.y + axis.y * lengthUnits },
    axis,
    normal: { x: -axis.y, y: axis.x },
    lengthUnits,
  };
}

export function rigidTransitionPolygon(input: {
  inlet: RigidPoint;
  transition: RigidTransitionMetaV1;
  feetPerUnit: number;
  inletWidthUnits: number;
  outletWidthUnits: number;
}) {
  const geometry = rigidTransitionGeometry(input.inlet, input.transition, input.feetPerUnit);
  if (!geometry) return null;
  const inletHalf = input.inletWidthUnits / 2;
  const outletHalf = input.outletWidthUnits / 2;
  const inletOffset = 0;
  let outletOffset = 0;
  const delta = inletHalf - outletHalf;
  if (["top-flat", "left-flat"].includes(input.transition.alignment)) outletOffset = -delta;
  if (["bottom-flat", "right-flat"].includes(input.transition.alignment)) outletOffset = delta;
  const at = (point: RigidPoint, offset: number) => ({
    x: point.x + geometry.normal.x * offset,
    y: point.y + geometry.normal.y * offset,
  });
  return {
    ...geometry,
    points: [
      at(geometry.inlet, inletOffset - inletHalf),
      at(geometry.inlet, inletOffset + inletHalf),
      at(geometry.outlet, outletOffset + outletHalf),
      at(geometry.outlet, outletOffset - outletHalf),
    ] as [RigidPoint, RigidPoint, RigidPoint, RigidPoint],
  };
}

export function createRigidTransitionContinuation(input: {
  transitionId: string;
  transition: RigidTransitionMetaV1;
  straightId: string;
}) {
  const transition = normalizeRigidTransitionMeta(input.transition);
  if (!transition || transition.ports.outlet.connectedTo) return null;
  const straight = normalizeRigidStraightMeta({
    version: 1,
    kind: "straight",
    networkKind: transition.networkKind,
    construction: transition.construction,
    size: transition.outletSize,
  });
  if (!straight) return null;
  return {
    transition: {
      ...transition,
      ports: {
        ...transition.ports,
        outlet: {
          ...transition.ports.outlet,
          connectedTo: { drawingId: input.straightId, portId: "start" as const },
        },
      },
    },
    straight,
    topology: normalizeRigidStraightTopology({
      version: 1,
      ports: {
        start: {
          id: "start",
          takeoutInches: 0,
          connectedTo: { drawingId: input.transitionId, portId: "outlet" },
        },
        end: { id: "end", takeoutInches: 0 },
      },
    }),
  };
}
