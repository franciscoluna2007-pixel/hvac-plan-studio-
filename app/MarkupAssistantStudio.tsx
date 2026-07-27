"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Crosshair,
  DraftingCompass,
  FileSearch,
  Gauge,
  History,
  ListChecks,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { AdvancedPlanIntelligence } from "./advancedPlanIntelligence";
import type { DesignStandardProfile, DesignStandardRuleLevel } from "./designStandard";
import type { MarkupAssistantSummary, MarkupRecommendation } from "./markupAssistant";
import type {
  RepairAutonomyMode,
  RepairBatchRecord,
  RepairPlan,
  RepairPlanAction,
} from "./repairPlan";
import type { TakeoffImpact } from "./takeoffIntelligence";

type RecommendationFilter = "open" | "critical" | "all";
type AssistantView = "recommendations" | "standards" | "repair-plan" | "history" | "evidence";

type Props = {
  open: boolean;
  projectName: string;
  systemName: string;
  recommendations: MarkupRecommendation[];
  summary: MarkupAssistantSummary;
  repairPlan: RepairPlan;
  autonomyMode: RepairAutonomyMode;
  selectedActionIds: string[];
  preparedEvidenceFingerprint: string;
  repairRecords: RepairBatchRecord[];
  takeoffImpact: TakeoffImpact;
  advancedIntelligence: AdvancedPlanIntelligence | null;
  designStandard: DesignStandardProfile;
  canUndo: boolean;
  onClose: () => void;
  onFocusDrawing: (drawingId: string) => void;
  onOpenManualReview: (recommendation: MarkupRecommendation) => void;
  onStartBranchPass: () => void;
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
  onOpenPlanIntelligence: () => void;
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
  if (action.kind === "branch-junction") return <Crosshair size={16} />;
  return <AlertTriangle size={16} />;
}

function formatFeet(value: number) {
  return `${value.toFixed(1)} ft`;
}

export default function MarkupAssistantStudio({
  open,
  projectName,
  systemName,
  recommendations,
  summary,
  repairPlan,
  autonomyMode,
  selectedActionIds,
  preparedEvidenceFingerprint,
  repairRecords,
  takeoffImpact,
  advancedIntelligence,
  designStandard,
  canUndo,
  onClose,
  onFocusDrawing,
  onOpenManualReview,
  onStartBranchPass,
  onOpenSizingReview,
  onActiveRecommendationChange,
  onApplyRecommendation,
  onAutonomyModeChange,
  onSelectedActionIdsChange,
  onPrepareRepairPlan,
  onApplyRepairPlan,
  onUndoRepairBatch,
  onOpenPlanIntelligence,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previewKeyRef = useRef("");
  const [filter, setFilter] = useState<RecommendationFilter>("open");
  const [activeId, setActiveId] = useState("");
  const [view, setView] = useState<AssistantView>("recommendations");
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [confirmedKey, setConfirmedKey] = useState("");
  const [planningOverrideKey, setPlanningOverrideKey] = useState("");
  const [applying, setApplying] = useState(false);
  const stale = Boolean(
    preparedEvidenceFingerprint &&
    preparedEvidenceFingerprint !== repairPlan.evidenceFingerprint
  );
  const selected = useMemo(() => new Set(selectedActionIds), [selectedActionIds]);
  const readySelected = repairPlan.actions.filter((action) =>
    action.readiness === "ready" && selected.has(action.id)
  );
  const confirmationKey = [
    repairPlan.evidenceFingerprint,
    readySelected.map((action) => JSON.stringify({
      id: action.id,
      kind: action.kind,
      evidenceFingerprint: action.evidenceFingerprint,
      objectIds: [...action.objectIds].sort(),
      detail: action.detail,
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
  const viewOrder: AssistantView[] = ["recommendations", "standards", "repair-plan", "history", "evidence"];

  const filtered = recommendations.filter((recommendation) => {
    if (filter === "critical") return !recommendation.resolved && recommendation.severity === "critical";
    if (filter === "open") return !recommendation.resolved;
    return true;
  });
  const active = filtered.find((recommendation) => recommendation.id === activeId) || filtered[0];
  const previewKey = active ? `${active.id}:${active.evidenceFingerprint}` : "";

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
    const nextPreviewKey = `${view}:${previewKey}`;
    if (previewKeyRef.current === nextPreviewKey) return;
    previewKeyRef.current = nextPreviewKey;
    onActiveRecommendationChange(view === "recommendations" ? active : undefined);
  }, [active, onActiveRecommendationChange, previewKey, view]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  function handleViewKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = viewOrder.indexOf(view);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? viewOrder.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + viewOrder.length) % viewOrder.length;
    const nextView = viewOrder[nextIndex];
    setView(nextView);
    requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>(`#assistant-tab-${nextView}`)?.focus()
    );
  }

  function performPrimaryAction(recommendation: MarkupRecommendation) {
    if (recommendation.action === "branch-pass") {
      onStartBranchPass();
      return;
    }
    if (recommendation.action === "sizing-review") {
      onOpenSizingReview();
      return;
    }
    if (recommendation.drawingId) {
      onFocusDrawing(recommendation.drawingId);
      return;
    }
    onOpenManualReview(recommendation);
  }

  function chooseMode(mode: RepairAutonomyMode) {
    onAutonomyModeChange(mode);
    if (mode !== "inspect") {
      if (!preparedEvidenceFingerprint || stale) onPrepareRepairPlan();
      setView("repair-plan");
    }
  }

  function toggleAction(action: RepairPlanAction) {
    if (action.readiness !== "ready") return;
    onSelectedActionIdsChange(
      selected.has(action.id)
        ? selectedActionIds.filter((id) => id !== action.id)
        : [...selectedActionIds, action.id],
    );
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
      setView("history");
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
            <h2 id="markup-assistant-title">Check the plan. Review fixes. Approve what changes.</h2>
            <p>{projectName} · {systemName}</p>
          </div>
        </div>
        <div className="markup-assistant-header-actions">
          <span><ShieldCheck size={14} /> {autonomyMode === "inspect" ? "CHECK ONLY" : autonomyMode === "prepare" ? "FIXES READY TO REVIEW" : "APPLY WITH FINAL CONFIRMATION"}</span>
          <button className="markup-assistant-close" aria-label="Close Plan Helper" onClick={onClose}><X size={20} /></button>
        </div>
      </header>

      <section className="assistant-mode-strip" aria-label="Assistant autonomy mode">
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
          <small>{stale ? "FIX LIST NEEDS REFRESHING" : autonomyMode === "inspect" ? "WHAT TO CHECK NEXT" : "CURRENT FIX LIST"}</small>
          <h3>{stale ? "The plan changed after calculation" : autonomyMode === "inspect" ? summary.headline : repairPlan.headline}</h3>
          <p>{stale
            ? "Refresh the fix list before applying. An outdated suggestion cannot change the drawing."
            : "The assistant can prepare and apply reviewed CFM, size, and fitting-port changes in one undoable batch. It creates no new route; any attached endpoint alignment is included in the reviewed object diff."}</p>
        </div>
        <button onClick={() => {
          if (stale) {
            onPrepareRepairPlan();
            setView("repair-plan");
          } else if (autonomyMode !== "inspect") {
            if (!preparedEvidenceFingerprint) onPrepareRepairPlan();
            setView("repair-plan");
          } else if (active) {
            performPrimaryAction(active);
          }
        }}>
          {stale ? "Refresh fixes" : autonomyMode === "inspect" ? "Check next" : "Review fixes"} <ArrowRight size={17} />
        </button>
      </section>

      <nav className="assistant-workspace-tabs" aria-label="Markup assistant views" role="tablist" onKeyDown={handleViewKeyDown}>
        {([
          ["recommendations", "Suggestions", recommendations.length],
          ["standards", "My HVAC Rules", designStandard.review + designStandard.blocked],
          ["repair-plan", "Review fixes", repairPlan.readyCount],
          ["history", "Undo history", repairRecords.length],
          ["evidence", "Plan source", advancedIntelligence?.coverage.length ?? 0],
        ] as Array<[AssistantView, string, number]>).map(([id, label, count]) => <button
          key={id}
          id={`assistant-tab-${id}`}
          className={view === id ? "active" : ""}
          role="tab"
          aria-selected={view === id}
          aria-controls={`assistant-panel-${id}`}
          tabIndex={view === id ? 0 : -1}
          onClick={() => setView(id)}
        >
          {label}<b>{count}</b>
        </button>)}
      </nav>

      <div className={`markup-assistant-body view-${view}`}>
        {view === "recommendations" && <>
          <aside className="markup-assistant-queue" aria-label="Recommendation queue">
            <div className="markup-assistant-filter" aria-label="Recommendation filters">
              {([
                ["open", "Open", recommendations.filter((row) => !row.resolved).length],
                ["critical", "Critical", recommendations.filter((row) => !row.resolved && row.severity === "critical").length],
                ["all", "All", recommendations.length],
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
                <span><small>{recommendation.category}</small><strong>{recommendation.title}</strong><em>{confidenceLabel(recommendation.confidence)} confidence · {recommendation.evidence[0]}</em></span>
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
                <div><small>{active.category} · {active.severity.toUpperCase()}</small><h3>{active.title}</h3></div>
                <span>{confidenceLabel(active.confidence)} evidence confidence</span>
              </div>
              {(active.decisionStale || stale) && <div className="markup-stale-warning"><AlertTriangle size={18} /><span><strong>Evidence changed.</strong> Refresh the plan before relying on this action.</span></div>}
              <section><small>OBSERVED CONDITION</small><p>{active.detail}</p></section>
              <section><small>WHY IT MATTERS</small><p>{active.whyItMatters}</p></section>
              <section className="markup-proposed-action"><small>PROPOSED REPAIR</small><p>{active.proposedAction}</p></section>
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
          {stale && <div className="repair-plan-stale" role="alert">
            <AlertTriangle size={20} />
            <span><strong>This repair plan is stale.</strong> Geometry or evidence changed after the plan was prepared.</span>
            <button onClick={onPrepareRepairPlan}><RefreshCw size={16} /> Refresh repair plan</button>
          </div>}
          <header className="repair-plan-heading">
            <div>
              <small>V113 GUIDED REPAIR PLAN</small>
              <h3>{repairPlan.headline}</h3>
              <p>Ready actions can be applied together. Input-dependent and topology-changing actions stay outside the batch.</p>
            </div>
            <div className="repair-plan-counts">
              <span><b>{repairPlan.readyCount}</b> ready</span>
              <span><b>{repairPlan.needsInputCount}</b> need input</span>
              <span><b>{repairPlan.planConfirmationCount + repairPlan.manualCount}</b> manual</span>
            </div>
          </header>

          <div className="repair-action-list">
            {repairPlan.actions.map((action) => <article
              key={action.id}
              className={`repair-action ${action.readiness} ${selected.has(action.id) ? "selected" : ""}`}
            >
              <button
                className="repair-action-select"
                aria-pressed={selected.has(action.id)}
                disabled={action.readiness !== "ready" || stale}
                onClick={() => toggleAction(action)}
              >
                <i>{action.readiness === "ready" && selected.has(action.id) ? <CheckCircle2 size={18} /> : actionIcon(action)}</i>
                <span>
                  <small>{readinessLabel(action)}</small>
                  <strong>{action.title} · {action.location}</strong>
                  <em>{action.detail}</em>
                </span>
                {action.readiness === "ready" && <b>{selected.has(action.id) ? "SELECTED" : "ADD"}</b>}
              </button>
              <div className="repair-action-evidence">
                {action.evidence.map((evidence) => <span key={evidence}><ShieldCheck size={13} /> {evidence}</span>)}
                {action.blocker && <p><AlertTriangle size={14} /> {action.blocker}</p>}
              </div>
              <div className="repair-action-actions">
                {action.objectIds[0] && <button onClick={() => onFocusDrawing(action.objectIds[0])}><Crosshair size={15} /> Show on plan</button>}
                {action.kind === "terminal-cfm" && action.readiness !== "ready" && <button onClick={onOpenSizingReview}><Gauge size={15} /> Review room CFM</button>}
                {action.kind === "run-size" && action.readiness !== "ready" && <button onClick={onOpenSizingReview}><Gauge size={15} /> Open sizing inputs</button>}
                {action.kind === "branch-junction" && (() => {
                  const recommendation = recommendations.find((row) =>
                    row.preview?.kind === "branch-junction" &&
                    row.preview.mainRunId === action.mainRunId &&
                    row.preview.branchRunId === action.branchRunId
                  );
                  return recommendation
                    ? <button onClick={() => onApplyRecommendation(recommendation)}><Route size={15} /> Confirm T/Y on plan</button>
                    : null;
                })()}
                {action.kind === "manual-follow-up" && (() => {
                  const recommendation = recommendations.find((row) => row.id === action.recommendationId);
                  return recommendation
                    ? <button onClick={() => onOpenManualReview(recommendation)}><ShieldCheck size={15} /> Open manual review</button>
                    : null;
                })()}
              </div>
            </article>)}
          </div>

          <section className="takeoff-delta-panel">
            <header>
              <div><small>V114 TAKEOFF IMPACT</small><h3>Before → after purchasing impact</h3></div>
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
          </section>

          <section className="repair-plan-approval">
            <div>
              <small>ONE CONTROLLED TRANSACTION</small>
              <h3>Apply {readySelected.length} selected repair{readySelected.length === 1 ? "" : "s"} · one Undo</h3>
              <p>Revalidation runs immediately before commit. A changed fingerprint applies zero actions.</p>
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
              <span>I reviewed the selected object diffs and understand this is a planning-screened repair.</span>
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
                ? "Choose Guided apply to enable the batch"
                : applying
                  ? "Revalidating and applying…"
                  : `Apply ${readySelected.length} selected repair${readySelected.length === 1 ? "" : "s"} · one Undo`}
            </button>
            <p className="repair-planning-notice">{repairPlan.planningNotice} Verify blower data, component losses, effective length, installed flex condition, and field airflow before release.</p>
          </section>
        </main>}

        {view === "history" && <main className="repair-history-workspace" role="tabpanel" id="assistant-panel-history" aria-labelledby="assistant-tab-history">
          <header>
            <div><small>V114 APPLICATION RECEIPTS</small><h3>Repair checkpoints and apply receipts</h3><p>Every applied batch preserves the evidence fingerprint, object list, calculation version, and takeoff impact.</p></div>
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
            <div><small>V115 ADVANCED PLAN INTELLIGENCE</small><h3>Evidence coverage before automation</h3><p>The assistant shows what is source-backed and what still requires OCR, visual confirmation, or a reviewed schedule value.</p></div>
            <button onClick={onOpenPlanIntelligence}><FileSearch size={16} /> Open full plan intelligence</button>
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
          </> : <div className="markup-assistant-clear"><FileSearch size={36} /><h3>Run Advanced Plan Intelligence</h3><p>Analyze the loaded PDF to add sheet coverage, exact text regions, OCR gaps, and source relationships to this repair plan.</p><button onClick={onOpenPlanIntelligence}>Analyze plan evidence</button></div>}
        </main>}
      </div>

      <footer className="markup-assistant-footer">
        <ShieldCheck size={18} />
        <span><strong>Planning mode.</strong> The assistant may resize eligible connected runs and synchronize fitting ports only after one final batch approval. It never invents CFM from diameter, moves walls or equipment, draws a new route, or connects zones; attached endpoints may align only when listed in the reviewed diff.</span>
        <button onClick={onClose}>Return to plan</button>
      </footer>
    </section>
  </div>;
}
