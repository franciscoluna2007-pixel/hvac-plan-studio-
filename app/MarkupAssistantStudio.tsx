"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  Gauge,
  Route,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  type MarkupAssistantSummary,
  type MarkupRecommendation,
} from "./markupAssistant";

type RecommendationFilter = "open" | "critical" | "all";

type Props = {
  open: boolean;
  projectName: string;
  systemName: string;
  recommendations: MarkupRecommendation[];
  summary: MarkupAssistantSummary;
  onClose: () => void;
  onFocusDrawing: (drawingId: string) => void;
  onOpenManualReview: (recommendation: MarkupRecommendation) => void;
  onStartBranchPass: () => void;
  onOpenSizingReview: () => void;
  onActiveRecommendationChange: (recommendation?: MarkupRecommendation) => void;
  onApplyRecommendation: (recommendation: MarkupRecommendation) => void;
};

type AssistantDecision = {
  status: "approved" | "rejected";
  evidenceFingerprint: string;
};

function confidenceLabel(value: number) {
  if (value >= .95) return "Very high";
  if (value >= .88) return "High";
  if (value >= .78) return "Moderate";
  return "Review";
}

export default function MarkupAssistantStudio({
  open,
  projectName,
  systemName,
  recommendations,
  summary,
  onClose,
  onFocusDrawing,
  onOpenManualReview,
  onStartBranchPass,
  onOpenSizingReview,
  onActiveRecommendationChange,
  onApplyRecommendation,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previewKeyRef = useRef("");
  const [filter, setFilter] = useState<RecommendationFilter>("open");
  const [activeId, setActiveId] = useState("");
  const [decisions, setDecisions] = useState<Record<string, AssistantDecision>>({});

  const currentDecision = (recommendation: MarkupRecommendation) => {
    const decision = decisions[recommendation.id];
    return decision?.evidenceFingerprint === recommendation.evidenceFingerprint
      ? decision
      : undefined;
  };
  const isOpen = (recommendation: MarkupRecommendation) =>
    !recommendation.resolved && !currentDecision(recommendation);
  const sessionSummary = (() => {
    const openRows = recommendations.filter(isOpen);
    const critical = openRows.filter((row) => row.severity === "critical").length;
    const warnings = openRows.filter((row) => row.severity === "warning").length;
    return {
      ...summary,
      open: openRows.length,
      critical,
      warnings,
      headline: critical
        ? `${critical} condition${critical === 1 ? "" : "s"} block release until corrected or documented`
        : warnings
          ? `${warnings} recommendation${warnings === 1 ? "" : "s"} need your review`
          : openRows.length
            ? `${openRows.length} advisory markup opportunit${openRows.length === 1 ? "y" : "ies"} ready`
            : "This review session is complete",
    };
  })();
  const filtered = recommendations.filter((recommendation) => {
    if (filter === "open") return isOpen(recommendation);
    if (filter === "critical") return isOpen(recommendation) && recommendation.severity === "critical";
    return true;
  });
  const active = filtered.find((recommendation) => recommendation.id === activeId) || filtered[0];
  const activeDecision = active ? currentDecision(active) : undefined;
  const activeDecisionStale = Boolean(
    active &&
    decisions[active.id] &&
    decisions[active.id].evidenceFingerprint !== active.evidenceFingerprint
  );
  const previewKey = active ? `${active.id}:${active.evidenceFingerprint}` : "";
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>(".markup-assistant-close")?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (previewKeyRef.current === previewKey) return;
    previewKeyRef.current = previewKey;
    onActiveRecommendationChange(active);
  }, [active, onActiveRecommendationChange, previewKey]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
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
          <span><Sparkles size={21} /></span>
          <div>
            <small>INTELLIGENT HVAC MARKUP ASSISTANT · V111</small>
            <h2 id="markup-assistant-title">Review the evidence. You decide what changes.</h2>
            <p>{projectName} · {systemName}</p>
          </div>
        </div>
        <div className="markup-assistant-header-actions">
          <span><ShieldCheck size={13} /> APPROVAL REQUIRED</span>
          <button className="markup-assistant-close" aria-label="Close Intelligent Markup Assistant" onClick={onClose}><X size={19} /></button>
        </div>
      </header>

      <section className="markup-assistant-command">
        <div className={`markup-assistant-score ${sessionSummary.critical ? "critical" : sessionSummary.warnings ? "attention" : "clear"}`}>
          <strong>{sessionSummary.score}</strong>
          <span>PLAN<br />SCORE</span>
        </div>
        <div>
          <small>NEXT REVIEW ACTION</small>
          <h3>{sessionSummary.headline}</h3>
          <p>Every recommendation is evidence-bound, individually reviewable, and reversible. The assistant never moves walls, reroutes duct, connects zones, or changes a diameter on its own.</p>
        </div>
        {active && <button onClick={() => performPrimaryAction(active)}>
          Review next <ArrowRight size={16} />
        </button>}
      </section>

      <section className="markup-assistant-metrics" aria-label="Markup assistant summary">
        <article><small>OPEN RECOMMENDATIONS</small><strong>{sessionSummary.open}</strong><span>need a person</span></article>
        <article className={sessionSummary.critical ? "critical" : ""}><small>CRITICAL CONDITIONS</small><strong>{sessionSummary.critical}</strong><span>drawing must change</span></article>
        <article className={sessionSummary.sizingCandidates ? "attention" : ""}><small>SIZE CANDIDATES</small><strong>{sessionSummary.sizingCandidates}</strong><span>reviewed apply only</span></article>
        <article><small>T/Y OPPORTUNITIES</small><strong>{sessionSummary.branchOpportunities}</strong><span>existing runs only</span></article>
      </section>

      <div className="markup-assistant-body">
        <aside className="markup-assistant-queue" aria-label="Recommendation queue">
          <div className="markup-assistant-filter" aria-label="Recommendation filters">
            {([
              ["open", "Open", recommendations.filter(isOpen).length],
              ["critical", "Critical", recommendations.filter((row) => isOpen(row) && row.severity === "critical").length],
              ["all", "All", recommendations.length],
            ] as Array<[RecommendationFilter, string, number]>).map(([id, label, count]) => <button
              key={id}
              aria-pressed={filter === id}
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
            >{label}<b>{count}</b></button>)}
          </div>
          <div className="markup-assistant-list">
            {filtered.map((recommendation) => {
              const decision = currentDecision(recommendation);
              return <button
              key={recommendation.id}
              className={`${recommendation.severity} ${active?.id === recommendation.id ? "active" : ""} ${recommendation.resolved || decision ? "resolved" : ""}`}
              aria-pressed={active?.id === recommendation.id}
              onClick={() => setActiveId(recommendation.id)}
            >
              <i>{recommendation.resolved || decision ? <CheckCircle2 size={14} /> : recommendation.severity === "critical" ? <AlertTriangle size={14} /> : recommendation.category === "Duct sizing" ? <Gauge size={14} /> : recommendation.category === "Branch strategy" ? <Route size={14} /> : <Crosshair size={14} />}</i>
              <span><small>{recommendation.category}</small><strong>{recommendation.title}</strong><em>{decision ? `${decision.status} this session · ` : recommendation.resolved ? "resolved · " : ""}{confidenceLabel(recommendation.confidence)} confidence · {recommendation.evidence[0]}</em></span>
              <ChevronRight size={15} />
            </button>;
            })}
            {!filtered.length && <div className="markup-assistant-empty">
              <CheckCircle2 size={26} />
              <strong>No recommendations in this view</strong>
              <span>The current plan evidence does not produce a matching review item.</span>
            </div>}
          </div>
        </aside>

        <main className="markup-assistant-detail">
          {active ? <>
            <div className="markup-detail-heading">
              <div>
                <small>{active.category} · {active.severity.toUpperCase()}</small>
                <h3>{active.title}</h3>
              </div>
              <span>{confidenceLabel(active.confidence)} evidence confidence</span>
            </div>
            {(active.decisionStale || activeDecisionStale) && <div className="markup-stale-warning"><AlertTriangle size={16} /><span><strong>Evidence changed.</strong> Review this recommendation again before relying on the prior decision.</span></div>}
            {activeDecision && <div className={`markup-decision-state ${activeDecision.status}`} role="status" aria-live="polite" aria-atomic="true">
              {activeDecision.status === "approved" ? <CheckCircle2 size={16} /> : <X size={16} />}
              <span><strong>{activeDecision.status === "approved" ? "Approved for the next manual step" : "Rejected from this review session"}</strong> The plan is still unchanged.</span>
            </div>}
            <section>
              <small>OBSERVED CONDITION</small>
              <p>{active.detail}</p>
            </section>
            <section>
              <small>WHY IT MATTERS</small>
              <p>{active.whyItMatters}</p>
            </section>
            <section className="markup-proposed-action">
              <small>SAFE PROPOSED ACTION</small>
              <p>{active.proposedAction}</p>
            </section>
            <section>
              <small>EVIDENCE USED</small>
              <ul>{active.evidence.map((evidence) => <li key={evidence}><ShieldCheck size={12} /> {evidence}</li>)}</ul>
            </section>
            <div className="markup-detail-actions">
              {active.drawingId && <button onClick={() => onFocusDrawing(active.drawingId!)}><Crosshair size={15} /> Show on plan</button>}
              <button onClick={() => onOpenManualReview(active)}><ShieldCheck size={15} /> Open decision record</button>
              {activeDecision?.status !== "approved" && <button className="approve" onClick={() => setDecisions((current) => ({
                ...current,
                [active.id]: { status: "approved", evidenceFingerprint: active.evidenceFingerprint },
              }))}><CheckCircle2 size={15} /> Approve suggestion</button>}
              {activeDecision?.status !== "rejected" && <button className="reject" onClick={() => setDecisions((current) => ({
                ...current,
                [active.id]: { status: "rejected", evidenceFingerprint: active.evidenceFingerprint },
              }))}><X size={15} /> Reject</button>}
              {activeDecision?.status === "approved" && <button className="primary" onClick={() => {
                if (active.action === "branch-pass") onApplyRecommendation(active);
                else performPrimaryAction(active);
              }}>
                {active.action === "branch-pass" ? "Confirm approved T/Y on plan" : active.action === "sizing-review" ? "Open checked sizing workflow" : active.drawingId ? "Inspect approved object" : "Continue approved review"}
                <ArrowRight size={15} />
              </button>}
              {activeDecision && <button onClick={() => setDecisions((current) => {
                const next = { ...current };
                delete next[active.id];
                return next;
              })}>Reopen</button>}
            </div>
          </> : <div className="markup-assistant-clear">
            <ShieldCheck size={34} />
            <h3>The plan review queue is clear</h3>
            <p>Rerun the assistant after changing geometry, scheduled CFM, equipment, room assignments, or sizing rules.</p>
          </div>}
        </main>
      </div>

      <footer className="markup-assistant-footer">
        <ShieldCheck size={16} />
        <span><strong>Manual geometry remains authoritative.</strong> Suggestions never become drawing objects until you use the existing manual tools or approve an available reviewed change.</span>
        <button onClick={onClose}>Return to plan</button>
      </footer>
    </section>
  </div>;
}
