"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  DraftingCompass,
  FileCheck2,
  Gauge,
  Route,
  ShieldCheck,
  Sparkles,
  Wind,
  X,
} from "lucide-react";
import {
  findingRecommendedAction,
  findingWhyItMatters,
  summarizePlanFindings,
  type PlanFindingCategory,
  type PlanIntelligenceFinding,
} from "./planIntelligence";

type Props = {
  open: boolean;
  projectName: string;
  systemName: string;
  findings: PlanIntelligenceFinding[];
  releaseStatus: string;
  releaseReady: boolean;
  scaleVerified: boolean;
  onClose: () => void;
  onOpenFinding: (finding: PlanIntelligenceFinding) => void;
  onOpenEngineering: () => void;
  onComposePackage: () => void;
};

const categoryIcons: Record<PlanFindingCategory, typeof Route> = {
  Connections: Route,
  Airflow: Wind,
  "Duct sizing": Gauge,
  "Return paths": DraftingCompass,
  Coordination: ShieldCheck,
};

export default function PlanIntelligencePanel({
  open,
  projectName,
  systemName,
  findings,
  releaseStatus,
  releaseReady,
  scaleVerified,
  onClose,
  onOpenFinding,
  onOpenEngineering,
  onComposePackage,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const [category, setCategory] = useState<"All" | PlanFindingCategory>("All");
  const [selectedId, setSelectedId] = useState("");
  const summary = useMemo(() => summarizePlanFindings(findings), [findings]);
  const visible = useMemo(
    () => findings
      .filter((finding) => category === "All" || finding.category === category)
      .sort((left, right) =>
        Number(left.resolved) - Number(right.resolved) ||
        ({ critical: 0, warning: 1, info: 2 }[left.severity] -
          { critical: 0, warning: 1, info: 2 }[right.severity]) ||
        left.title.localeCompare(right.title)),
    [category, findings],
  );
  const active = visible.find((finding) => finding.id === selectedId) || visible[0];
  const nextFindingId = summary.nextFinding?.id || findings[0]?.id || "";

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = requestAnimationFrame(() => {
      setCategory("All");
      panelRef.current?.querySelector<HTMLElement>("button, [href], input, select, textarea")?.focus();
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    const selectionFrame = requestAnimationFrame(() => setSelectedId((current) =>
      justOpened || !current || !findings.some((finding) => finding.id === current)
        ? nextFindingId
        : current
    ));
    return () => cancelAnimationFrame(selectionFrame);
  }, [findings, nextFindingId, open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) || [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <div className="plan-intelligence-overlay" role="presentation">
    <button className="plan-intelligence-dismiss" aria-label="Close Plan Intelligence" tabIndex={-1} aria-hidden="true" onClick={onClose} />
    <section
      ref={panelRef}
      className="plan-intelligence-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-intelligence-title"
      onKeyDown={handleKeyDown}
    >
      <header className="plan-intelligence-header">
        <div className="plan-intelligence-brand">
          <span><Sparkles size={19} /></span>
          <div>
            <small>PLAN INTELLIGENCE · V102</small>
            <h2 id="plan-intelligence-title">Explainable HVAC review</h2>
            <p>{projectName} · {systemName}</p>
          </div>
        </div>
        <div className="plan-intelligence-header-actions">
          <span className={releaseReady ? "ready" : "hold"}><i /> {releaseStatus}</span>
          <button aria-label="Close Plan Intelligence" onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      <div className="plan-intelligence-command">
        <div className={`plan-score-ring ${summary.critical ? "critical" : summary.warnings ? "warning" : "clear"}`}>
          <strong>{summary.score}</strong><span>READINESS</span>
        </div>
        <div>
          <small>NEXT SAFE ACTION</small>
          <strong>{summary.headline}</strong>
          <p>{summary.nextFinding?.title || "Review the release package and issue a named revision when every gate is clear."}</p>
        </div>
        <button
          disabled={!summary.nextFinding}
          onClick={() => summary.nextFinding && onOpenFinding(summary.nextFinding)}
        >
          {summary.nextFinding ? "Open next finding" : "Review release"}
          <ArrowRight size={15} />
        </button>
      </div>

      <div className="plan-intelligence-metrics">
        <article className="critical"><AlertTriangle size={17} /><div><small>CRITICAL</small><strong>{summary.critical}</strong></div><span>Must fix</span></article>
        <article className="warning"><ShieldCheck size={17} /><div><small>WARNINGS</small><strong>{summary.warnings}</strong></div><span>Review</span></article>
        <article className="resolved"><CheckCircle2 size={17} /><div><small>DOCUMENTED</small><strong>{summary.resolved}</strong></div><span>Current evidence</span></article>
        <article className={scaleVerified ? "resolved" : "warning"}><DraftingCompass size={17} /><div><small>DRAWING SCALE</small><strong>{scaleVerified ? "VERIFIED" : "DRAFT"}</strong></div><span>{scaleVerified ? "Measured output enabled" : "Verify before release"}</span></article>
      </div>

      <nav className="plan-intelligence-categories" aria-label="Finding categories">
        <button className={category === "All" ? "active" : ""} onClick={() => setCategory("All")}>
          All <b>{summary.total}</b>
        </button>
        {summary.categories.map((item) => {
          const Icon = categoryIcons[item.category];
          return <button
            className={category === item.category ? "active" : ""}
            key={item.category}
            onClick={() => setCategory(item.category)}
          >
            <Icon size={14} /> {item.category} <b>{item.open}</b>
          </button>;
        })}
      </nav>

      <div className="plan-intelligence-workspace">
        <section className="plan-finding-queue" aria-label="Prioritized HVAC findings">
          <div className="plan-finding-queue-heading">
            <div><strong>PRIORITIZED FINDINGS</strong><small>{visible.filter((finding) => !finding.resolved).length} open in this view</small></div>
            <span>Review-only</span>
          </div>
          <div className="plan-finding-list">
            {visible.length ? visible.map((finding) => <button
              className={`${finding.severity} ${finding.resolved ? "resolved" : ""} ${active?.id === finding.id ? "active" : ""}`}
              key={finding.id}
              onClick={() => setSelectedId(finding.id)}
            >
              <i>{finding.resolved ? <CheckCircle2 size={15} /> : finding.severity === "info" ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}</i>
              <span><small>{finding.reference} · {finding.category}</small><strong>{finding.title}</strong><em>{finding.detail}</em></span>
              {finding.decisionStale ? <b>STALE</b> : finding.resolved ? <b>DONE</b> : <b>{finding.severity.toUpperCase()}</b>}
            </button>) : <div className="plan-intelligence-empty"><CheckCircle2 size={28} /><strong>No findings in this category</strong><span>Choose another category or continue to the takeoff package.</span></div>}
          </div>
        </section>

        <aside className="plan-finding-evidence">
          {active ? <>
            <div className="finding-evidence-heading">
              <span className={active.severity}>{active.severity === "info" ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}</span>
              <div><small>{active.reference} · {active.category}</small><strong>{active.title}</strong></div>
              <b className={active.resolved ? "resolved" : active.severity}>{active.resolved ? "DOCUMENTED" : active.severity.toUpperCase()}</b>
            </div>
            {active.decisionStale && <div className="finding-stale-notice"><AlertTriangle size={15} /> Drawing evidence changed after the recorded decision. Review it again.</div>}
            <dl>
              <div><dt>WHAT WAS DETECTED</dt><dd>{active.detail}</dd></div>
              <div><dt>WHY IT MATTERS</dt><dd>{findingWhyItMatters(active)}</dd></div>
              <div><dt>RECOMMENDED MANUAL ACTION</dt><dd>{findingRecommendedAction(active)}</dd></div>
              <div><dt>EVIDENCE ID</dt><dd>{active.evidenceFingerprint.replace("evidence-", "").toUpperCase()}</dd></div>
            </dl>
            <button className="show-finding-on-plan" onClick={() => onOpenFinding(active)}>
              <Crosshair size={16} /> {active.drawingId ? "Show on plan & open review" : "Open review record"}
            </button>
          </> : <div className="plan-intelligence-empty"><CheckCircle2 size={30} /><strong>Plan review clear</strong><span>No finding is selected.</span></div>}
          <div className="manual-geometry-policy">
            <FileCheck2 size={17} />
            <div><strong>Manual geometry stays manual.</strong><span>This workspace never reroutes, resizes, reconnects, balances, numbers, or creates ductwork automatically.</span></div>
          </div>
        </aside>
      </div>

      <footer className="plan-intelligence-footer">
        <div><i /><span><strong>{releaseReady ? "Package gates are clear" : `${summary.open} review item${summary.open === 1 ? "" : "s"} remain`}</strong><small>Every recommendation is traceable and reversible.</small></span></div>
        <button onClick={onOpenEngineering}><Gauge size={15} /> Engineering detail</button>
        <button className="primary" onClick={onComposePackage}><FileCheck2 size={15} /> Compose takeoff package</button>
      </footer>
    </section>
  </div>;
}
