"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Crosshair,
  DraftingCompass,
  Eye,
  EyeOff,
  FileSearch,
  Gauge,
  History,
  ListChecks,
  RefreshCw,
  Route,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { AdvancedPlanIntelligence } from "./advancedPlanIntelligence";
import type { AssistantSuggestionLayer } from "./assistantSuggestionLayer";
import type { DesignStandardProfile, DesignStandardRuleLevel } from "./designStandard";
import type { ConnectionRepairItem } from "./connectionRepair";
import type { MarkupAssistantSummary, MarkupRecommendation } from "./markupAssistant";
import type {
  RepairAutonomyMode,
  RepairBatchRecord,
  RepairPlan,
  RepairPlanAction,
} from "./repairPlan";
import { safeStepActions, validateRepairSelection } from "./repairPlan";
import type { PlanFactStatus, PlanScaleCandidate, SmartPlanSetup } from "./planSetup";
import type { TakeoffImpact } from "./takeoffIntelligence";

type RecommendationFilter = "do-first" | "can-fix" | "needs-answer" | "all";
type AssistantView = "setup" | "recommendations" | "standards" | "repair-plan" | "history" | "evidence";

export type PlanHelperPrimaryView = "setup" | "fix-plan" | "problems" | "fixes";

const PRIMARY_VIEW_ORDER: AssistantView[] = ["setup", "repair-plan"];
const PRIMARY_VIEW_GRID_STYLE = { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" };
const showLegacyRepairPlan = false;

function assistantViewForPrimaryView(view: PlanHelperPrimaryView = "setup"): AssistantView {
  if (view !== "setup") return "repair-plan";
  return "setup";
}

type Props = {
  open: boolean;
  initialView?: PlanHelperPrimaryView;
  projectName: string;
  systemName: string;
  recommendations: MarkupRecommendation[];
  summary: MarkupAssistantSummary;
  repairPlan: RepairPlan;
  autonomyMode: RepairAutonomyMode;
  selectedActionIds: string[];
  preparedEvidenceFingerprint: string;
  preparedRepairPlanId: string;
  repairRecords: RepairBatchRecord[];
  takeoffImpact: TakeoffImpact;
  advancedIntelligence: AdvancedPlanIntelligence | null;
  smartSetup: SmartPlanSetup | null;
  suggestionLayer: AssistantSuggestionLayer;
  suggestionLayerVisible: boolean;
  connectionRepairItems: ConnectionRepairItem[];
  connectionRepairFingerprint: string;
  connectionCandidateChoices: Record<string, string>;
  scaleVerified: boolean;
  confirmedScaleByPage: Record<string, string>;
  onUseDetectedScale: (candidate: PlanScaleCandidate, page: number) => void;
  onStartCalibration: (page: number) => void;
  designStandard: DesignStandardProfile;
  canUndo: boolean;
  onClose: () => void;
  onFocusDrawing: (drawingId: string) => void;
  onOpenManualReview: (recommendation: MarkupRecommendation) => void;
  onOpenSizingReview: () => void;
  onActiveRecommendationChange: (recommendation?: MarkupRecommendation) => void;
  onApplyRecommendation: (recommendation: MarkupRecommendation) => void;
  onAutonomyModeChange: (mode: RepairAutonomyMode) => void;
  onSelectedActionIdsChange: (ids: string[]) => void;
  onPrepareRepairPlan: () => void;
  onApplyRepairPlan: (input: {
    actionIds: string[];
    evidenceFingerprint: string;
    reviewer: string;
    note: string;
    planningOverrideAcknowledged: boolean;
  }) => boolean | Promise<boolean>;
  onUndoRepairBatch: () => void;
  onSuggestionLayerVisibleChange: (visible: boolean) => void;
  onChooseConnectionCandidate: (itemId: string, candidateId: string) => void;
  onApplyConnectionRepair: (itemId: string, evidenceFingerprint: string) => boolean;
  onFocusConnectionRepair: (itemId: string) => void;
  onShowPlanSetupSource: (page: number, region?: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageWidth: number;
    pageHeight: number;
    coordinateSpace: "viewport-points" | "pdf-points";
  }) => void;
};

function confidenceLabel(value: number) {
  if (value >= .95) return "Very high";
  if (value >= .88) return "High";
  if (value >= .78) return "Moderate";
  return "Review";
}

function readinessLabel(action: RepairPlanAction) {
  if (action.readiness === "ready" && action.kind === "run-size" && action.requiresPlanningOverride) {
    return "ELIGIBLE WITH PLANNING OVERRIDE";
  }
  if (action.readiness === "ready") return "READY TO APPLY";
  if (action.readiness === "needs-input") return "NEEDS ONE ANSWER";
  if (action.readiness === "confirm-on-plan") return "CONFIRM ON PLAN";
  return "MANUAL FOLLOW-UP";
}

function actionIcon(action: RepairPlanAction) {
  if (action.kind === "terminal-cfm") return <Gauge size={16} />;
  if (action.kind === "run-size") return <Route size={16} />;
  if (action.kind === "run-number") return <ClipboardCheck size={16} />;
  if (action.kind === "branch-junction") return <Crosshair size={16} />;
  return <AlertTriangle size={16} />;
}

function formatFeet(value: number) {
  return `${value.toFixed(1)} ft`;
}

function priorityLabel(action: RepairPlanAction | MarkupRecommendation) {
  const priority = "priority" in action ? action.priority : action.priorityTier;
  if (priority === "do-first") return "DO FIRST";
  if (priority === "next") return "NEXT";
  return "LATER";
}

function planFactLabel(status: PlanFactStatus) {
  if (status === "verified") return "Confirmed";
  if (status === "likely") return "Found on plan";
  if (status === "estimated") return "Suggested";
  return "Not found";
}

export default function MarkupAssistantStudio({
  open,
  initialView = "setup",
  projectName,
  systemName,
  recommendations,
  summary,
  repairPlan,
  autonomyMode,
  selectedActionIds,
  preparedEvidenceFingerprint,
  preparedRepairPlanId,
  repairRecords,
  takeoffImpact,
  advancedIntelligence,
  smartSetup,
  suggestionLayer,
  suggestionLayerVisible,
  connectionRepairItems,
  connectionRepairFingerprint,
  connectionCandidateChoices,
  scaleVerified,
  confirmedScaleByPage,
  onUseDetectedScale,
  onStartCalibration,
  designStandard,
  canUndo,
  onClose,
  onFocusDrawing,
  onOpenManualReview,
  onOpenSizingReview,
  onActiveRecommendationChange,
  onApplyRecommendation,
  onAutonomyModeChange,
  onSelectedActionIdsChange,
  onPrepareRepairPlan,
  onApplyRepairPlan,
  onUndoRepairBatch,
  onSuggestionLayerVisibleChange,
  onChooseConnectionCandidate,
  onApplyConnectionRepair,
  onFocusConnectionRepair,
  onShowPlanSetupSource,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previewKeyRef = useRef("");
  const wasOpenRef = useRef(open);
  const [filter, setFilter] = useState<RecommendationFilter>("do-first");
  const [activeId, setActiveId] = useState("");
  const [view, setView] = useState<AssistantView>(() => assistantViewForPrimaryView(initialView));
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [confirmedKey, setConfirmedKey] = useState("");
  const [planningOverrideKey, setPlanningOverrideKey] = useState("");
  const [applying, setApplying] = useState(false);
  const [activeFixId, setActiveFixId] = useState("");
  const fixPlanFingerprint = `${repairPlan.id}:${connectionRepairFingerprint}`;
  const [skippedFixState, setSkippedFixState] = useState<{
    fingerprint: string;
    actionIds: string[];
  }>({ fingerprint: "", actionIds: [] });
  const skippedActionIds = useMemo(
    () => skippedFixState.fingerprint === fixPlanFingerprint
      ? skippedFixState.actionIds
      : [],
    [fixPlanFingerprint, skippedFixState],
  );
  function setSkippedActionIds(
    next: string[] | ((current: string[]) => string[]),
  ) {
    setSkippedFixState((current) => {
      const currentIds = current.fingerprint === fixPlanFingerprint
        ? current.actionIds
        : [];
      return {
        fingerprint: fixPlanFingerprint,
        actionIds: typeof next === "function" ? next(currentIds) : next,
      };
    });
  }
  const stale = Boolean(
    preparedEvidenceFingerprint &&
    (
      preparedEvidenceFingerprint !== repairPlan.evidenceFingerprint ||
      preparedRepairPlanId !== repairPlan.id
    )
  );
  const selected = useMemo(() => new Set(selectedActionIds), [selectedActionIds]);
  const readyActions = safeStepActions(repairPlan);
  const readySelected = readyActions.filter((action) =>
    action.readiness === "ready" && selected.has(action.id)
  );
  const confirmationKey = [
    repairPlan.id,
    repairPlan.evidenceFingerprint,
    readySelected.map((action) => JSON.stringify({
      id: action.id,
      kind: action.kind,
      evidenceFingerprint: action.evidenceFingerprint,
      objectIds: [...action.objectIds].sort(),
      detail: action.detail,
      problem: action.problem,
      proposedFix: action.proposedFix,
      expectedResult: action.expectedResult,
      ...(action.kind === "terminal-cfm"
        ? { currentCfm: action.currentCfm, proposedCfm: action.proposedCfm }
        : action.kind === "run-size"
          ? {
            currentSize: action.currentSize,
            proposedSize: action.proposedSize,
            cfm: action.cfm,
            cfmSource: action.cfmSource,
            airflowReviewed: action.airflowReviewed,
            roomTargetReviewFingerprint: action.roomTargetReviewFingerprint || "",
            affectedFittingIds: [...action.affectedFittingIds].sort(),
            affectedConnectedRunIds: [...action.affectedConnectedRunIds].sort(),
            requiresPlanningOverride: action.requiresPlanningOverride,
          }
          : {}),
      stage: action.stage,
      changes: action.changes,
    })).sort().join("|"),
    takeoffImpact.version,
    takeoffImpact.wastePercent,
    takeoffImpact.boxLengthFeet,
    takeoffImpact.rows.map((row) =>
      `${row.key}:${row.beforeMeasuredFeet}:${row.afterMeasuredFeet}:${row.beforeBoxes}:${row.afterBoxes}`
    ).join("|"),
  ].join(":");
  const confirmed = Boolean(readySelected.length && confirmedKey === confirmationKey);
  const requiresPlanningOverride = readySelected.some((action) =>
    action.kind === "run-size" && action.requiresPlanningOverride
  );
  const planningOverrideConfirmed = !requiresPlanningOverride || planningOverrideKey === confirmationKey;
  const repairActionsByRecommendation = useMemo(() => {
    const grouped = new Map<string, RepairPlanAction[]>();
    repairPlan.actions.forEach((action) => {
      if (!action.recommendationId) return;
      grouped.set(action.recommendationId, [
        ...(grouped.get(action.recommendationId) || []),
        action,
      ]);
    });
    return grouped;
  }, [repairPlan.actions]);
  const connectionActionById = useMemo(() =>
    new Map(connectionRepairItems.map((item) => [`connection-fix-${item.id}`, item])),
  [connectionRepairItems]);
  const connectionDisplayActions = useMemo((): RepairPlanAction[] =>
    connectionRepairItems.map((item) => {
      const candidate = item.candidate || item.candidates[0];
      const readiness = item.status === "ready"
        ? "ready" as const
        : item.status === "choice"
          ? "needs-input" as const
          : "manual" as const;
      return {
        id: `connection-fix-${item.id}`,
        kind: "manual-follow-up",
        recommendationId: `connection-${item.id}`,
        drawingId: item.drawingId,
        title: item.label,
        location: `Sheet ${item.page} · ${item.systemId}`,
        detail: item.detail,
        problem: item.reason,
        proposedFix: candidate
          ? `Move only the ${candidate.end} endpoint of ${candidate.runSize}" ${item.ductType} run ${candidate.runId} onto this saved ${item.kind === "fitting" ? "T/Y port" : "equipment or terminal connection"}.`
          : "Inspect the connection on the plan and identify the correct existing run endpoint.",
        expectedResult: candidate
          ? "The existing endpoint and saved connection agree. No route, branch stub, fitting, terminal, or new drawing object is created."
          : "The connection is resolved only after a matching existing run is identified.",
        nextStepLabel: item.status === "choice"
          ? "Choose the matching run"
          : item.status === "ready"
            ? "Connect this endpoint"
            : "Inspect on plan",
        evidenceFingerprint: `${connectionRepairFingerprint}:${item.id}:${candidate?.id || "none"}`,
        evidence: [
          item.detail,
          item.reason,
          ...(candidate?.signals || []),
        ],
        objectIds: [item.drawingId, candidate?.runId].filter((id): id is string => Boolean(id)),
        readiness,
        blocker: item.status === "choice"
          ? "More than one existing endpoint is plausible. Choose the run you recognize before applying."
          : item.status === "blocked"
            ? item.reason
            : undefined,
        selectedByDefault: false,
        priority: "do-first",
        priorityReason: "Connections are repaired first because airflow and sizing depend on a continuous saved network.",
        stage: "connections",
        safeForBatch: item.status === "ready",
        changeScope: "Moves one existing run endpoint to the reviewed saved connection and updates that connection reference only.",
        geometryChanges: true,
        changes: candidate ? [{
          objectId: candidate.runId,
          field: `${candidate.end} endpoint`,
          before: `${candidate.point.x.toFixed(1)}, ${candidate.point.y.toFixed(1)}`,
          after: `${item.targetPoint.x.toFixed(1)}, ${item.targetPoint.y.toFixed(1)}`,
        }] : [],
      };
    }),
  [connectionRepairFingerprint, connectionRepairItems]);
  const combinedFixActions = useMemo(() => [
    ...connectionDisplayActions,
    ...repairPlan.actions.filter((action) => {
      if (action.kind !== "manual-follow-up") return true;
      const recommendation = recommendations.find((row) => row.id === action.recommendationId);
      if (recommendation?.category !== "Connections") return true;
      return !connectionRepairItems.some((item) => item.drawingId === action.drawingId);
    }),
  ], [connectionDisplayActions, connectionRepairItems, recommendations, repairPlan.actions]);
  const firstFixId = combinedFixActions[0]?.id || "";
  const planFactSources = useMemo(() => {
    const sources = [
      ...(smartSetup?.scales.flatMap((scale) => scale.candidates.flatMap((candidate) => candidate.sources)) || []),
      ...(smartSetup?.rooms.flatMap((room) => room.sources) || []),
      ...(smartSetup?.equipment.flatMap((equipment) => equipment.sources) || []),
      ...(smartSetup?.systems.flatMap((system) => system.sources) || []),
      ...(smartSetup?.unassignedCeilingHeights.flatMap((height) => height.sources) || []),
    ];
    return new Map(sources.map((source) => [source.id, source]));
  }, [smartSetup]);

  const filtered = recommendations.filter((recommendation) => {
    if (recommendation.resolved) return filter === "all";
    const related = repairActionsForRecommendation(recommendation);
    if (filter === "do-first") return recommendation.priorityTier === "do-first";
    if (filter === "can-fix") return related.some((action) => action.readiness === "ready" && action.safeForBatch);
    if (filter === "needs-answer") return related.some((action) => action.readiness !== "ready");
    return true;
  });
  const active = filtered.find((recommendation) => recommendation.id === activeId) || filtered[0];
  const activeRepairActions = active ? repairActionsForRecommendation(active) : [];
  const activeRepairAction =
    activeRepairActions.find((action) => action.readiness === "ready") ||
    activeRepairActions.find((action) => action.readiness === "needs-input") ||
    activeRepairActions[0];
  const previewKey = active ? `${active.id}:${active.evidenceFingerprint}` : "";
  const skipped = useMemo(() => new Set(skippedActionIds), [skippedActionIds]);
  const visibleFixActions = combinedFixActions.filter((action) => !skipped.has(action.id));
  const activeFixAction =
    visibleFixActions.find((action) => action.id === activeFixId) ||
    visibleFixActions[0];
  const activeFixIndex = activeFixAction
    ? visibleFixActions.findIndex((action) => action.id === activeFixAction.id)
    : -1;
  const activeFixRecommendation = activeFixAction?.recommendationId
    ? recommendations.find((recommendation) => recommendation.id === activeFixAction.recommendationId)
    : undefined;
  const activeConnectionItem = activeFixAction
    ? connectionActionById.get(activeFixAction.id)
    : undefined;
  const hasDoFirstRecommendation = recommendations.some((recommendation) =>
    !recommendation.resolved && recommendation.priorityTier === "do-first"
  );
  const hasSafeRepairAction = repairPlan.actions.some((action) =>
    action.readiness === "ready" && action.safeForBatch
  );

  useEffect(() => {
    const opening = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (opening) {
      setView(assistantViewForPrimaryView(initialView));
      setFilter(
        hasDoFirstRecommendation
          ? "do-first"
          : hasSafeRepairAction
            ? "can-fix"
            : "all"
      );
    }
  }, [hasDoFirstRecommendation, hasSafeRepairAction, initialView, open]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>(".markup-assistant-close")?.focus()
    );
    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    const visibleRecommendation = view === "repair-plan"
      ? activeFixRecommendation
      : view === "recommendations"
        ? active
        : undefined;
    const nextPreviewKey = `${view}:${visibleRecommendation?.id || ""}:${visibleRecommendation?.evidenceFingerprint || ""}`;
    if (previewKeyRef.current === nextPreviewKey) return;
    previewKeyRef.current = nextPreviewKey;
    onActiveRecommendationChange(visibleRecommendation);
  }, [active, activeFixRecommendation, onActiveRecommendationChange, previewKey, view]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  function handleViewKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = PRIMARY_VIEW_ORDER.indexOf(view);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? PRIMARY_VIEW_ORDER.length - 1
        : currentIndex < 0
          ? 0
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + PRIMARY_VIEW_ORDER.length) % PRIMARY_VIEW_ORDER.length;
    const nextView = PRIMARY_VIEW_ORDER[nextIndex];
    setView(nextView);
    requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>(`#assistant-tab-${nextView}`)?.focus()
    );
  }

  function repairActionsForRecommendation(recommendation: MarkupRecommendation) {
    return repairActionsByRecommendation.get(recommendation.id) || [];
  }

  function recommendationStatus(recommendation: MarkupRecommendation) {
    if (recommendation.resolved) return "RESOLVED";
    const action = repairActionsForRecommendation(recommendation)[0];
    return action ? readinessLabel(action) : "REVIEW NEEDED";
  }

  function openRepairAction(action: RepairPlanAction, recommendation?: MarkupRecommendation) {
    if (action.readiness === "ready") {
      onAutonomyModeChange("prepare");
      const refreshNeeded = !preparedEvidenceFingerprint || stale;
      if (refreshNeeded) onPrepareRepairPlan();
      onSelectedActionIdsChange(
        refreshNeeded
          ? [action.id]
          : selected.has(action.id)
            ? selectedActionIds
            : [...selectedActionIds, action.id]
      );
      setView("repair-plan");
      return;
    }
    if (action.kind === "terminal-cfm" || action.kind === "run-size") {
      onOpenSizingReview();
      return;
    }
    if (action.kind === "branch-junction" && recommendation) {
      onApplyRecommendation(recommendation);
      return;
    }
    if (recommendation) {
      if ("drawingId" in action && action.drawingId) onFocusDrawing(action.drawingId);
      onOpenManualReview(recommendation);
    }
  }

  function chooseMode(mode: RepairAutonomyMode) {
    onAutonomyModeChange(mode);
    if (mode !== "inspect") {
      if (!preparedEvidenceFingerprint || stale) onPrepareRepairPlan();
      setView("repair-plan");
    }
  }

  function approveSingleAction(action: RepairPlanAction) {
    if (action.readiness !== "ready" || !action.safeForBatch || stale) return;
    const connectionItem = connectionActionById.get(action.id);
    if (connectionItem) {
      const applied = onApplyConnectionRepair(connectionItem.id, connectionRepairFingerprint);
      if (applied) {
        const next = visibleFixActions[activeFixIndex + 1] || visibleFixActions[activeFixIndex - 1];
        setActiveFixId(next?.id || "");
      }
      return;
    }
    const validation = validateRepairSelection(repairPlan, [action.id]);
    if (!validation.valid) return;
    onAutonomyModeChange("guided");
    if (!preparedEvidenceFingerprint || stale) onPrepareRepairPlan();
    onSelectedActionIdsChange([action.id]);
    setConfirmedKey("");
    setPlanningOverrideKey("");
    setActiveFixId(action.id);
    requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>(".fix-plan-inline-approval input")?.focus()
    );
  }

  function skipAction(action: RepairPlanAction) {
    onSelectedActionIdsChange(selectedActionIds.filter((id) => id !== action.id));
    const next = visibleFixActions[activeFixIndex + 1] || visibleFixActions[activeFixIndex - 1];
    setSkippedActionIds((current) => [...new Set([...current, action.id])]);
    setActiveFixId(next?.id || "");
  }

  function moveToFix(offset: -1 | 1) {
    if (!visibleFixActions.length) return;
    const nextIndex = (Math.max(0, activeFixIndex) + offset + visibleFixActions.length) % visibleFixActions.length;
    setActiveFixId(visibleFixActions[nextIndex].id);
    onSelectedActionIdsChange([]);
    setConfirmedKey("");
    setPlanningOverrideKey("");
  }

  function showFixOnPlan(action: RepairPlanAction) {
    const connectionItem = connectionActionById.get(action.id);
    if (connectionItem) {
      onFocusConnectionRepair(connectionItem.id);
      return;
    }
    const recommendation = action.recommendationId
      ? recommendations.find((row) => row.id === action.recommendationId)
      : undefined;
    onActiveRecommendationChange(recommendation);
    if (action.objectIds[0]) onFocusDrawing(action.objectIds[0]);
  }

  async function applySelected() {
    if (!readySelected.length || !reviewer.trim() || stale || !confirmed || !planningOverrideConfirmed || applying) return;
    setApplying(true);
    try {
      const applied = await onApplyRepairPlan({
        actionIds: readySelected.map((action) => action.id),
        evidenceFingerprint: repairPlan.evidenceFingerprint,
        reviewer: reviewer.trim(),
        note: note.trim(),
        planningOverrideAcknowledged: requiresPlanningOverride && planningOverrideConfirmed,
      });
      if (!applied) return;
      setConfirmedKey("");
      setPlanningOverrideKey("");
      setNote("");
      setView("repair-plan");
    } finally {
      setApplying(false);
    }
  }

  if (!open) return null;

  return <div className="markup-assistant-overlay" role="presentation">
    <section
      ref={panelRef}
      className="markup-assistant-studio"
      role="dialog"
      aria-modal="false"
      aria-labelledby="markup-assistant-title"
      onKeyDown={handleKeyDown}
    >
      <header className="markup-assistant-header">
        <div className="markup-assistant-brand">
          <span><Sparkles size={22} /></span>
          <div>
            <small>PLAN HELPER</small>
            <h2 id="markup-assistant-title">One place to find a problem and approve its fix.</h2>
            <p>{projectName} · {systemName}</p>
          </div>
        </div>
        <div className="markup-assistant-header-actions">
          <span><ShieldCheck size={14} /> NOTHING CHANGES WITHOUT APPROVAL</span>
          <button className="markup-assistant-close" aria-label="Close Plan Helper" onClick={onClose}><X size={20} /></button>
        </div>
      </header>

      <nav
        className="assistant-workspace-tabs"
        aria-label="Plan Helper"
        role="tablist"
        style={PRIMARY_VIEW_GRID_STYLE}
        onKeyDown={handleViewKeyDown}
      >
        {([
          ["setup", "Plan setup", smartSetup?.counts.reviewItems ?? 0],
          ["repair-plan", "Fix Plan", repairPlan.actions.length],
        ] as Array<[AssistantView, string, number]>).map(([id, label, count]) => <button
          key={id}
          id={`assistant-tab-${id}`}
          className={view === id ? "active" : ""}
          role="tab"
          aria-selected={view === id}
          aria-controls={`assistant-panel-${id}`}
          tabIndex={view === id || (!PRIMARY_VIEW_ORDER.includes(view) && id === "setup") ? 0 : -1}
          onClick={() => setView(id)}
        >
          {label}<b>{count}</b>
        </button>)}
      </nav>

      <details className="assistant-more-tools">
        <summary><strong>More</strong><span>History, company rules, and source details</span></summary>
        <nav className="markup-assistant-filter" aria-label="More Plan Helper tools">
          {([
            ["history", "History & Undo", repairRecords.length],
            ["standards", "My HVAC Rules", designStandard.review + designStandard.blocked],
            ["evidence", "Source details", advancedIntelligence?.blockers.length ?? 0],
          ] as Array<[AssistantView, string, number]>).map(([id, label, count]) => <button
            key={id}
            id={`assistant-tab-${id}`}
            className={view === id ? "active" : ""}
            aria-pressed={view === id}
            aria-controls={`assistant-panel-${id}`}
            onClick={() => setView(id)}
          >
            {label}<b>{count}</b>
          </button>)}
        </nav>
      </details>

      <div className={`markup-assistant-body view-${view}`}>
        {view === "setup" && <main className="smart-plan-setup-workspace" role="tabpanel" id="assistant-panel-setup" aria-labelledby="assistant-tab-setup">
          {smartSetup ? <>
            <header className="smart-plan-setup-heading">
              <div>
                <small>SMART PLAN SETUP</small>
                <h3>{smartSetup.summary.headline}</h3>
                <p>{smartSetup.summary.detail}</p>
              </div>
              <span className={smartSetup.counts.requiredReviewItems ? "attention" : "ready"}>
                <strong>{smartSetup.counts.reviewItems}</strong>
                <small>NEED YOUR REVIEW</small>
              </span>
            </header>

            <div className="smart-plan-setup-metrics">
              <article className={scaleVerified ? "confirmed" : smartSetup.counts.verifiedScales + smartSetup.counts.likelyScales ? "found" : "missing"}>
                <small>SCALE</small>
                <strong>{scaleVerified ? "Confirmed" : `${smartSetup.counts.verifiedScales + smartSetup.counts.likelyScales} of ${smartSetup.counts.sheets} found`}</strong>
                <span>{scaleVerified ? "Measurements enabled" : "Confirm before measured work"}</span>
              </article>
              <article className={smartSetup.counts.roomHeights ? "found" : "missing"}>
                <small>ROOMS &amp; HEIGHTS</small>
                <strong>{smartSetup.counts.rooms} rooms</strong>
                <span>{smartSetup.counts.roomHeights} ceiling heights found</span>
              </article>
              <article className={smartSetup.counts.equipment ? "found" : "missing"}>
                <small>EQUIPMENT</small>
                <strong>{smartSetup.counts.equipment} unit{smartSetup.counts.equipment === 1 ? "" : "s"}</strong>
                <span>{smartSetup.counts.systems} system label{smartSetup.counts.systems === 1 ? "" : "s"}</span>
              </article>
              <article className={smartSetup.counts.requiredReviewItems ? "missing" : "confirmed"}>
                <small>NEXT</small>
                <strong>{smartSetup.counts.requiredReviewItems ? `${smartSetup.counts.requiredReviewItems} required` : "Ready for Step 1"}</strong>
                <span>{smartSetup.counts.requiredReviewItems ? "Only dependent work pauses" : "Connection preview remains approval-first"}</span>
              </article>
            </div>

            <div className="smart-plan-setup-grid">
              <section className="smart-plan-question-list">
                <header>
                  <div><small>NEEDS YOUR REVIEW</small><h3>Only the details that matter next</h3></div>
                  <button onClick={() => setView("evidence")}>Review sources</button>
                </header>
                {smartSetup.reviewQuestions.slice(0, 6).map((question) => {
                  const source = question.sourceIds.map((id) => planFactSources.get(id)).find(Boolean);
                  return <article className={question.priority} key={question.id}>
                    <span><AlertTriangle size={16} /></span>
                    <div>
                      <small>{question.priority === "required" ? "NEEDED FOR THE NEXT STEP" : "RECOMMENDED"}{question.sheetNumber ? ` · ${question.sheetNumber}` : ""}</small>
                      <strong>{question.title}</strong>
                      <p>{question.prompt}</p>
                    </div>
                    {source && <button onClick={() => onShowPlanSetupSource(source.page, source.region)}>Show source</button>}
                  </article>;
                })}
                {!smartSetup.reviewQuestions.length && <div className="smart-plan-clear">
                  <CheckCircle2 size={22} />
                  <span><strong>Plan setup is ready</strong><small>Detected facts can now support preview-first connection repair.</small></span>
                </div>}
              </section>

              <aside className="smart-plan-fact-list">
                <header><small>WHAT I FOUND</small><h3>Source-backed plan facts</h3></header>
                {smartSetup.scales.slice(0, 4).map((scale) => {
                  const selected =
                    scale.candidates.find((candidate) => candidate.id === scale.selectedCandidateId) ||
                    scale.candidates[0];
                  const source = selected?.sources[0];
                  const usableCandidates = scale.candidates.filter((candidate) =>
                    candidate.kind !== "not-to-scale" && candidate.ratio && candidate.ratio > 0
                  );
                  const appliedScaleLabel = confirmedScaleByPage[String(scale.page)];
                  return <article key={`scale-${scale.page}`}>
                    <span><strong>{scale.sheetNumber}</strong><small>{scale.title}</small></span>
                    <b className={scale.status}>
                      {scale.conflict
                        ? `${scale.candidates.length} scales found`
                        : scale.selectedLabel || selected?.label || "Scale not found"}
                      <small>{scale.conflict ? "Needs your choice" : planFactLabel(scale.status)}</small>
                    </b>
                    <div className="smart-plan-fact-actions">
                      {source && <button onClick={() => onShowPlanSetupSource(source.page, source.region)}>Source</button>}
                      {!scale.conflict && selected && usableCandidates.length
                        ? <button
                          className="primary"
                          disabled={appliedScaleLabel === selected.label}
                          onClick={() => onUseDetectedScale(selected, scale.page)}
                        >
                          {appliedScaleLabel === selected.label ? "Scale applied ✓" : "Apply recommended scale"}
                        </button>
                        : null}
                      {scale.conflict && usableCandidates.map((candidate) => <button
                        className="primary scale-choice"
                        key={candidate.id}
                        disabled={appliedScaleLabel === candidate.label}
                        onClick={() => onUseDetectedScale(candidate, scale.page)}
                      >
                        {appliedScaleLabel === candidate.label ? `${candidate.label} applied ✓` : `Use ${candidate.label}`}
                      </button>)}
                      {(!usableCandidates.length || scale.conflict) && <button onClick={() => onStartCalibration(scale.page)}>Calibrate instead</button>}
                    </div>
                  </article>;
                })}
                {smartSetup.rooms.slice(0, 6).map((room) => <article key={room.id}>
                  <span><strong>{room.name}</strong><small>{room.sheetNumber}</small></span>
                  <b className={room.status}>{room.ceilingHeight?.label || "Height not found"}<small>{planFactLabel(room.status)}</small></b>
                  {room.sources[0] && <button onClick={() => onShowPlanSetupSource(room.sources[0].page, room.sources[0].region)}>Source</button>}
                </article>)}
                {!smartSetup.scales.length && !smartSetup.rooms.length && <div className="smart-plan-clear">
                  <FileSearch size={22} />
                  <span><strong>No setup facts found yet</strong><small>Read the PDF or visually confirm the scanned sheets.</small></span>
                </div>}
              </aside>
            </div>

            <footer className="smart-plan-setup-actions">
              <p>Suggested or missing information is never silently accepted. Ceiling height informs room review; reviewed airflow still controls duct sizing.</p>
              <button onClick={() => setView("evidence")}><FileSearch size={16} /> Review source details</button>
            </footer>
          </> : <div className="smart-plan-setup-empty">
            <ScanSearch size={38} />
            <small>SMART PLAN SETUP</small>
            <h3>Let Plan Helper read the plan first</h3>
            <p>It will look for each drawing scale, room and ceiling-height notes, equipment, systems, and the few details you still need to answer.</p>
            <p>Plan reading starts automatically after you open a PDF.</p>
          </div>}
        </main>}

        {view === "recommendations" && <>
          <aside className="markup-assistant-queue" aria-label="Recommendation queue">
            <div className="markup-assistant-filter" aria-label="Recommendation filters">
              {([
                ["do-first", "Do first", recommendations.filter((row) => !row.resolved && row.priorityTier === "do-first").length],
                ["can-fix", "Can fix", recommendations.filter((row) =>
                  !row.resolved && repairActionsForRecommendation(row).some((action) =>
                    action.readiness === "ready" && action.safeForBatch
                  )
                ).length],
                ["needs-answer", "Needs answer", recommendations.filter((row) =>
                  !row.resolved && repairActionsForRecommendation(row).some((action) =>
                    action.readiness !== "ready"
                  )
                ).length],
                ["all", "All", recommendations.filter((row) => !row.resolved).length],
              ] as Array<[RecommendationFilter, string, number]>).map(([id, label, count]) => <button
                key={id}
                aria-pressed={filter === id}
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id)}
              >{label}<b>{count}</b></button>)}
            </div>
            <div className="markup-assistant-list">
              {filtered.map((recommendation) => <button
                key={recommendation.id}
                className={`${recommendation.severity} ${active?.id === recommendation.id ? "active" : ""} ${recommendation.resolved ? "resolved" : ""}`}
                aria-pressed={active?.id === recommendation.id}
                onClick={() => setActiveId(recommendation.id)}
              >
                <i>{recommendation.resolved ? <CheckCircle2 size={16} /> : recommendation.severity === "critical" ? <AlertTriangle size={16} /> : recommendation.category === "Duct sizing" ? <Gauge size={16} /> : recommendation.category === "Branch strategy" ? <Route size={16} /> : <Crosshair size={16} />}</i>
                <span>
                  <small>{priorityLabel(recommendation)} · {recommendation.category}</small>
                  <strong>{recommendation.title}</strong>
                  <em>{recommendationStatus(recommendation)} · {confidenceLabel(recommendation.confidence)} evidence · {recommendation.evidence[0]}</em>
                </span>
                <ChevronRight size={17} />
              </button>)}
              {!filtered.length && <div className="markup-assistant-empty">
                <CheckCircle2 size={28} />
                <strong>No recommendations in this view</strong>
                <span>The current evidence does not produce a matching item.</span>
              </div>}
            </div>
          </aside>

          <main className="markup-assistant-detail" role="tabpanel" id="assistant-panel-recommendations" aria-labelledby="assistant-tab-recommendations">
            {active ? <>
              <div className="markup-detail-heading">
                <div><small>{priorityLabel(active)} · {active.category}</small><h3>{active.title}</h3></div>
                <span>{confidenceLabel(active.confidence)} evidence confidence</span>
              </div>
              {(active.decisionStale || stale) && <div className="markup-stale-warning"><AlertTriangle size={18} /><span><strong>Evidence changed.</strong> Refresh the plan before relying on this action.</span></div>}
              <section className="markup-priority-reason"><small>WHY THIS ORDER</small><p>{active.priorityReason}</p></section>
              <section><small>OBSERVED CONDITION</small><p>{active.detail}</p></section>
              <section><small>WHY IT MATTERS</small><p>{active.whyItMatters}</p></section>
              <section className="markup-proposed-action"><small>PROPOSED REPAIR</small><p>{active.proposedAction}</p></section>
              {activeRepairAction && <section className={`markup-fix-path ${activeRepairAction.readiness}`}>
                <header>
                  <small>HOW THIS GETS FIXED</small>
                  <b>{readinessLabel(activeRepairAction)}</b>
                </header>
                <p>{activeRepairAction.blocker || activeRepairAction.proposedFix}</p>
                <div>
                  <span>
                    {activeRepairActions.length > 1
                      ? `${activeRepairActions.length} related fix items`
                      : `${activeRepairAction.objectIds.length} affected plan object${activeRepairAction.objectIds.length === 1 ? "" : "s"}`}
                  </span>
                  <button onClick={() => openRepairAction(activeRepairAction, active)}>
                    {activeRepairAction.nextStepLabel} <ArrowRight size={15} />
                  </button>
                </div>
              </section>}
              <section><small>EVIDENCE USED</small><ul>{active.evidence.map((evidence) => <li key={evidence}><ShieldCheck size={14} /> {evidence}</li>)}</ul></section>
              <div className="markup-detail-actions">
                {active.drawingId && <button onClick={() => onFocusDrawing(active.drawingId!)}><Crosshair size={16} /> Show on plan</button>}
                <button onClick={() => onOpenManualReview(active)}><ShieldCheck size={16} /> Open decision record</button>
                <button className="primary" onClick={() => {
                  chooseMode("prepare");
                }}><ListChecks size={16} /> Open repair plan</button>
                {active.action === "branch-pass" && <button onClick={() => onApplyRecommendation(active)}><Route size={16} /> Confirm T/Y on plan</button>}
              </div>
            </> : <div className="markup-assistant-clear">
              <ShieldCheck size={36} />
              <h3>The recommendation queue is clear</h3>
              <p>Rerun after changing geometry, scheduled CFM, equipment, room assignments, or sizing rules.</p>
            </div>}
          </main>
        </>}

        {view === "standards" && <main className="design-standard-workspace" role="tabpanel" id="assistant-panel-standards" aria-labelledby="assistant-tab-standards">
          <header className="design-standard-heading">
            <div>
              <small>{designStandard.name.toUpperCase()}</small>
              <h3>Your usual way of doing the job, checked against this system</h3>
              <p>Locked safeguards, calculated checks, recommendations, and project-only exceptions stay visibly separate.</p>
            </div>
            <div className={`design-standard-score ${designStandard.blocked ? "blocked" : designStandard.review ? "review" : "clear"}`}>
              <strong>{designStandard.score}</strong>
              <span>STANDARD<br />SCORE</span>
            </div>
          </header>

          <section className="design-standard-levels" aria-label="Standard rule levels">
            {([
              ["locked", "Locked safeguards", "Cannot be overridden by a project."],
              ["calculated", "Calculated checks", "Reviewed airflow and engineering evidence."],
              ["recommended", "Company preferences", "Preferred routing and field clarity."],
              ["project", "Project exceptions", "Visible here; the shared standard stays unchanged."],
            ] as Array<[DesignStandardRuleLevel, string, string]>).map(([level, label, detail]) => <div key={level}>
              <i data-level={level}><DraftingCompass size={16} /></i>
              <span><strong>{label}</strong><small>{detail}</small></span>
            </div>)}
          </section>

          <div className="design-standard-rule-list">
            {designStandard.rules.map((standardRule) => <article key={standardRule.id} className={`design-standard-rule ${standardRule.status}`}>
              <header>
                <i>{standardRule.status === "clear" ? <CheckCircle2 size={19} /> : standardRule.status === "blocked" ? <AlertTriangle size={19} /> : <DraftingCompass size={19} />}</i>
                <div>
                  <small>{standardRule.level.toUpperCase().replace("-", " ")} · {standardRule.status.toUpperCase().replace("-", " ")}</small>
                  <h3>{standardRule.title}</h3>
                </div>
                <span>{standardRule.overrideAllowed ? "PROJECT EXCEPTION ALLOWED" : "LOCKED"}</span>
              </header>
              <p className="design-standard-statement">{standardRule.standard}</p>
              <div className="design-standard-finding"><strong>Current plan</strong><span>{standardRule.finding}</span></div>
              <div className="design-standard-action"><strong>Review action</strong><span>{standardRule.action}</span></div>
              <footer>
                {standardRule.evidence.map((evidence) => <span key={evidence}><ShieldCheck size={13} /> {evidence}</span>)}
                {standardRule.drawingIds[0] && <button onClick={() => onFocusDrawing(standardRule.drawingIds[0])}><Crosshair size={14} /> Show on plan</button>}
              </footer>
            </article>)}
          </div>

          <section className="design-standard-boundary">
            <ShieldCheck size={20} />
            <div><strong>Your HVAC rules can suggest; reviewed plan evidence authorizes.</strong>{designStandard.nonClaims.map((notice) => <p key={notice}>{notice}</p>)}</div>
          </section>
        </main>}

        {view === "repair-plan" && <main className="repair-plan-workspace" role="tabpanel" id="assistant-panel-repair-plan" aria-labelledby="assistant-tab-repair-plan">
          <section className="fix-plan-unified" aria-label="Fix Plan">
            <header className="fix-plan-heading">
              <div>
                <small>FIX PLAN</small>
                <h3>One issue. One proposed fix. You decide.</h3>
                <p>Each issue shows where it is, what is wrong, and exactly what the assistant would change. Nothing is fixed, skipped, or placed without your choice.</p>
              </div>
              <div className="fix-plan-counts" aria-label="Fix Plan status">
                <span><b>{combinedFixActions.length}</b> open</span>
                <span><b>{combinedFixActions.filter((action) => action.readiness === "ready").length}</b> safe now</span>
                <span><b>{combinedFixActions.filter((action) => action.readiness !== "ready").length}</b> need you</span>
              </div>
            </header>

            <section className={`assistant-suggestion-layer-control ${suggestionLayer.status}`} aria-live="polite">
              <div className="assistant-suggestion-layer-icon">
                {suggestionLayerVisible ? <Eye size={22} /> : <EyeOff size={22} />}
              </div>
              <div>
                <small>TRANSPARENT PLAN LAYER · PAGE {suggestionLayer.page}</small>
                <h3>{suggestionLayer.headline}</h3>
                <p>{suggestionLayer.detail}</p>
                {suggestionLayer.status === "review" && <span>
                  <b>{suggestionLayer.suggestions.filter((item) => item.kind === "supply").length}</b> supply review zones ·{" "}
                  <b>{suggestionLayer.suggestions.filter((item) => item.kind === "return").length}</b> return-path review zones ·{" "}
                  {confidenceLabel(suggestionLayer.confidence)} evidence confidence
                </span>}
                {suggestionLayer.status === "blocked" && <ul>
                  {suggestionLayer.missingInformation.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                </ul>}
              </div>
              {suggestionLayer.status === "review"
                ? <button
                  type="button"
                  className={suggestionLayerVisible ? "active" : ""}
                  aria-pressed={suggestionLayerVisible}
                  aria-label={`${suggestionLayerVisible ? "Hide" : "Show"} supply and return review zones on PDF page ${suggestionLayer.page}`}
                  onClick={() => onSuggestionLayerVisibleChange(!suggestionLayerVisible)}
                >
                  {suggestionLayerVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                  {suggestionLayerVisible ? "Hide layer" : "Show on plan"}
                </button>
                : suggestionLayer.status === "blocked"
                  ? <button type="button" onClick={() => setView("setup")}><ScanSearch size={17} /> Finish plan setup</button>
                  : null}
            </section>

            {stale && <div className="repair-plan-stale" role="alert">
              <AlertTriangle size={20} />
              <span><strong>The plan changed.</strong> Refresh this issue before approving it. An outdated suggestion cannot change the drawing.</span>
              <button onClick={onPrepareRepairPlan}><RefreshCw size={16} /> Refresh</button>
            </div>}

            {activeFixAction ? <>
              <nav className="fix-plan-progress" aria-label="Open issue navigation">
                <button type="button" onClick={() => moveToFix(-1)} disabled={visibleFixActions.length < 2}>Previous</button>
                <div>
                  <strong>Issue {activeFixIndex + 1} of {visibleFixActions.length}</strong>
                  <span>{skippedActionIds.length ? `${skippedActionIds.length} left for later` : "Review in recommended order"}</span>
                </div>
                <button type="button" onClick={() => moveToFix(1)} disabled={visibleFixActions.length < 2}>Next</button>
                {skippedActionIds.length > 0 && <button
                  type="button"
                  className="fix-plan-restore"
                  onClick={() => {
                    setSkippedActionIds([]);
                    setActiveFixId(firstFixId);
                  }}
                >Restore skipped</button>}
              </nav>

              <article
                className={`fix-plan-issue ${activeFixAction.readiness} ${selected.has(activeFixAction.id) ? "selected" : ""}`}
                id={`fix-plan-${activeFixAction.id}`}
              >
                <header>
                  <i>{actionIcon(activeFixAction)}</i>
                  <div>
                    <small>{priorityLabel(activeFixAction)} · {readinessLabel(activeFixAction)}</small>
                    <h3>{activeFixAction.title}</h3>
                  </div>
                  {(activeFixAction.objectIds.length > 0 || activeFixRecommendation?.preview) && <button
                    type="button"
                    className="fix-plan-show"
                    onClick={() => showFixOnPlan(activeFixAction)}
                  ><Crosshair size={16} /> Show where</button>}
                </header>

                <div className="fix-plan-question-flow">
                  <section>
                    <small>1 · WHERE</small>
                    <strong>{activeFixAction.location}</strong>
                    <p>{activeFixAction.objectIds.length
                      ? `${activeFixAction.objectIds.length} linked plan object${activeFixAction.objectIds.length === 1 ? "" : "s"}`
                      : "System or source-plan review"}</p>
                  </section>
                  <section>
                    <small>2 · WHAT IS WRONG</small>
                    <p>{activeFixAction.problem}</p>
                  </section>
                  <section>
                    <small>3 · HOW I WOULD FIX IT</small>
                    <p>{activeFixAction.proposedFix}</p>
                  </section>
                  <section>
                    <small>4 · EXPECTED RESULT</small>
                    <p>{activeFixAction.expectedResult}</p>
                  </section>
                </div>

                {activeConnectionItem && activeConnectionItem.candidates.length > 1 && <section className="fix-plan-connection-choices">
                  <div>
                    <small>CHOOSE THE EXISTING RUN YOU RECOGNIZE</small>
                    <strong>The assistant found {activeConnectionItem.candidates.length} possible endpoints.</strong>
                  </div>
                  <div>
                    {activeConnectionItem.candidates.map((candidate) => <button
                      type="button"
                      key={candidate.id}
                      className={connectionCandidateChoices[activeConnectionItem.id] === candidate.id ? "selected" : ""}
                      aria-pressed={connectionCandidateChoices[activeConnectionItem.id] === candidate.id}
                      onClick={() => onChooseConnectionCandidate(activeConnectionItem.id, candidate.id)}
                    >
                      <span><b>{candidate.runSize}&quot; {activeConnectionItem.ductType}</b><small>{candidate.runId} · {candidate.end} endpoint</small></span>
                      <em>{candidate.explanation}</em>
                    </button>)}
                  </div>
                </section>}

                <section className="fix-plan-decision">
                  <div>
                    <small>YOUR DECISION</small>
                    <strong>{activeFixAction.readiness === "ready"
                      ? "Do you approve this exact fix?"
                      : "This needs one answer or an on-plan confirmation first."}</strong>
                    {activeFixAction.blocker && <p>{activeFixAction.blocker}</p>}
                  </div>
                  <div>
                    {activeFixAction.readiness === "ready" && activeFixAction.safeForBatch
                      ? <button
                        type="button"
                        className="approve"
                        disabled={stale}
                        onClick={() => approveSingleAction(activeFixAction)}
                      ><CheckCircle2 size={17} /> Yes · fix this</button>
                      : activeConnectionItem
                        ? <button
                          type="button"
                          className="needs-answer"
                          disabled={activeConnectionItem.status === "choice"}
                          onClick={() => onFocusConnectionRepair(activeConnectionItem.id)}
                        ><Crosshair size={17} /> {activeConnectionItem.status === "choice" ? "Choose a run above" : "Inspect on plan"}</button>
                      : <button
                        type="button"
                        className="needs-answer"
                        onClick={() => openRepairAction(activeFixAction, activeFixRecommendation)}
                      ><ArrowRight size={17} /> {activeFixAction.nextStepLabel}</button>}
                    <button type="button" className="skip" onClick={() => skipAction(activeFixAction)}>No · leave for later</button>
                  </div>
                </section>

                {selected.has(activeFixAction.id) && activeFixAction.readiness === "ready" && <section className="fix-plan-inline-approval" aria-live="polite">
                  <div>
                    <small>FINAL CHECK · ONE UNDO</small>
                    <h3>Approve only this fix</h3>
                    <p>The live plan and evidence are checked again immediately before saving. If anything changed, nothing is applied.</p>
                  </div>
                  <label>Reviewer / initials
                    <input required value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Your initials" />
                  </label>
                  <label className="fix-plan-confirm">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmedKey(event.target.checked ? confirmationKey : "")}
                    />
                    <span>I reviewed the problem, proposed fix, result, and affected object.</span>
                  </label>
                  {requiresPlanningOverride && <label className="fix-plan-confirm pressure-override">
                    <input
                      type="checkbox"
                      checked={planningOverrideConfirmed}
                      onChange={(event) => setPlanningOverrideKey(event.target.checked ? confirmationKey : "")}
                    />
                    <span>This is a velocity-only planning change. Pressure, installed flex condition, and field airflow still require professional review.</span>
                  </label>}
                  <label className="fix-plan-note">Optional note
                    <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason or field note" />
                  </label>
                  <button
                    type="button"
                    className="fix-plan-apply"
                    disabled={!reviewer.trim() || !confirmed || !planningOverrideConfirmed || stale || applying}
                    onClick={() => void applySelected()}
                  >
                    <ShieldCheck size={18} />
                    {applying ? "Checking and applying..." : "Apply this fix · one Undo"}
                  </button>
                </section>}

                <details className="fix-plan-evidence">
                  <summary>Why this was recommended and exact changes</summary>
                  <p><strong>{priorityLabel(activeFixAction)}:</strong> {activeFixAction.priorityReason}</p>
                  <ul>{activeFixAction.evidence.map((evidence) => <li key={evidence}><ShieldCheck size={14} /> {evidence}</li>)}</ul>
                  {activeFixAction.changes.length
                    ? <div>{activeFixAction.changes.map((change) => <p key={`${change.objectId}-${change.field}`}>
                      <strong>{change.field}:</strong> {change.before} <ArrowRight size={13} /> {change.after}
                    </p>)}</div>
                    : <p>{activeFixAction.changeScope}</p>}
                </details>
              </article>
            </> : <div className="fix-plan-clear">
              <CheckCircle2 size={34} />
              <h3>{skippedActionIds.length ? "Every remaining issue is left for later" : "The Fix Plan is clear"}</h3>
              <p>{skippedActionIds.length
                ? "Nothing was marked fixed. Restore the skipped issues whenever you are ready."
                : "No open repair action is supported by the current evidence."}</p>
              {skippedActionIds.length > 0 && <button type="button" onClick={() => setSkippedActionIds([])}>Restore skipped issues</button>}
            </div>}

            <p className="repair-planning-notice">{repairPlan.planningNotice} Review zones never create a diffuser, return, route, or fitting.</p>
          </section>

          {showLegacyRepairPlan && <div className="legacy-repair-plan">
          <section className="assistant-mode-strip" aria-label="Fix permission">
            {([
              ["inspect", "Check only", "Show possible problems without changing the plan."],
              ["prepare", "Prepare fixes", "Gather eligible fixes for you to review."],
              ["guided", "Apply approved fixes", "Make selected changes together with one Undo."],
            ] as Array<[RepairAutonomyMode, string, string]>).map(([id, label, detail]) => <button
              key={id}
              className={autonomyMode === id ? "active" : ""}
              aria-pressed={autonomyMode === id}
              onClick={() => chooseMode(id)}
            >
              <span>{id === "inspect" ? <FileSearch size={17} /> : id === "prepare" ? <ListChecks size={17} /> : <ShieldCheck size={17} />}</span>
              <strong>{label}</strong>
              <small>{detail}</small>
            </button>)}
          </section>

          <section className={`markup-assistant-command ${stale ? "stale" : ""}`}>
            <div className={`markup-assistant-score ${summary.critical ? "critical" : summary.warnings ? "attention" : "clear"}`}>
              <strong>{summary.score}</strong>
              <span>PLAN<br />SCORE</span>
            </div>
            <div>
              <small>{stale ? "FIX LIST NEEDS REFRESHING" : "CURRENT FIX LIST"}</small>
              <h3>{stale ? "The plan changed after calculation" : repairPlan.headline}</h3>
              <p>{stale
                ? "Refresh the fix list before applying. An outdated suggestion cannot change the drawing."
                : `${summary.doFirst} must be checked first · ${readyActions.length} safe now · ${repairPlan.needsInputCount} need an answer. No new route is created, and every applied batch has one Undo.`}</p>
            </div>
            <button onClick={onPrepareRepairPlan}>
              {stale ? "Refresh fixes" : preparedEvidenceFingerprint ? "Refresh fix list" : "Prepare fixes"} <ArrowRight size={17} />
            </button>
          </section>

          {stale && <div className="repair-plan-stale" role="alert">
            <AlertTriangle size={20} />
            <span><strong>This repair plan is stale.</strong> Geometry or evidence changed after the plan was prepared.</span>
            <button onClick={onPrepareRepairPlan}><RefreshCw size={16} /> Refresh repair plan</button>
          </div>}
          <header className="repair-plan-heading">
            <div>
              <small>GUIDED REPAIR PLAN</small>
              <h3>{repairPlan.headline}</h3>
              <p>Ready fixes are grouped by step. Route and fitting decisions stay on the plan for your approval.</p>
            </div>
            <div className="repair-plan-counts">
              <span><b>{repairPlan.readyCount}</b> ready</span>
              <span><b>{repairPlan.needsInputCount}</b> need input</span>
              <span><b>{repairPlan.planConfirmationCount + repairPlan.manualCount}</b> manual</span>
            </div>
          </header>

          <section className="repair-plan-toolbar" aria-label="Repair selection controls" aria-live="polite">
            <div>
              <strong>{readySelected.length} of {readyActions.length} safe fixes selected</strong>
              <span>Nothing is selected automatically. Connection, airflow, and size steps never mix.</span>
            </div>
            <button disabled={!readyActions.length || stale} onClick={selectAllReadyActions}>
              <ListChecks size={16} /> {allReadySelected ? "Clear selected fixes" : `Select safe fixes in this step (${readyActions.length})`}
            </button>
            <button disabled={!selectedActionIds.length} onClick={() => onSelectedActionIdsChange([])}>Clear</button>
          </section>

          <div className="repair-action-list">
            {repairGroups.map((group) => <section className="repair-action-group" key={group.id}>
              <header>
                <div><small>FIX STEP</small><h3>{group.label}</h3></div>
                <span>{group.actions.length} item{group.actions.length === 1 ? "" : "s"} · {group.detail}</span>
              </header>
              <div>
              {group.actions.map((action) => <article
              key={action.id}
              id={action.id}
              className={`repair-action ${action.readiness} ${selected.has(action.id) ? "selected" : ""}`}
            >
              <button
                className="repair-action-select"
                aria-pressed={selected.has(action.id)}
                disabled={action.readiness !== "ready" || stale || !readyActions.some((row) => row.id === action.id)}
                onClick={() => toggleAction(action)}
              >
                <i>{action.readiness === "ready" && selected.has(action.id) ? <CheckCircle2 size={18} /> : actionIcon(action)}</i>
                <span>
                  <small>{priorityLabel(action)} · {readinessLabel(action)}</small>
                  <strong>{action.title} · {action.location}</strong>
                  <em>{action.problem}</em>
                </span>
                {action.readiness === "ready" && <b>{selected.has(action.id) ? "SELECTED" : "ADD FIX"}</b>}
              </button>
              <div className="repair-action-fix">
                <div><small>PROBLEM</small><p>{action.problem}</p></div>
                <div><small>PROPOSED FIX</small><p>{action.proposedFix}</p></div>
                <div><small>EXPECTED RESULT</small><p>{action.expectedResult}</p></div>
                <div className="repair-action-objects">
                  <small>AFFECTED PLAN OBJECTS · {action.objectIds.length}</small>
                  {action.objectIds.length
                    ? <span>{action.objectIds.map((objectId, index) => <button
                      key={objectId}
                      title={objectId}
                      onClick={() => onFocusDrawing(objectId)}
                    ><Crosshair size={14} /> Inspect object {index + 1}</button>)}</span>
                    : <p>No drawing object is linked. Use the decision record and source evidence.</p>}
                </div>
              </div>
              <div className="repair-action-preview" aria-label={`Before and after preview for ${action.title}`}>
                <header>
                  <small>REVIEWED FIELD CHANGES</small>
                  <span>{action.geometryChanges ? "PLAN CONFIRMATION REQUIRED" : "NO ROUTE MOVEMENT"}</span>
                </header>
                {action.changes.length ? action.changes.map((change) => <div key={`${change.objectId}-${change.field}`}>
                  <span><small>BEFORE</small><strong>{change.before}</strong></span>
                  <ArrowRight size={17} />
                  <span><small>AFTER</small><strong>{change.after}</strong></span>
                </div>) : <p>{action.changeScope}</p>}
                <footer><ShieldCheck size={14} /> {action.changeScope}</footer>
              </div>
              <p className="repair-priority-reason"><strong>{priorityLabel(action)}:</strong> {action.priorityReason}</p>
              <div className="repair-action-evidence">
                {action.evidence.map((evidence) => <span key={evidence}><ShieldCheck size={13} /> {evidence}</span>)}
                {action.blocker && <p><AlertTriangle size={14} /> {action.blocker}</p>}
              </div>
              <div className="repair-action-actions">
                {action.kind === "terminal-cfm" && action.readiness !== "ready" && <button onClick={onOpenSizingReview}><Gauge size={15} /> {action.nextStepLabel}</button>}
                {action.kind === "run-size" && action.readiness !== "ready" && <button onClick={onOpenSizingReview}><Gauge size={15} /> {action.nextStepLabel}</button>}
                {action.kind === "run-number" && action.readiness !== "ready" && <button onClick={() => onFocusDrawing(action.drawingId)}><Crosshair size={15} /> {action.nextStepLabel}</button>}
                {action.kind === "branch-junction" && (() => {
                  const recommendation = recommendations.find((row) =>
                    row.preview?.kind === "branch-junction" &&
                    row.preview.mainRunId === action.mainRunId &&
                    row.preview.branchRunId === action.branchRunId
                  );
                  return recommendation
                    ? <button onClick={() => onApplyRecommendation(recommendation)}><Route size={15} /> {action.nextStepLabel}</button>
                    : null;
                })()}
                {action.kind === "manual-follow-up" && (() => {
                  const recommendation = recommendations.find((row) => row.id === action.recommendationId);
                  return recommendation
                    ? <button onClick={() => openRepairAction(action, recommendation)}><ShieldCheck size={15} /> {action.nextStepLabel}</button>
                    : null;
                })()}
              </div>
            </article>)}
              </div>
            </section>)}
          </div>

          {scaleVerified ? <section className="takeoff-delta-panel">
            <header>
              <div><small>MATERIAL IMPACT</small><h3>Before → after purchasing impact</h3></div>
              <span>{takeoffImpact.affectedFittings} fitting port{takeoffImpact.affectedFittings === 1 ? "" : "s"} to synchronize</span>
            </header>
            <div className="takeoff-delta-summary">
              <span><small>MEASURED ROUTE</small><strong>{formatFeet(takeoffImpact.measuredLengthBefore)} → {formatFeet(takeoffImpact.measuredLengthAfter)}</strong></span>
              <span><small>25-FT BOXES</small><strong>{takeoffImpact.boxesBefore} → {takeoffImpact.boxesAfter}</strong></span>
              <span><small>CHANGED ROWS</small><strong>{takeoffImpact.changedRows}</strong></span>
            </div>
            <div className="takeoff-delta-rows">
              {takeoffImpact.rows.filter((row) => row.deltaBoxes || Math.abs(row.deltaMeasuredFeet) > .01).map((row) => <div key={row.key}>
                <span><strong>{row.type.toUpperCase()} · {row.size}″ flex</strong><small>{row.beforeMeasuredFeet.toFixed(1)} → {row.afterMeasuredFeet.toFixed(1)} measured ft</small></span>
                <b>{row.beforeBoxes} → {row.afterBoxes} boxes</b>
              </div>)}
              {!takeoffImpact.changedRows && <p>Selected actions do not change material quantities yet.</p>}
            </div>
          </section> : <section className="takeoff-delta-panel scale-hold" role="alert">
            <header>
              <div><small>MATERIAL IMPACT ON HOLD</small><h3>Confirm the sheet scale before purchasing quantities</h3></div>
              <AlertTriangle size={20} />
            </header>
            <p>Run labels and other metadata-only fixes remain available. Length, box counts, and size-apply purchasing impact stay hidden until the affected plan scale is confirmed.</p>
          </section>}

          <section className="repair-plan-approval">
            <div>
              <small>ONE CONTROLLED TRANSACTION</small>
              <h3>Apply {readySelected.length} selected repair{readySelected.length === 1 ? "" : "s"} · one Undo</h3>
              <p>The plan is checked again immediately before saving. If anything changed, nothing is applied.</p>
            </div>
            <div className="repair-plan-reviewer">
              <label>Reviewer / initials · required<input required value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Who reviewed this batch?" /></label>
              <label>Batch note<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason or coordination note" /></label>
            </div>
            <label className="repair-final-confirmation">
              <input
                type="checkbox"
                disabled={!readySelected.length}
                checked={confirmed}
                onChange={(event) => setConfirmedKey(event.target.checked ? confirmationKey : "")}
              />
              <span>I reviewed each selected problem, proposed fix, expected result, and affected plan object. I understand this is a planning-screened repair.</span>
            </label>
            {requiresPlanningOverride && <label className="repair-final-confirmation pressure-override">
              <input
                type="checkbox"
                disabled={!readySelected.length}
                checked={planningOverrideConfirmed}
                onChange={(event) => setPlanningOverrideKey(event.target.checked ? confirmationKey : "")}
              />
              <span><strong>Velocity-only planning override.</strong> OEM external static pressure, component losses, critical-path effective length, fitting losses, and installed flex condition are not verified. I authorize this marked-plan size change for further professional review.</span>
            </label>}
            <button
              className="repair-apply-button"
              disabled={!readySelected.length || !reviewer.trim() || stale || !confirmed || !planningOverrideConfirmed || applying || autonomyMode !== "guided"}
              onClick={() => void applySelected()}
            >
              <ShieldCheck size={18} />
              {autonomyMode !== "guided"
                ? "Choose Apply approved fixes to enable this button"
                : applying
                  ? "Checking the plan and applying..."
                  : `Apply ${readySelected.length} selected repair${readySelected.length === 1 ? "" : "s"} · one Undo`}
            </button>
            <p className="repair-planning-notice">{repairPlan.planningNotice} Verify blower data, component losses, effective length, installed flex condition, and field airflow before release.</p>
          </section>
          </div>}
        </main>}

        {view === "history" && <main className="repair-history-workspace" role="tabpanel" id="assistant-panel-history" aria-labelledby="assistant-tab-history">
          <header>
            <div><small>REPAIR HISTORY &amp; UNDO</small><h3>Repair checkpoints and apply receipts</h3><p>Every applied batch preserves its exact before-and-after fields, evidence set, object list, calculation version, and takeoff impact.</p></div>
            <button disabled={!canUndo} onClick={onUndoRepairBatch}><Undo2 size={16} /> Undo latest plan change</button>
          </header>
          <div className="repair-history-list">
            {[...repairRecords].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map((record) => <article key={record.id}>
              <i><ClipboardCheck size={20} /></i>
              <div>
                <small>{new Date(record.createdAt).toLocaleString()} · {record.reversedAt ? "REVERSED IN THIS PLAN" : record.cloudSync === "synced" ? "CLOUD RECEIPT SAVED" : record.cloudSync === "pending" ? "CLOUD RECEIPT PENDING" : "LOCAL CHECKPOINT"}</small>
                <h3>{record.actionIds.length} planning change{record.actionIds.length === 1 ? "" : "s"} {record.reversedAt ? "reversed" : "applied"}</h3>
                <p>{record.actions.map((action) => action.title).join(" · ")}</p>
                <span>Plan {record.beforeDrawingFingerprint.toUpperCase()} → {record.afterDrawingFingerprint.toUpperCase()}</span>
                <span>Flex boxes {record.takeoffImpact.boxesBefore} → {record.takeoffImpact.boxesAfter} · {record.takeoffImpact.affectedFittings} fitting ports</span>
                <dl className="repair-receipt-facts">
                  <div><dt>Receipt</dt><dd>{record.id}</dd></div>
                  <div><dt>Evidence set</dt><dd>{record.evidenceFingerprint}</dd></div>
                  <div><dt>Reviewed scope</dt><dd>{record.actionIds.length} action{record.actionIds.length === 1 ? "" : "s"} · {new Set(record.actions.flatMap((action) => action.objectIds)).size} object{new Set(record.actions.flatMap((action) => action.objectIds)).size === 1 ? "" : "s"}</dd></div>
                  <div><dt>Repair engine</dt><dd>{record.repairVersion}</dd></div>
                  <div><dt>Takeoff engine</dt><dd>{record.takeoffImpact.version}</dd></div>
                  <div><dt>Material basis</dt><dd>{record.takeoffImpact.wastePercent}% allowance · {record.takeoffImpact.boxLengthFeet}-ft boxes</dd></div>
                  <div><dt>Planning override</dt><dd>{record.planningOverrideAcknowledged ? "Velocity-only override acknowledged" : "Not part of this batch"}</dd></div>
                </dl>
                {record.reversedAt && <span>Reversed {new Date(record.reversedAt).toLocaleString()} · original append-only receipt retained</span>}
                {(record.reviewer || record.note) && <blockquote>{record.reviewer && <strong>{record.reviewer}: </strong>}{record.note || "Reviewed batch"}</blockquote>}
              </div>
            </article>)}
            {!repairRecords.length && <div className="markup-assistant-clear"><History size={34} /><h3>No repair checkpoint yet</h3><p>Prepare a repair plan and apply an eligible batch to create the first receipt.</p></div>}
          </div>
        </main>}

        {view === "evidence" && <main className="assistant-evidence-workspace" role="tabpanel" id="assistant-panel-evidence" aria-labelledby="assistant-tab-evidence">
          <header>
            <div><small>SOURCE READINESS</small><h3>Evidence coverage before automation</h3><p>The assistant shows what is source-backed and what still requires OCR, visual confirmation, or a reviewed schedule value.</p></div>
            <button onClick={() => setView("setup")}><FileSearch size={16} /> Back to Plan Setup</button>
          </header>
          {advancedIntelligence ? <>
            <div className={`assistant-evidence-score ${advancedIntelligence.blockers.length ? "attention" : "clear"}`}>
              <span><strong>{advancedIntelligence.readinessScore}</strong><small>EVIDENCE INDEX</small></span>
              <div>
                <b>{advancedIntelligence.averageCoveragePercent}% category coverage</b>
                <b>{advancedIntelligence.averageRegionCoveragePercent}% exact text regions</b>
                <b>{advancedIntelligence.ocrRequiredPages.length} OCR / visual checks</b>
              </div>
            </div>
            <div className="assistant-evidence-heuristic"><ShieldCheck size={17} /><span><strong>Review-only heuristic.</strong> This index is not a probability, approval, or release gate and never authorizes a plan change.</span></div>
            {advancedIntelligence.blockers.map((blocker) => <div className="assistant-evidence-blocker" key={blocker}><AlertTriangle size={17} /><span>{blocker}</span></div>)}
            {advancedIntelligence.notices.filter((notice) => !notice.startsWith("Evidence readiness")).map((notice) => <div className="assistant-evidence-notice" key={notice}><FileSearch size={17} /><span>{notice}</span></div>)}
            <section className="assistant-coverage-matrix">
              <header><small>SHEET COVERAGE</small><h3>What each HVAC sheet contributes</h3></header>
              {advancedIntelligence.coverage.map((row) => <article key={row.page}>
                <span><strong>{row.sheetNumber}</strong><small>{row.title}</small></span>
                <span><b>{row.coveredCategories.join(", ") || "No HVAC evidence"}</b><small>{row.evidenceCount} items · {row.regionCoveragePercent}% exact regions</small></span>
                <em className={row.ocrStatus === "required" || row.missingCategories.length ? "attention" : ""}>{row.ocrStatus === "required" ? "OCR / VISUAL REVIEW" : row.missingCategories.length ? `${row.missingCategories.length} GAPS` : "COVERED"}</em>
              </article>)}
            </section>
            <section className="assistant-relationships">
              <header><small>CROSS-SHEET RELATIONSHIPS</small><h3>Candidate relationships awaiting confirmation</h3></header>
              {advancedIntelligence.relationships.map((relationship) => <article key={relationship.id}>
                <span><strong>{relationship.label}</strong><small>{relationship.sourceSheets.join(" ↔ ")}</small></span>
                <b>{Math.round(relationship.confidence * 100)}/100 · UNCONFIRMED</b>
              </article>)}
              {!advancedIntelligence.relationships.length && <p>No exact-tag cross-sheet relationship is available. The assistant will not guess from nearby values.</p>}
            </section>
          </> : <div className="markup-assistant-clear"><FileSearch size={36} /><h3>Read the plan first</h3><p>Plan Setup reads the loaded PDF automatically for scale, rooms, equipment, sheet coverage, text regions, OCR gaps, and source relationships.</p><button onClick={() => setView("setup")}>Back to Plan Setup</button></div>}
        </main>}
      </div>

      <footer className="markup-assistant-footer">
        <ShieldCheck size={18} />
        <span><strong>Planning mode.</strong> The assistant may fill blank terminal-run labels, apply reviewed terminal airflow, and update reviewed sizes only after final approval. It never invents CFM, moves route points, draws a return or trunk, moves walls or equipment, or connects zones.</span>
        <button onClick={onClose}>Return to plan</button>
      </footer>
    </section>
  </div>;
}
