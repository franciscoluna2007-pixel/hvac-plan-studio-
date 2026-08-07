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
  /** Direction from the connection point outward into the existing run. */
  expectedDirection?: ConnectionPoint;
  /** Nominal run size expected at this connection, when the plan provides one. */
  expectedSize?: string;
};

export type ConnectionFittingTarget = {
  id: string;
  kind: "fitting";
  drawingId: string;
  label: string;
  detail: string;
  page: number;
  systemId: string;
  ductType: ConnectionDuctType;
  port: 0 | 1 | 2;
  targetPoint: ConnectionPoint;
  savedRunId?: string;
  /** Direction from the fitting port outward into the existing run. */
  expectedDirection?: ConnectionPoint;
  /** Nominal upstream, downstream, or branch size for this port. */
  expectedSize?: string;
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
  score: number;
  directionErrorDegrees?: number;
  alignmentErrorDegrees: number;
  sizeMatch?: boolean;
  signals: string[];
  explanation: string;
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
  version: "connection-repair-v123.0";
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

export type ConnectionRepairScale = {
  verified: boolean;
  feetPerUnit: number;
  byPage?: Record<string, {
    verified: boolean;
    feetPerUnit: number;
  }>;
};

export const CONNECTION_ALIGNMENT_TOLERANCE = 2;
export const CONNECTION_REPAIR_LIMITS = {
  terminal: 70,
  equipment: 90,
  fitting: 48,
} as const;
export const CONNECTION_REPAIR_PHYSICAL_LIMITS_FEET = {
  terminal: 3,
  equipment: 4,
  fitting: 2,
} as const;

const AMBIGUITY_SCORE_GAP = 8;
const AMBIGUITY_RATIO = 0.25;
const MAX_FITTING_DIRECTION_ERROR_DEGREES = 70;
const HIGH_CONFIDENCE_DIRECTION_DEGREES = 28;
const HIGH_CONFIDENCE_ALIGNMENT_DEGREES = 30;

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
  scale?: ConnectionRepairScale,
) {
  const source = {
    version: "connection-repair-v123.0",
    systemId,
    scale: scale
      ? {
          verified: scale.verified,
          feetPerUnit: Number.isFinite(scale.feetPerUnit) ? scale.feetPerUnit : null,
          byPage: Object.fromEntries(
            Object.entries(scale.byPage || {})
              .sort(([left], [right]) => Number(left) - Number(right))
              .map(([page, pageScale]) => [page, {
                verified: pageScale.verified,
                feetPerUnit: Number.isFinite(pageScale.feetPerUnit) ? pageScale.feetPerUnit : null,
              }])
          ),
        }
      : null,
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

function runEndpointNeighbor(run: ConnectionRunSnapshot, end: ConnectionEnd) {
  return end === "start" ? run.points[1] : run.points[run.points.length - 2];
}

function vector(from: ConnectionPoint, to: ConnectionPoint) {
  return { x: to.x - from.x, y: to.y - from.y };
}

function angleBetweenDegrees(a: ConnectionPoint, b: ConnectionPoint) {
  const aLength = Math.hypot(a.x, a.y);
  const bLength = Math.hypot(b.x, b.y);
  if (aLength < .001 || bLength < .001) return undefined;
  const cosine = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (aLength * bLength)));
  return Math.acos(cosine) * 180 / Math.PI;
}

function normalizedSize(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, "").replace(/["\u2033]/g, "") || "";
}

function verifiedFeetPerUnit(scale?: ConnectionRepairScale, page?: number) {
  const activeScale = page == null ? scale : scale?.byPage?.[String(page)] || scale;
  if (!activeScale?.verified || !Number.isFinite(activeScale.feetPerUnit) || activeScale.feetPerUnit <= 0) {
    return null;
  }
  return activeScale.feetPerUnit;
}

function hasVerifiedScale(scale?: ConnectionRepairScale, page?: number) {
  return verifiedFeetPerUnit(scale, page) != null;
}

function targetLimitKind(target: ConnectionRepairTarget) {
  if (target.kind === "fitting") return "fitting" as const;
  return target.slot === "terminal" ? "terminal" as const : "equipment" as const;
}

function repairLimit(target: ConnectionRepairTarget, scale?: ConnectionRepairScale) {
  const kind = targetLimitKind(target);
  const feetPerUnit = verifiedFeetPerUnit(scale, target.page);
  if (feetPerUnit != null) {
    return CONNECTION_REPAIR_PHYSICAL_LIMITS_FEET[kind] / feetPerUnit;
  }
  return CONNECTION_REPAIR_LIMITS[kind];
}

function humanDistance(planUnits: number, scale?: ConnectionRepairScale, page?: number) {
  const feetPerUnit = verifiedFeetPerUnit(scale, page);
  if (feetPerUnit == null) {
    const rounded = Math.round(planUnits * 10) / 10;
    return `${rounded} plan ${rounded === 1 ? "unit" : "units"} away`;
  }
  const feet = planUnits * feetPerUnit;
  if (feet < 1) return `${Math.round(feet * 12)} in away`;
  const rounded = Math.round(feet * 10) / 10;
  return `${rounded} ft away`;
}

function candidateFor(
  run: ConnectionRunSnapshot,
  end: ConnectionEnd,
  target: ConnectionRepairTarget,
  scale?: ConnectionRepairScale,
  endpointUnused = false,
): ConnectionRepairCandidate {
  const point = runEndpoint(run, end);
  const neighbor = runEndpointNeighbor(run, end);
  const currentDirection = vector(point, neighbor);
  const repairedDirection = vector(target.targetPoint, neighbor);
  const alignmentErrorDegrees = angleBetweenDegrees(currentDirection, repairedDirection) ?? 180;
  const directionErrorDegrees = target.expectedDirection
    ? angleBetweenDegrees(target.expectedDirection, repairedDirection)
    : undefined;
  const expectedSize = normalizedSize(target.expectedSize);
  const sizeMatch = expectedSize
    ? normalizedSize(run.size) === expectedSize
    : undefined;
  const candidateDistance = distance(point, target.targetPoint);
  const directionPenalty = directionErrorDegrees == null ? 0 : directionErrorDegrees * .3;
  const alignmentPenalty = alignmentErrorDegrees * .12;
  const sizePenalty = sizeMatch === false ? 14 : 0;
  const score = candidateDistance + directionPenalty + alignmentPenalty + sizePenalty;
  const limit = repairLimit(target, scale);
  const signals: string[] = [
    "same sheet and system",
    `${target.ductType} run`,
  ];
  if (endpointUnused) signals.push("endpoint unused");
  signals.push(humanDistance(candidateDistance, scale, target.page));

  if (sizeMatch === true) {
    signals.push(`${run.size} size matches the port`);
  } else if (sizeMatch === false) {
    signals.push(`${run.size} run differs from ${target.expectedSize} port`);
  }
  if (directionErrorDegrees != null) {
    if (directionErrorDegrees <= 12) signals.push("direction is aligned");
    else if (directionErrorDegrees <= HIGH_CONFIDENCE_DIRECTION_DEGREES) signals.push("direction is compatible");
    else signals.push(`direction differs by ${Math.round(directionErrorDegrees)} degrees`);
  }
  if (alignmentErrorDegrees <= 12) signals.push("endpoint snaps along the run");
  else if (alignmentErrorDegrees <= HIGH_CONFIDENCE_ALIGNMENT_DEGREES) signals.push("snap keeps run alignment");
  else signals.push(`snap changes the run angle by ${Math.round(alignmentErrorDegrees)} degrees`);
  if (candidateDistance <= limit * .25) signals.push("very close endpoint");
  else if (candidateDistance <= limit * (2 / 3)) signals.push("nearby endpoint");
  else signals.push("endpoint is within the repair range");

  return {
    id: endpointKey(run.id, end),
    endpointKey: endpointKey(run.id, end),
    runId: run.id,
    runSize: run.size,
    end,
    point,
    distance: candidateDistance,
    score,
    directionErrorDegrees,
    alignmentErrorDegrees,
    sizeMatch,
    signals,
    explanation: signals.join(" | "),
  };
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
  scale?: ConnectionRepairScale,
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
  return candidateFor(run, end, target, scale);
}

function candidateList(
  runs: ConnectionRunSnapshot[],
  target: ConnectionRepairTarget,
  reservedEndpoints: Set<string>,
  scale?: ConnectionRepairScale,
) {
  return runs
    .filter((run) =>
      run.page === target.page &&
      run.systemId === target.systemId &&
      run.type === target.ductType &&
      run.points.length >= 2
    )
    .flatMap((run) => (["start", "end"] as const).map((end) =>
      candidateFor(run, end, target, scale, true)
    ))
    .filter((candidate) =>
      candidate.distance <= repairLimit(target, scale) &&
      !reservedEndpoints.has(candidate.endpointKey) &&
      (
        target.kind !== "fitting" ||
        candidate.directionErrorDegrees == null ||
        candidate.directionErrorDegrees <= MAX_FITTING_DIRECTION_ERROR_DEGREES
      )
    )
    .sort((a, b) =>
      a.score - b.score ||
      a.distance - b.distance ||
      a.runId.localeCompare(b.runId) ||
      a.end.localeCompare(b.end)
    )
    .slice(0, 3);
}

function isAmbiguous(candidates: ConnectionRepairCandidate[]) {
  if (candidates.length < 2) return false;
  const gap = candidates[1].score - candidates[0].score;
  return gap < Math.max(AMBIGUITY_SCORE_GAP, candidates[0].score * AMBIGUITY_RATIO);
}

function isHighConfidenceFittingMatch(
  candidates: ConnectionRepairCandidate[],
  target: ConnectionFittingTarget,
  scale?: ConnectionRepairScale,
) {
  if (!candidates.length || isAmbiguous(candidates)) return false;
  const candidate = candidates[0];
  if (
    candidate.directionErrorDegrees != null &&
    candidate.directionErrorDegrees > HIGH_CONFIDENCE_DIRECTION_DEGREES
  ) return false;
  if (candidate.alignmentErrorDegrees > HIGH_CONFIDENCE_ALIGNMENT_DEGREES) return false;
  if (candidate.distance > repairLimit(target, scale) * (2 / 3)) return false;
  if (candidate.sizeMatch === false) return false;
  const hasPlanSignal = candidate.directionErrorDegrees != null || candidate.sizeMatch != null;
  return hasPlanSignal || candidate.distance <= 16;
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
  scale?: ConnectionRepairScale;
}): ConnectionRepairPlan {
  const { systemId } = input;
  const runs = input.runs.filter((run) => run.systemId === systemId);
  const targets = input.targets.filter((target) => target.systemId === systemId);
  const choices = input.choices || {};
  const scale = input.scale;
  const fingerprint = repairFingerprint(systemId, runs, targets, scale);

  const savedByTarget = new Map<string, ConnectionRepairCandidate>();
  const claims = new Map<string, string[]>();
  for (const target of targets) {
    const candidate = savedCandidate(runs, target, scale);
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
        reason: target.kind === "fitting"
          ? "The saved T Branch run is missing or belongs to another sheet, system, or duct type."
          : !target.savedEnd
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
      if (!hasVerifiedScale(scale, target.page)) {
        return {
          ...base,
          status: "blocked",
          reason: "Verify this sheet's scale before moving the saved run endpoint.",
          saved,
          candidates: [savedMatch],
        };
      }
      if (savedMatch.distance > repairLimit(target, scale)) {
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
          ? "The saved run end can snap back to this exact T Branch port."
          : "The saved run end can snap back without moving the placed object.",
        saved,
        candidates: [savedMatch],
        candidate: savedMatch,
      };
    }

    const candidates = candidateList(runs, target, reservedEndpoints, scale);
    if (!candidates.length) {
      return {
        ...base,
        status: "blocked",
        reason: target.kind === "fitting"
          ? "No unused supply-run endpoint matches this port on the same sheet and system."
          : "No unused matching run end is close enough.",
        saved,
        candidates,
      };
    }
    if (!hasVerifiedScale(scale, target.page)) {
      return {
        ...base,
        status: "blocked",
        reason: "Verify this sheet's scale before the assistant moves a run endpoint.",
        saved,
        candidates,
      };
    }
    const chosen = candidates.find((candidate) => candidate.id === choices[target.id]);
    if (chosen) {
      return {
        ...base,
        status: "ready",
        reason: `You chose this unused run end: ${chosen.explanation}.`,
        saved,
        candidates,
        candidate: chosen,
      };
    }
    if (isAmbiguous(candidates)) {
      return {
        ...base,
        status: "choice",
        reason: "Nearby run ends score similarly. Choose the correct endpoint on the plan.",
        saved,
        candidates,
      };
    }
    if (target.kind === "device") {
      return {
        ...base,
        status: "choice",
        reason: `Choose the correct unused run end before connecting this placed object: ${candidates[0].explanation}.`,
        saved,
        candidates,
      };
    }
    if (target.kind === "fitting" && !isHighConfidenceFittingMatch(candidates, target, scale)) {
      return {
        ...base,
        status: "choice",
        reason: `A nearby unused run end was found, but its fit needs review: ${candidates[0].explanation}.`,
        saved,
        candidates,
      };
    }
    return {
      ...base,
      status: "ready",
      reason: target.kind === "fitting"
        ? `High-confidence existing-run match: ${candidates[0].explanation}.`
        : `One unused matching run end is nearby: ${candidates[0].explanation}.`,
      saved,
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
    version: "connection-repair-v123.0",
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
