import type { MarkupRecommendation } from "./markupAssistant";
import type { RunNumberCandidate } from "./assistantRunDetails";
import type { TakeoffImpact } from "./takeoffIntelligence";

export const ASSISTANT_REPAIR_VERSION = "markup-fixes-v123.0";

export type RepairAutonomyMode = "inspect" | "prepare" | "guided";
export type RepairActionKind =
  | "terminal-cfm"
  | "run-size"
  | "run-number"
  | "branch-junction"
  | "manual-follow-up";
export type RepairActionReadiness = "ready" | "needs-input" | "confirm-on-plan" | "manual";
export type RepairActionPriority = "do-first" | "next" | "later";
export type RepairActionStage = "connections" | "airflow" | "sizes" | "metadata" | "manual";
export type RepairChange = {
  objectId: string;
  field: string;
  before: string;
  after: string;
};

type RepairActionBase = {
  id: string;
  kind: RepairActionKind;
  recommendationId?: string;
  title: string;
  location: string;
  detail: string;
  problem: string;
  proposedFix: string;
  expectedResult: string;
  nextStepLabel: string;
  evidenceFingerprint: string;
  evidence: string[];
  objectIds: string[];
  readiness: RepairActionReadiness;
  blocker?: string;
  selectedByDefault: boolean;
  priority: RepairActionPriority;
  priorityReason: string;
  stage: RepairActionStage;
  safeForBatch: boolean;
  changeScope: string;
  geometryChanges: boolean;
  changes: RepairChange[];
};

export type TerminalCfmRepairAction = RepairActionBase & {
  kind: "terminal-cfm";
  drawingId: string;
  currentCfm: number;
  currentCfmSource: "planning-seed" | "manual" | "room-target" | "unset";
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

export type RunNumberRepairAction = RepairActionBase & {
  kind: "run-number";
  drawingId: string;
  currentRunNumber: string;
  proposedRunNumber: string;
  currentSize: string;
  terminalLinked: true;
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
  | RunNumberRepairAction
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
    problem: string;
    proposedFix: string;
    expectedResult: string;
    objectIds: string[];
    evidenceFingerprint: string;
    priority: RepairActionPriority;
    stage: RepairActionStage;
    changeScope: string;
    geometryChanges: boolean;
    changes: RepairChange[];
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
  currentSource?: "planning-seed" | "manual" | "room-target" | "unset";
  proposed: number;
  connected: boolean;
};

export type RepairPlanSizeCandidate = {
  id: string;
  type: "supply" | "return" | "fresh";
  room: string;
  current: string;
  currentSizeReviewed?: boolean;
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
  affectedFittingChanges?: RepairChange[];
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

function sameNominalSize(left: string, right: string) {
  const leftNumber = Number.parseFloat(left);
  const rightNumber = Number.parseFloat(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber === rightNumber;
  }
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function matchingRecommendation(
  recommendations: MarkupRecommendation[],
  drawingId: string,
  categories: MarkupRecommendation["category"][],
) {
  return recommendations.find((recommendation) =>
    recommendation.drawingId === drawingId && categories.includes(recommendation.category)
  ) || recommendations.find((recommendation) =>
    !recommendation.drawingId && categories.includes(recommendation.category)
  );
}

export function buildRepairPlan(input: {
  systemId: string;
  evidenceFingerprint: string;
  createdAt?: string;
  recommendations: MarkupRecommendation[];
  cfmCandidates: RepairPlanCfmCandidate[];
  roomTargetsReviewed: boolean;
  sizeCandidates: RepairPlanSizeCandidate[];
  runNumberCandidates?: RunNumberCandidate[];
  branchCandidates: RepairPlanBranchCandidate[];
  scaleVerified: boolean;
}): RepairPlan {
  const createdAt = input.createdAt || "evidence-current";
  const actions: RepairPlanAction[] = [];
  const representedRecommendationIds = new Set<string>();
  const cfmChanges = input.cfmCandidates.filter((candidate) =>
    candidate.current !== candidate.proposed ||
    candidate.currentSource !== "room-target"
  );
  const readyCfm = cfmChanges.filter((candidate) =>
    input.roomTargetsReviewed && candidate.connected && candidate.proposed > 0
  );

  [...cfmChanges]
    .sort((left, right) => left.room.localeCompare(right.room) || left.drawingId.localeCompare(right.drawingId))
    .forEach((candidate) => {
      const ready = input.roomTargetsReviewed && candidate.connected && candidate.proposed > 0;
      const valueChanges = candidate.current !== candidate.proposed;
      const sourceChanges = candidate.currentSource !== "room-target";
      const recommendation = matchingRecommendation(input.recommendations, candidate.drawingId, ["Airflow"]);
      if (recommendation) representedRecommendationIds.add(recommendation.id);
      actions.push({
        id: `repair-cfm-${candidate.drawingId}`,
        kind: "terminal-cfm",
        recommendationId: recommendation?.id,
        title: `${candidate.label} airflow`,
        location: candidate.room,
        detail: valueChanges
          ? `${candidate.current || 0} → ${candidate.proposed} CFM`
          : `${candidate.proposed} CFM · mark as reviewed room-target airflow`,
        problem: valueChanges
          ? `${candidate.label} is set to ${candidate.current || 0} CFM, but the reviewed ${candidate.room} target calls for ${candidate.proposed} CFM.`
          : `${candidate.label} matches the ${candidate.proposed} CFM room target numerically, but its airflow source is not the current reviewed room target.`,
        proposedFix: valueChanges
          ? `Set only this terminal to ${candidate.proposed} CFM from the reviewed room target.`
          : `Keep ${candidate.proposed} CFM and change only its source to the reviewed room target.`,
        expectedResult: "The connected network recalculates from reviewed terminal airflow. Duct sizing remains a separate review step.",
        nextStepLabel: ready ? "Add this airflow fix" : !input.roomTargetsReviewed
          ? "Review room CFM"
          : !candidate.connected
            ? "Repair the connection"
            : "Enter room CFM",
        evidenceFingerprint: `${input.evidenceFingerprint}:cfm:${candidate.id}:${candidate.current}:${candidate.currentSource || "unset"}:${candidate.proposed}`,
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
        selectedByDefault: false,
        priority: recommendation?.priorityTier || "do-first",
        priorityReason: recommendation?.priorityReason || "Reviewed terminal airflow unlocks the connected sizing pass.",
        stage: "airflow",
        safeForBatch: ready,
        changeScope: "Changes only this terminal's reviewed airflow value or source. It does not move or resize a route.",
        geometryChanges: false,
        changes: [...(valueChanges ? [{
          objectId: candidate.drawingId,
          field: "CFM",
          before: `${candidate.current || 0} CFM`,
          after: `${candidate.proposed} CFM`,
        }] : []), ...(sourceChanges ? [{
          objectId: candidate.drawingId,
          field: "CFM source",
          before: candidate.currentSource === "room-target"
            ? "Reviewed room target"
            : candidate.currentSource === "manual"
              ? "Manual"
              : candidate.currentSource === "planning-seed"
                ? "Planning seed"
                : "Not set",
          after: "Reviewed room target",
        }] : [])],
        drawingId: candidate.drawingId,
        currentCfm: candidate.current,
        currentCfmSource: candidate.currentSource || "unset",
        proposedCfm: candidate.proposed,
        cfmSource: "room-target",
      });
    });

  [...input.sizeCandidates]
    .filter((candidate) => !sameNominalSize(candidate.current, candidate.recommended))
    .sort((left, right) => left.type.localeCompare(right.type) || left.room.localeCompare(right.room) || left.id.localeCompare(right.id))
    .forEach((candidate) => {
      const airflowReady =
        candidate.cfm > 0 &&
        candidate.equipmentRooted &&
        candidate.airflowReviewed;
      const blockedByPendingCfm = readyCfm.length > 0;
      const ready =
        airflowReady &&
        input.scaleVerified &&
        candidate.applyEligible &&
        !candidate.overCapacity &&
        !blockedByPendingCfm;
      const blocker = blockedByPendingCfm
        ? "Apply the reviewed terminal CFM first, then rebuild the repair plan so sizing uses the new network airflow."
        : !input.scaleVerified
          ? "Confirm the affected sheet scale before applying a size or showing purchasing quantities."
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
      const recommendation = matchingRecommendation(input.recommendations, candidate.id, ["Duct sizing"]);
      if (recommendation) representedRecommendationIds.add(recommendation.id);
      actions.push({
        id: `repair-size-${candidate.id}`,
        kind: "run-size",
        recommendationId: recommendation?.id,
        title: `${candidate.type === "supply" ? "Supply" : candidate.type === "return" ? "Return" : "Fresh-air"} run size`,
        location: candidate.room,
        detail: `${candidate.current}″ → ${candidate.recommended}″ · ${candidate.currentVelocity} → ${candidate.velocity} FPM · route points unchanged`,
        problem: `${candidate.current}" ${candidate.type} run carries ${candidate.cfm} reviewed CFM at approximately ${candidate.currentVelocity} FPM against the ${candidate.limit} FPM project limit.`,
        proposedFix: `Resize this run to ${candidate.recommended}" and update only the ${candidate.affectedFittingIds?.length || 0} listed fitting size label${candidate.affectedFittingIds?.length === 1 ? "" : "s"}. Route points do not move.`,
        expectedResult: `The velocity screen changes from approximately ${candidate.currentVelocity} to ${candidate.velocity} FPM. Pressure qualification and field verification remain required.`,
        nextStepLabel: ready ? "Add this size fix" : "Open sizing inputs",
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
        objectIds: [...new Set([candidate.id, ...(candidate.affectedFittingIds || [])])],
        readiness: ready ? "ready" : "needs-input",
        blocker,
        selectedByDefault: false,
        priority: recommendation?.priorityTier || "next",
        priorityReason: recommendation?.priorityReason || "This reviewed size issue affects airflow screening and should be checked before release.",
        stage: "sizes",
        safeForBatch: ready,
        changeScope: "Changes the run and fitting size metadata, then marks the new run size for confirmation. Route points never move.",
        geometryChanges: false,
        changes: [{
          objectId: candidate.id,
          field: "Run size",
          before: `${candidate.current}"`,
          after: `${candidate.recommended}"`,
        }, ...(candidate.currentSizeReviewed === false ? [] : [{
          objectId: candidate.id,
          field: "Size review",
          before: candidate.currentSizeReviewed === true
            ? "Confirmed"
            : "Not set",
          after: "Needs confirmation",
        }]), ...(candidate.affectedFittingChanges || [])],
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

  [...(input.runNumberCandidates || [])]
    .sort((left, right) =>
      Number(left.duplicateExistingNumber) - Number(right.duplicateExistingNumber) ||
      left.page - right.page ||
      left.proposedRunNumber.localeCompare(right.proposedRunNumber)
    )
    .forEach((candidate) => {
      const recommendation = input.recommendations.find((row) => row.id === "assistant-run-details");
      if (recommendation) representedRecommendationIds.add(recommendation.id);
      const ready = !candidate.duplicateExistingNumber && !candidate.currentRunNumber;
      actions.push({
        id: `repair-run-number-${candidate.drawingId}`,
        kind: "run-number",
        recommendationId: recommendation?.id,
        title: candidate.duplicateExistingNumber
          ? `Duplicate ${candidate.currentRunNumber} label`
          : `Add ${candidate.proposedRunNumber} run number`,
        location: `${candidate.room} - sheet ${candidate.page}`,
        detail: candidate.duplicateExistingNumber
          ? `${candidate.currentRunNumber} is used by more than one terminal-linked run`
          : `Blank to ${candidate.proposedRunNumber} - ${candidate.size}" saved size`,
        problem: candidate.duplicateExistingNumber
          ? `More than one terminal-linked run uses ${candidate.currentRunNumber}.`
          : "This terminal-linked run is drawn, but its field run number is blank.",
        proposedFix: candidate.duplicateExistingNumber
          ? "Choose a unique run number in the plan inspector. Existing labels will not be silently resequenced."
          : `Fill the blank run-number field with ${candidate.proposedRunNumber}.`,
        expectedResult: candidate.duplicateExistingNumber
          ? "Each terminal leg has one unique, reviewed field label."
          : `The route is field-readable as ${candidate.proposedRunNumber}. Its size, CFM, points, and connections stay unchanged.`,
        nextStepLabel: ready ? "Add this label fix" : "Resolve duplicate on plan",
        evidenceFingerprint: `${input.evidenceFingerprint}:run-number:${candidate.evidenceFingerprint}:${candidate.currentRunNumber}:${candidate.proposedRunNumber}`,
        evidence: [
          "Terminal-linked route",
          `${candidate.type === "supply" ? "Supply flex" : "Return"} numbering sequence`,
          "Existing labels preserved",
        ],
        objectIds: [candidate.drawingId],
        readiness: ready ? "ready" : "needs-input",
        blocker: candidate.duplicateExistingNumber
          ? "Duplicate existing labels require a person to choose which run keeps the number."
          : undefined,
        selectedByDefault: false,
        priority: recommendation?.priorityTier || "next",
        priorityReason: recommendation?.priorityReason || "Complete field labels after drawing and before the material package.",
        stage: "metadata",
        safeForBatch: ready,
        changeScope: "Fills one blank run-number field only. No geometry, size, airflow, or connection changes.",
        geometryChanges: false,
        changes: ready ? [{
          objectId: candidate.drawingId,
          field: "Run number",
          before: "Blank",
          after: candidate.proposedRunNumber,
        }] : [],
        drawingId: candidate.drawingId,
        currentRunNumber: candidate.currentRunNumber,
        proposedRunNumber: candidate.proposedRunNumber,
        currentSize: candidate.size,
        terminalLinked: true,
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
        recommendationId: recommendation?.id,
        title: `${candidate.style === "wye45" ? "45° wye" : "90° tee"} opportunity ${index + 1}`,
        location: `${candidate.parentSize}″ parent run`,
        detail: "The existing runs align for a fitting proposal. Placement still requires confirmation on the plan.",
        problem: "Two existing runs align for a junction, but no confirmed fitting connects them.",
        proposedFix: `Confirm one ${candidate.style === "wye45" ? "45-degree wye" : "90-degree tee"} at the highlighted junction.`,
        expectedResult: "Only the reviewed fitting is placed between the two existing runs. No new route or branch stub is invented.",
        nextStepLabel: "Confirm T/Y on plan",
        evidenceFingerprint: candidate.evidenceFingerprint,
        evidence: ["Two existing supply runs", "Same system and sheet", "Fixed plan-space proximity check"],
        objectIds: [candidate.mainRunId, candidate.branchRunId],
        readiness: "confirm-on-plan",
        blocker: "Adding a fitting changes plan topology and must be confirmed at the highlighted junction.",
        selectedByDefault: false,
        priority: recommendation?.priorityTier || "later",
        priorityReason: recommendation?.priorityReason || "Review branch fittings after the routes are drawn and connected.",
        stage: "connections",
        safeForBatch: false,
        changeScope: "Would place one fitting only after plan confirmation. It does not invent a branch route.",
        geometryChanges: true,
        changes: [],
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
        problem: recommendation.detail,
        proposedFix: recommendation.proposedAction,
        expectedResult: recommendation.severity === "critical"
          ? "The blocking condition is corrected on the drawing before release."
          : "The condition is corrected or resolved through a named review decision.",
        nextStepLabel: recommendation.action === "sizing-review"
          ? "Open airflow and duct sizes"
          : recommendation.drawingId
            ? "Inspect and fix on plan"
            : "Open decision record",
        evidenceFingerprint: recommendation.evidenceFingerprint,
        evidence: recommendation.evidence,
        objectIds: recommendation.drawingId ? [recommendation.drawingId] : [],
        readiness: "manual",
        blocker: recommendation.category === "Return paths"
          ? "Confirm a dedicated return, transfer grille, jump duct, or approved door-undercut strategy before drawing a route."
          : "This repair changes geometry, topology, or a professional review decision and needs a person.",
        selectedByDefault: false,
        priority: recommendation.priorityTier,
        priorityReason: recommendation.priorityReason,
        stage: "manual",
        safeForBatch: false,
        changeScope: recommendation.category === "Return paths"
          ? "No route is created. Choose and document the return-air strategy first."
          : "No automatic change. A person must make or document this plan decision.",
        geometryChanges: recommendation.category !== "Coordination",
        changes: [],
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
  const priorityRank: Record<RepairActionPriority, number> = {
    "do-first": 0,
    next: 1,
    later: 2,
  };
  actions.sort((left, right) =>
    priorityRank[left.priority] - priorityRank[right.priority] ||
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
      ? `${readyCount} safe fix${readyCount === 1 ? "" : "es"} ready for review`
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

export function validateRepairSelection(plan: RepairPlan, actionIds: string[]) {
  const selected = new Set(actionIds);
  const actions = plan.actions.filter((action) => selected.has(action.id));
  if (actions.length !== selected.size) {
    return {
      valid: false,
      reason: "One or more selected fixes are no longer in this plan.",
      actions: [] as RepairPlanAction[],
    };
  }
  if (actions.some((action) => action.readiness !== "ready" || !action.safeForBatch)) {
    return {
      valid: false,
      reason: "One or more selected fixes still need information or plan confirmation.",
      actions: [] as RepairPlanAction[],
    };
  }
  const activeStages = new Set(
    actions.filter((action) => action.stage !== "metadata").map((action) => action.stage)
  );
  if (activeStages.size > 1) {
    return {
      valid: false,
      reason: "Connection, airflow, and size fixes run as separate steps so each step can be recalculated.",
      actions: [] as RepairPlanAction[],
    };
  }
  return { valid: true, reason: "", actions };
}

export function safeStepActions(plan: RepairPlan) {
  const ready = plan.actions.filter((action) => action.readiness === "ready" && action.safeForBatch);
  const stageOrder: RepairActionStage[] = ["connections", "airflow", "sizes"];
  const activeStage = stageOrder.find((stage) => ready.some((action) => action.stage === stage));
  return ready.filter((action) => action.stage === "metadata" || !activeStage || action.stage === activeStage);
}
