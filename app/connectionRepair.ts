export type ConnectionPoint = { x: number; y: number };
export type ConnectionDuctType = "supply" | "return";
export type ConnectionEnd = "start" | "end";

export type ConnectionRunSnapshot = {
  id: string;
  page: number;
  systemId: string;
  type: ConnectionDuctType;
  size: string;
  points: ConnectionPoint[];
};

export type ConnectionDeviceTarget = {
  id: string;
  kind: "device";
  drawingId: string;
  label: string;
  detail: string;
  page: number;
  systemId: string;
  ductType: ConnectionDuctType;
  slot: "terminal" | "equipment-supply" | "equipment-return";
  targetPoint: ConnectionPoint;
  savedRunId?: string;
  savedEnd?: ConnectionEnd;
};

export type ConnectionFittingTarget = {
  id: string;
  kind: "fitting";
  drawingId: string;
  label: string;
  detail: string;
  page: number;
  systemId: string;
  ductType: "supply";
  port: 0 | 1 | 2;
  targetPoint: ConnectionPoint;
  savedRunId: string;
};

export type ConnectionRepairTarget = ConnectionDeviceTarget | ConnectionFittingTarget;

export type ConnectionRepairCandidate = {
  id: string;
  endpointKey: string;
  runId: string;
  runSize: string;
  end: ConnectionEnd;
  point: ConnectionPoint;
  distance: number;
};

export type ConnectionRepairStatus = "healthy" | "ready" | "choice" | "blocked";

export type ConnectionRepairItem = {
  id: string;
  kind: ConnectionRepairTarget["kind"];
  drawingId: string;
  label: string;
  detail: string;
  page: number;
  systemId: string;
  ductType: ConnectionDuctType;
  targetPoint: ConnectionPoint;
  status: ConnectionRepairStatus;
  reason: string;
  saved: boolean;
  slot?: ConnectionDeviceTarget["slot"];
  port?: ConnectionFittingTarget["port"];
  candidates: ConnectionRepairCandidate[];
  candidate?: ConnectionRepairCandidate;
};

export type ConnectionRepairPlan = {
  version: "connection-repair-v1";
  fingerprint: string;
  items: ConnectionRepairItem[];
  counts: {
    healthy: number;
    ready: number;
    choice: number;
    blocked: number;
  };
};

export type ConnectionRepairOperation = {
  itemId: string;
  kind: ConnectionRepairTarget["kind"];
  drawingId: string;
  slot?: ConnectionDeviceTarget["slot"];
  port?: ConnectionFittingTarget["port"];
  runId: string;
  end: ConnectionEnd;
  from: ConnectionPoint;
  to: ConnectionPoint;
};

export type ConnectionRepairBatch =
  | { ok: true; operations: ConnectionRepairOperation[] }
  | { ok: false; reason: string; operations: [] };

export const CONNECTION_ALIGNMENT_TOLERANCE = 2;
export const CONNECTION_REPAIR_LIMITS = {
  terminal: 70,
  equipment: 90,
  fitting: 48,
} as const;

const AMBIGUITY_DISTANCE = 8;
const AMBIGUITY_RATIO = 0.25;

function distance(a: ConnectionPoint, b: ConnectionPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function endpointKey(runId: string, end: ConnectionEnd) {
  return `${runId}:${end}`;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function repairFingerprint(
  systemId: string,
  runs: ConnectionRunSnapshot[],
  targets: ConnectionRepairTarget[],
) {
  const source = {
    version: "connection-repair-v1",
    systemId,
    runs: runs
      .map((run) => ({
        id: run.id,
        page: run.page,
        systemId: run.systemId,
        type: run.type,
        size: run.size,
        points: run.points,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    targets: targets
      .map((target) => ({
        ...target,
        targetPoint: target.targetPoint,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  return `step1-${stableHash(JSON.stringify(source))}`;
}

function runEndpoint(run: ConnectionRunSnapshot, end: ConnectionEnd) {
  return end === "start" ? run.points[0] : run.points[run.points.length - 1];
}

function matchingRun(
  runs: ConnectionRunSnapshot[],
  target: ConnectionRepairTarget,
  runId: string,
) {
  return runs.find((run) =>
    run.id === runId &&
    run.page === target.page &&
    run.systemId === target.systemId &&
    run.type === target.ductType &&
    run.points.length >= 2
  );
}

function savedCandidate(
  runs: ConnectionRunSnapshot[],
  target: ConnectionRepairTarget,
): ConnectionRepairCandidate | null {
  const savedRunId = target.savedRunId;
  if (!savedRunId) return null;
  const run = matchingRun(runs, target, savedRunId);
  if (!run) return null;
  let end: ConnectionEnd;
  if (target.kind === "device") {
    if (!target.savedEnd) return null;
    end = target.savedEnd;
  } else {
    const startDistance = distance(run.points[0], target.targetPoint);
    const endDistance = distance(run.points[run.points.length - 1], target.targetPoint);
    end = startDistance <= endDistance ? "start" : "end";
  }
  const point = runEndpoint(run, end);
  return {
    id: endpointKey(run.id, end),
    endpointKey: endpointKey(run.id, end),
    runId: run.id,
    runSize: run.size,
    end,
    point,
    distance: distance(point, target.targetPoint),
  };
}

function repairLimit(target: ConnectionRepairTarget) {
  if (target.kind === "fitting") return CONNECTION_REPAIR_LIMITS.fitting;
  return target.slot === "terminal"
    ? CONNECTION_REPAIR_LIMITS.terminal
    : CONNECTION_REPAIR_LIMITS.equipment;
}

function candidateList(
  runs: ConnectionRunSnapshot[],
  target: ConnectionDeviceTarget,
  reservedEndpoints: Set<string>,
) {
  return runs
    .filter((run) =>
      run.page === target.page &&
      run.systemId === target.systemId &&
      run.type === target.ductType &&
      run.points.length >= 2
    )
    .flatMap((run) => (["start", "end"] as const).map((end) => {
      const point = runEndpoint(run, end);
      return {
        id: endpointKey(run.id, end),
        endpointKey: endpointKey(run.id, end),
        runId: run.id,
        runSize: run.size,
        end,
        point,
        distance: distance(point, target.targetPoint),
      };
    }))
    .filter((candidate) =>
      candidate.distance <= repairLimit(target) &&
      !reservedEndpoints.has(candidate.endpointKey)
    )
    .sort((a, b) =>
      a.distance - b.distance ||
      a.runId.localeCompare(b.runId) ||
      a.end.localeCompare(b.end)
    )
    .slice(0, 3);
}

function isAmbiguous(candidates: ConnectionRepairCandidate[]) {
  if (candidates.length < 2) return false;
  const gap = candidates[1].distance - candidates[0].distance;
  return gap < Math.max(AMBIGUITY_DISTANCE, candidates[0].distance * AMBIGUITY_RATIO);
}

function baseItem(target: ConnectionRepairTarget): Omit<ConnectionRepairItem, "status" | "reason" | "saved" | "candidates"> {
  return {
    id: target.id,
    kind: target.kind,
    drawingId: target.drawingId,
    label: target.label,
    detail: target.detail,
    page: target.page,
    systemId: target.systemId,
    ductType: target.ductType,
    targetPoint: target.targetPoint,
    slot: target.kind === "device" ? target.slot : undefined,
    port: target.kind === "fitting" ? target.port : undefined,
  };
}

export function buildConnectionRepairPlan(input: {
  systemId: string;
  runs: ConnectionRunSnapshot[];
  targets: ConnectionRepairTarget[];
  choices?: Record<string, string>;
}): ConnectionRepairPlan {
  const { systemId } = input;
  const runs = input.runs.filter((run) => run.systemId === systemId);
  const targets = input.targets.filter((target) => target.systemId === systemId);
  const choices = input.choices || {};
  const fingerprint = repairFingerprint(systemId, runs, targets);

  const savedByTarget = new Map<string, ConnectionRepairCandidate>();
  const claims = new Map<string, string[]>();
  for (const target of targets) {
    const candidate = savedCandidate(runs, target);
    if (!candidate) continue;
    savedByTarget.set(target.id, candidate);
    const current = claims.get(candidate.endpointKey) || [];
    claims.set(candidate.endpointKey, [...current, target.id]);
  }
  const reservedEndpoints = new Set(claims.keys());

  let items: ConnectionRepairItem[] = targets.map((target) => {
    const base = baseItem(target);
    const savedRunId = target.savedRunId;
    const saved = Boolean(savedRunId);
    const savedMatch = savedByTarget.get(target.id);

    if (saved && !savedMatch) {
      return {
        ...base,
        status: "blocked",
        reason: target.kind === "device" && !target.savedEnd
          ? "The saved run end is missing. Choose the connection on the plan."
          : "The saved run is missing or belongs to another sheet, system, or duct type.",
        saved,
        candidates: [],
      };
    }

    if (savedMatch) {
      if ((claims.get(savedMatch.endpointKey) || []).length > 1) {
        return {
          ...base,
          status: "blocked",
          reason: "This run end is saved to more than one connection. Review it on the plan.",
          saved,
          candidates: [savedMatch],
        };
      }
      if (savedMatch.distance < CONNECTION_ALIGNMENT_TOLERANCE) {
        return {
          ...base,
          status: "healthy",
          reason: "Saved connection is aligned.",
          saved,
          candidates: [savedMatch],
          candidate: savedMatch,
        };
      }
      if (savedMatch.distance > repairLimit(target)) {
        return {
          ...base,
          status: "blocked",
          reason: "The saved run end is too far away for a safe endpoint repair.",
          saved,
          candidates: [savedMatch],
        };
      }
      return {
        ...base,
        status: "ready",
        reason: target.kind === "fitting"
          ? "The saved run end can snap back to this exact T/Y port."
          : "The saved run end can snap back without moving the placed object.",
        saved,
        candidates: [savedMatch],
        candidate: savedMatch,
      };
    }

    if (target.kind === "fitting") {
      return {
        ...base,
        status: "blocked",
        reason: "No saved run is assigned to this fitting port.",
        saved: false,
        candidates: [],
      };
    }

    const candidates = candidateList(runs, target, reservedEndpoints);
    const chosen = candidates.find((candidate) => candidate.id === choices[target.id]);
    if (chosen) {
      return {
        ...base,
        status: "ready",
        reason: "You chose this compatible run end.",
        saved: false,
        candidates,
        candidate: chosen,
      };
    }
    if (!candidates.length) {
      return {
        ...base,
        status: "blocked",
        reason: "No unused matching run end is close enough.",
        saved: false,
        candidates,
      };
    }
    if (isAmbiguous(candidates)) {
      return {
        ...base,
        status: "choice",
        reason: "More than one matching run end is nearby. Choose the correct one.",
        saved: false,
        candidates,
      };
    }
    return {
      ...base,
      status: "ready",
      reason: "One unused matching run end is nearby.",
      saved: false,
      candidates,
      candidate: candidates[0],
    };
  });

  const automaticClaims = new Map<string, string[]>();
  for (const item of items) {
    if (item.status !== "ready" || !item.candidate) continue;
    const current = automaticClaims.get(item.candidate.endpointKey) || [];
    automaticClaims.set(item.candidate.endpointKey, [...current, item.id]);
  }
  items = items.map((item) => {
    if (
      item.status !== "ready" ||
      !item.candidate ||
      (automaticClaims.get(item.candidate.endpointKey) || []).length < 2
    ) return item;
    return {
      ...item,
      status: "choice",
      reason: "This run end is also the best match for another item. Choose on the plan.",
      candidate: undefined,
    };
  });

  items.sort((a, b) =>
    a.page - b.page ||
    a.kind.localeCompare(b.kind) ||
    a.label.localeCompare(b.label) ||
    a.id.localeCompare(b.id)
  );

  return {
    version: "connection-repair-v1",
    fingerprint,
    items,
    counts: {
      healthy: items.filter((item) => item.status === "healthy").length,
      ready: items.filter((item) => item.status === "ready").length,
      choice: items.filter((item) => item.status === "choice").length,
      blocked: items.filter((item) => item.status === "blocked").length,
    },
  };
}

export function prepareConnectionRepairBatch(
  plan: ConnectionRepairPlan,
  selectedIds: string[],
  expectedFingerprint: string,
): ConnectionRepairBatch {
  if (plan.fingerprint !== expectedFingerprint) {
    return { ok: false, reason: "The plan changed after this review. Refresh Step 1 before applying.", operations: [] };
  }
  const selected = [...new Set(selectedIds)];
  if (!selected.length) {
    return { ok: false, reason: "Select at least one reviewed connection.", operations: [] };
  }
  const items = selected.map((id) => plan.items.find((item) => item.id === id));
  if (items.some((item) => !item || item.status !== "ready" || !item.candidate)) {
    return { ok: false, reason: "One selected connection is no longer ready. Refresh the review.", operations: [] };
  }
  const endpointKeys = items.map((item) => item!.candidate!.endpointKey);
  if (new Set(endpointKeys).size !== endpointKeys.length) {
    return { ok: false, reason: "Two selected fixes use the same run end. Choose separate endpoints.", operations: [] };
  }
  return {
    ok: true,
    operations: items.map((item) => ({
      itemId: item!.id,
      kind: item!.kind,
      drawingId: item!.drawingId,
      slot: item!.slot,
      port: item!.port,
      runId: item!.candidate!.runId,
      end: item!.candidate!.end,
      from: item!.candidate!.point,
      to: item!.targetPoint,
    })),
  };
}
