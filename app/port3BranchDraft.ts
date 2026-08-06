export type Port3Point = {
  x: number;
  y: number;
};

export type Port3BranchDraftState = {
  fittingId: string;
  branchSize: string;
  page: number;
  systemId: string;
  anchor: Port3Point;
  origin?: "existing-fitting" | "direct-placement";
  networkKind?: "supply" | "return";
};

export function port3UndoDisposition({
  draftPointCount,
  origin,
}: {
  draftPointCount: number;
  origin?: Port3BranchDraftState["origin"];
}): "history" | "leave-port-open" | "trim-route" {
  if (draftPointCount === 0) return "history";
  if (draftPointCount === 1 && origin === "direct-placement") return "history";
  if (draftPointCount === 1) return "leave-port-open";
  return "trim-route";
}

type Port3Fitting = {
  upstreamSize: string;
  downstreamSize: string;
  branchSize: string;
  connectedIds: string[];
};

export type Port3ConnectableDrawing = {
  id: string;
  type?: string;
  points: Port3Point[];
  size: string;
  page: number;
  systemId?: string;
  fitting?: Port3Fitting;
};

export type Port3BranchCommitResult<T> =
  | {
      ok: true;
      drawings: T[];
      fittingId: string;
      runId: string;
    }
  | {
      ok: false;
      reason:
        | "missing-fitting"
        | "occupied-port"
        | "wrong-context"
        | "no-route"
        | "detached-anchor";
    };

export function branchLeavesTrunkAtClearAngle(
  trunkAngle: number,
  branchAngle: number,
) {
  const divergence = Math.abs(Math.atan2(
    Math.sin(branchAngle - trunkAngle),
    Math.cos(branchAngle - trunkAngle),
  ));
  return Math.min(divergence, Math.PI - divergence) >= 0.12;
}

export function commitPort3Branch<T extends Port3ConnectableDrawing>({
  drawings,
  draft,
  run,
}: {
  drawings: T[];
  draft: Port3BranchDraftState;
  run: T;
}): Port3BranchCommitResult<T> {
  if (run.points.length < 2) return { ok: false, reason: "no-route" };
  if (
    Math.hypot(
      run.points[0].x - draft.anchor.x,
      run.points[0].y - draft.anchor.y,
    ) > 0.5
  ) {
    return { ok: false, reason: "detached-anchor" };
  }
  const fitting = drawings.find((drawing) => drawing.id === draft.fittingId);
  if (!fitting?.fitting) return { ok: false, reason: "missing-fitting" };
  if (
    fitting.page !== draft.page ||
    fitting.systemId !== draft.systemId ||
    run.page !== draft.page ||
    run.systemId !== draft.systemId ||
    (draft.networkKind != null && run.type !== draft.networkKind)
  ) {
    return { ok: false, reason: "wrong-context" };
  }
  if (fitting.fitting.connectedIds[2]) {
    return { ok: false, reason: "occupied-port" };
  }
  const next = drawings.map((drawing) => {
    if (drawing.id !== fitting.id || !drawing.fitting) return drawing;
    const connectedIds = [...drawing.fitting.connectedIds];
    connectedIds[2] = run.id;
    const fittingMeta = {
      ...drawing.fitting,
      branchSize: draft.branchSize,
      connectedIds,
    };
    return {
      ...drawing,
      size: `${fittingMeta.upstreamSize}×${fittingMeta.downstreamSize}×${fittingMeta.branchSize}`,
      fitting: fittingMeta,
    } as T;
  });
  return {
    ok: true,
    drawings: [...next, run],
    fittingId: fitting.id,
    runId: run.id,
  };
}
