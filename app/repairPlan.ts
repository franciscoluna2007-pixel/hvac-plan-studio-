import type { MarkupRecommendation } from "./markupAssistant";
import type { TakeoffImpact } from "./takeoffIntelligence";

export const ASSISTANT_REPAIR_VERSION = "guided-repair-v115.0";

export type RepairAutonomyMode = "inspect" | "prepare" | "guided";
export type RepairActionKind =
  | "terminal-cfm"
  | "run-size"
  | "branch-junction"
  | "manual-follow-up";
export type RepairActionReadiness = "ready" | "needs-input" | "confirm-on-plan" | "manual";

type RepairActionBase = {
  id: string;
  kind: RepairActionKind;
  title: string;
  location: string;
  detail: string;
  evidenceFingerprint: string;
  evidence: string[];
  objectIds: string[];
  readiness: RepairActionReadiness;
  blocker?: string;
  selectedByDefault: boolean;
};

export type TerminalCfmRepairAction = RepairActionBase & {
  kind: "terminal-cfm";
  drawingId: string;
  currentCfm: number;
  proposedCfm: number;
  cfmSource: "room-target";
};

export type RunSizeRepairAction = RepairActionBase & {
  kind: "run-size";
  drawingId: string;
  currentSize: string;
  proposedSize: string;
  cfm: number;
  cfmSource: "manual" | "terminal-linked" | "room-target";
  airflowReviewed: boolean;
  roomTargetReviewFingerprint?: string;
  currentVelocityFpm: number;
  proposedVelocityFpm: number;
  velocityLimitFpm: number;
  affectedFittingIds: string[];
  affectedConnectedRunIds: string[];
  planningEstimate: boolean;
  requiresPlanningOverride: boolean;
};

export type BranchJunctionRepairAction = RepairActionBase & {
  kind: "branch-junction";
  mainRunId: string;
  branchRunId: string;
  style: "wye45" | "tee90";
};

export type ManualFollowUpRepairAction = RepairActionBase & {
  kind: "manual-follow-up";
  recommendationId: string;
  drawingId?: string;
};

export type RepairPlanAction =
  | TerminalCfmRepairAction
  | RunSizeRepairAction
  | BranchJunctionRepairAction
  | ManualFollowUpRepairAction;

export type RepairPlan = {
  id: string;
  version: typeof ASSISTANT_REPAIR_VERSION;
  systemId: string;
  evidenceFingerprint: string;
  createdAt: string;
  actions: RepairPlanAction[];
  readyCount: number;
  needsInputCount: number;
  planConfirmationCount: number;
  manualCount: number;
  selectedByDefault: string[];
  headline: string;
  planningNotice: string;
};

export type RepairBatchRecord = {
  id: string;
  cloudBatchId?: string;
  repairPlanId: string;
  systemId: string;
  repairVersion: string;
  evidenceFingerprint: string;
  beforeDrawingFingerprint: string;
  afterDrawingFingerprint: string;
  autonomyMode: RepairAutonomyMode;
  actionIds: string[];
  actions: Array<{
    id: string;
    kind: RepairActionKind;
    title: string;
    detail: string;
    objectIds: string[];
    evidenceFingerprint: string;
  }>;
  takeoffImpact: TakeoffImpact;
  reviewer: string;
  note: string;
  planningOverrideAcknowledged: boolean;
  createdAt: string;
  reversedAt?: string;
  cloudSync: "local" | "synced" | "pending";
};

export type RepairPlanCfmCandidate = {
  id: string;
  drawingId: string;
  room: string;
  label: string;
  current: number;
  proposed: number;
  connected: boolean;
};

export type RepairPlanSizeCandidate = {
  id: string;
  type: "supply" | "return" | "fresh";
  room: string;
  current: string;
  recommended: string;
  cfm: number;
  currentVelocity: number;
  velocity: number;
  limit: number;
  airflowSource: "manual" | "terminal-linked" | "room-target";
  airflowReviewed: boolean;
  airflowEvidence?: string[];
  roomTargetReviewFingerprint?: string;
  equipmentRooted: boolean;
  applyEligible: boolean;
  overCapacity: boolean;
  affectedFittingIds?: string[];
  affectedConnectedRunIds?: string[];
  reasonCodes?: string[];
};

export type RepairPlanBranchCandidate = {
  id: string;
  mainRunId: string;
  branchRunId: string;
  style: "wye45" | "tee90";
  parentSize: string;
  evidenceFingerprint: string;
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function sourceLabel(source: RunSizeRepairAction["cfmSource"]) {
  if (source === "room-target") return "Saved room target";
  if (source === "manual") return "Manual run CFM";
  return "Traced from connected terminals";
}

export function buildRepairPlan(input: {
  systemId: string;
  evidenceFingerprint: string;
  createdAt?: string;
  recommendations: MarkupRecommendation[];
  cfmCandidates: RepairPlanCfmCandidate[];
  roomTargetsReviewed: boolean;
  sizeCandidates: RepairPlanSizeCandidate[];
  branchCandidates: RepairPlanBranchCandidate[];
  scaleVerified: boolean;
}): RepairPlan {
  const createdAt = input.createdAt || "evidence-current";
  const actions: RepairPlanAction[] = [];
  const representedRecommendationIds = new Set<string>();
  const readyCfm = input.cfmCandidates.filter((candidate) =>
    input.roomTargetsReviewed && candidate.connected && candidate.proposed > 0
  );

  [...input.cfmCandidates]
    .sort((left, right) => left.room.localeCompare(right.room) || left.drawingId.localeCompare(right.drawingId))
    .forEach((candidate) => {
      const ready = input.roomTargetsReviewed && candidate.connected && candidate.proposed > 0;
      actions.push({
        id: `repair-cfm-${candidate.drawingId}`,
        kind: "terminal-cfm",
        title: `${candidate.label} airflow`,
        location: candidate.room,
        detail: `${candidate.current || 0} → ${candidate.proposed} CFM`,
        evidenceFingerprint: `${input.evidenceFingerprint}:cfm:${candidate.id}:${candidate.current}:${candidate.proposed}`,
        evidence: [
          ready ? "Saved room target" : "Room target not ready",
          candidate.connected ? "Equipment-rooted terminal" : "Terminal is disconnected",
          "CFM is not derived from duct diameter",
        ],
        objectIds: [candidate.drawingId],
        readiness: ready ? "ready" : "needs-input",
        blocker: !input.roomTargetsReviewed
          ? "Save the room targets as reviewed before applying terminal airflow."
          : !candidate.connected
            ? "Connect this terminal to its equipment network first."
            : candidate.proposed <= 0
              ? "Enter a positive room airflow target."
              : undefined,
        selectedByDefault: ready,
        drawingId: candidate.drawingId,
        currentCfm: candidate.current,
        proposedCfm: candidate.proposed,
        cfmSource: "room-target",
      });
    });

  [...input.sizeCandidates]
    .sort((left, right) => left.type.localeCompare(right.type) || left.room.localeCompare(right.room) || left.id.localeCompare(right.id))
    .forEach((candidate) => {
      const airflowReady =
        candidate.cfm > 0 &&
        candidate.equipmentRooted &&
        candidate.airflowReviewed;
      const blockedByPendingCfm = readyCfm.length > 0;
      const ready =
        airflowReady &&
        candidate.applyEligible &&
        !candidate.overCapacity &&
        !blockedByPendingCfm;
      const blocker = blockedByPendingCfm
        ? "Apply the reviewed terminal CFM first, then rebuild the repair plan so sizing uses the new network airflow."
        : !candidate.equipmentRooted
          ? "Automatic network sizing requires an equipment-rooted connected path."
          : !candidate.airflowReviewed
            ? "The governing airflow includes a planning seed or a room target whose review fingerprint is no longer current."
          : !candidate.cfm
            ? "No reviewed airflow is available. Duct size will not be used to invent CFM."
            : candidate.overCapacity
              ? "No flex size at or below the project maximum passes the selected velocity limit."
              : !candidate.applyEligible
                ? "This airflow source is not eligible for an applied sizing change."
                : undefined;
      actions.push({
        id: `repair-size-${candidate.id}`,
        kind: "run-size",
        title: `${candidate.type === "supply" ? "Supply" : candidate.type === "return" ? "Return" : "Fresh-air"} run size`,
        location: candidate.room,
        detail: `${candidate.current}″ → ${candidate.recommended}″ · ${candidate.currentVelocity} → ${candidate.velocity} FPM${
          candidate.affectedConnectedRunIds?.length
            ? ` · aligns ${candidate.affectedConnectedRunIds.length} connected run endpoint${candidate.affectedConnectedRunIds.length === 1 ? "" : "s"} to resized fitting ports`
            : ""
        }`,
        evidenceFingerprint: `${input.evidenceFingerprint}:size:${candidate.id}:${candidate.current}:${candidate.recommended}:${candidate.cfm}:${candidate.airflowSource}:${candidate.airflowReviewed}:${candidate.roomTargetReviewFingerprint || "none"}:${[...(candidate.reasonCodes || [])].sort().join(",")}`,
        evidence: [
          `${candidate.cfm} CFM · ${sourceLabel(candidate.airflowSource)}`,
          ...(candidate.airflowEvidence || []),
          ...(candidate.roomTargetReviewFingerprint
            ? [`Room-target review ${candidate.roomTargetReviewFingerprint.toUpperCase()}`]
            : []),
          `${candidate.limit} FPM project limit`,
          input.scaleVerified ? "Verified plan scale" : "Scale unverified · velocity-screened planning result",
          "16″ residential flex maximum · project policy",
          candidate.reasonCodes?.includes("PRESSURE_EVIDENCE_MISSING")
            ? "OEM ESP, component losses, and critical-path effective length are not verified"
            : "Pressure basis supplied",
        ],
        objectIds: [
          candidate.id,
          ...(candidate.affectedFittingIds || []),
          ...(candidate.affectedConnectedRunIds || []),
        ],
        readiness: ready ? "ready" : "needs-input",
        blocker,
        selectedByDefault: ready,
        drawingId: candidate.id,
        currentSize: candidate.current,
        proposedSize: candidate.recommended,
        cfm: candidate.cfm,
        cfmSource: candidate.airflowSource,
        airflowReviewed: candidate.airflowReviewed,
        roomTargetReviewFingerprint: candidate.roomTargetReviewFingerprint,
        currentVelocityFpm: candidate.currentVelocity,
        proposedVelocityFpm: candidate.velocity,
        velocityLimitFpm: candidate.limit,
        affectedFittingIds: candidate.affectedFittingIds || [],
        affectedConnectedRunIds: candidate.affectedConnectedRunIds || [],
        planningEstimate: true,
        requiresPlanningOverride: candidate.reasonCodes?.includes("PRESSURE_EVIDENCE_MISSING") ?? true,
      });
    });

  [...input.branchCandidates]
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((candidate, index) => {
      const recommendation = input.recommendations.find((row) =>
        row.preview?.kind === "branch-junction" &&
        row.preview.mainRunId === candidate.mainRunId &&
        row.preview.branchRunId === candidate.branchRunId
      );
      if (recommendation) representedRecommendationIds.add(recommendation.id);
      actions.push({
        id: `repair-branch-${candidate.id}`,
        kind: "branch-junction",
        title: `${candidate.style === "wye45" ? "45° wye" : "90° tee"} opportunity ${index + 1}`,
        location: `${candidate.parentSize}″ parent run`,
        detail: "The existing runs align for a fitting proposal. Placement still requires confirmation on the plan.",
        evidenceFingerprint: candidate.evidenceFingerprint,
        evidence: ["Two existing supply runs", "Same system and sheet", "Fixed plan-space proximity check"],
        objectIds: [candidate.mainRunId, candidate.branchRunId],
        readiness: "confirm-on-plan",
        blocker: "Adding a fitting changes plan topology and must be confirmed at the highlighted junction.",
        selectedByDefault: false,
        mainRunId: candidate.mainRunId,
        branchRunId: candidate.branchRunId,
        style: candidate.style,
      });
    });

  input.recommendations
    .filter((recommendation) =>
      !recommendation.resolved &&
      !representedRecommendationIds.has(recommendation.id)
    )
    .sort((left, right) => left.severity.localeCompare(right.severity) || left.title.localeCompare(right.title))
    .forEach((recommendation) => {
      actions.push({
        id: `repair-follow-up-${recommendation.id}`,
        kind: "manual-follow-up",
        title: recommendation.title,
        location: recommendation.category,
        detail: recommendation.proposedAction,
        evidenceFingerprint: recommendation.evidenceFingerprint,
        evidence: recommendation.evidence,
        objectIds: recommendation.drawingId ? [recommendation.drawingId] : [],
        readiness: "manual",
        blocker: recommendation.category === "Return paths"
          ? "Confirm a dedicated return, transfer grille, jump duct, or approved door-undercut strategy before drawing a route."
          : "This repair changes geometry, topology, or a professional review decision and needs a person.",
        selectedByDefault: false,
        recommendationId: recommendation.id,
        drawingId: recommendation.drawingId,
      });
    });

  const readinessRank: Record<RepairActionReadiness, number> = {
    ready: 0,
    "needs-input": 1,
    "confirm-on-plan": 2,
    manual: 3,
  };
  actions.sort((left, right) =>
    readinessRank[left.readiness] - readinessRank[right.readiness] ||
    left.location.localeCompare(right.location) ||
    left.title.localeCompare(right.title)
  );

  const readyCount = actions.filter((action) => action.readiness === "ready").length;
  const needsInputCount = actions.filter((action) => action.readiness === "needs-input").length;
  const planConfirmationCount = actions.filter((action) => action.readiness === "confirm-on-plan").length;
  const manualCount = actions.filter((action) => action.readiness === "manual").length;
  const id = `repair-plan-${stableHash(`${input.systemId}|${input.evidenceFingerprint}|${actions.map((action) => action.evidenceFingerprint).join("|")}`)}`;
  return {
    id,
    version: ASSISTANT_REPAIR_VERSION,
    systemId: input.systemId,
    evidenceFingerprint: input.evidenceFingerprint,
    createdAt,
    actions,
    readyCount,
    needsInputCount,
    planConfirmationCount,
    manualCount,
    selectedByDefault: actions.filter((action) => action.selectedByDefault).map((action) => action.id),
    headline: readyCount
      ? `${readyCount} reviewed repair${readyCount === 1 ? "" : "s"} can be applied in one Undo`
      : needsInputCount
        ? `${needsInputCount} repair${needsInputCount === 1 ? "" : "s"} need one more input`
        : planConfirmationCount
          ? `${planConfirmationCount} plan change${planConfirmationCount === 1 ? "" : "s"} ready for confirmation`
          : "No automatic repair is ready",
    planningNotice: "Planning estimate—not a Manual J, Manual S, Manual D, permit calculation, TAB report, or manufacturer selection.",
  };
}

export function repairPlanIsStale(plan: RepairPlan, evidenceFingerprint: string) {
  return plan.evidenceFingerprint !== evidenceFingerprint;
}

export function selectedReadyActions(plan: RepairPlan, actionIds: string[]) {
  const selected = new Set(actionIds);
  return plan.actions.filter((action) => selected.has(action.id) && action.readiness === "ready");
}
