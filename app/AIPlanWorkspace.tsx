"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cloud,
  Download,
  Eye,
  FileSearch,
  Filter,
  Layers3,
  ListChecks,
  LoaderCircle,
  MapPin,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  X,
  XCircle,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  analyzeHvacPlan,
  updatePlanFindingDecision,
  type PlanAnalysis,
  type PlanEvidenceCategory,
  type PlanFindingDecision,
  type PlanReaderFinding,
} from "./planReader";
import { trackProductEvent } from "./productAnalytics";

type WorkspaceView = "overview" | "sheets" | "evidence" | "findings" | "takeoff";

type Props = {
  open: boolean;
  initialView?: "reader" | "findings";
  pdf: PDFDocumentProxy | null;
  sourceFingerprint: string;
  sourceFileName: string;
  projectName: string;
  onClose: () => void;
  onShowPage: (page: number) => void;
  onPrepareMarkup: (page: number, note?: string) => void;
  cloudProjectConnected?: boolean;
  onOpenCloudWorkspace?: () => void;
  onAnalysisChange?: (analysis: PlanAnalysis) => void | Promise<void>;
  onFindingDecision?: (
    analysis: PlanAnalysis,
    finding: PlanReaderFinding,
    decision: PlanFindingDecision,
    note: string,
  ) => void | Promise<void>;
};

const categoryOptions: Array<"All" | PlanEvidenceCategory> = [
  "All",
  "Equipment",
  "Ductwork",
  "Air devices",
  "Airflow",
  "Fresh air",
  "Controls",
  "Schedules",
  "Notes",
];

const severityRank = { critical: 0, warning: 1, info: 2 };

function confidenceLabel(value: number) {
  if (value >= 0.9) return "High";
  if (value >= 0.8) return "Review";
  return "Low";
}

function confidencePercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function AIPlanWorkspace({
  open,
  initialView = "reader",
  pdf,
  sourceFingerprint,
  sourceFileName,
  projectName,
  onClose,
  onShowPage,
  onPrepareMarkup,
  cloudProjectConnected = false,
  onOpenCloudWorkspace,
  onAnalysisChange,
  onFindingDecision,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null);
  const [view, setView] = useState<WorkspaceView>("overview");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | PlanEvidenceCategory>("All");
  const [findingId, setFindingId] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setAnalysis(null);
      setError("");
      setProgress({ completed: 0, total: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [sourceFingerprint]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = requestAnimationFrame(() => {
      setView(initialView === "findings" ? "findings" : "overview");
      panelRef.current?.querySelector<HTMLElement>("button, input, select")?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [initialView, open]);

  const visibleEvidence = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (analysis?.evidence || []).filter((row) => {
      if (category !== "All" && row.category !== category) return false;
      return !normalized || `${row.label} ${row.value} ${row.sheetNumber} ${row.excerpt}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [analysis, category, query]);

  const sortedFindings = useMemo(
    () => [...(analysis?.findings || [])].sort((left, right) =>
      Number(left.decision !== "open") - Number(right.decision !== "open") ||
      severityRank[left.severity] - severityRank[right.severity] ||
      left.title.localeCompare(right.title)
    ),
    [analysis],
  );
  const activeFinding = sortedFindings.find((finding) => finding.id === findingId) || sortedFindings[0];
  const evidenceById = useMemo(
    () => new Map((analysis?.evidence || []).map((row) => [row.id, row])),
    [analysis],
  );

  if (!open) return null;

  async function runAnalysis() {
    if (!pdf) return;
    const startedAt = performance.now();
    void trackProductEvent("ai_analysis_started", { page_count: pdf.numPages });
    setRunning(true);
    setError("");
    setProgress({ completed: 0, total: pdf.numPages });
    try {
      const result = await analyzeHvacPlan({
        pdf,
        sourceFingerprint,
        sourceFileName,
        onProgress: (completed, total) => setProgress({ completed, total }),
      });
      setAnalysis(result);
      setFindingId(result.findings[0]?.id || "");
      void trackProductEvent("ai_analysis_completed", {
        page_count: result.pageCount,
        finding_count: result.findings.length,
        takeoff_rows: result.takeoff.length,
        duration_ms: Math.round(performance.now() - startedAt),
      });
      try {
        await onAnalysisChange?.(result);
      } catch {
        setError("The analysis finished in this browser, but its cloud copy could not be updated.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The plan reader could not analyze this PDF.");
      void trackProductEvent("ai_analysis_failed", {
        page_count: pdf.numPages,
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } finally {
      setRunning(false);
    }
  }

  async function decide(decision: PlanFindingDecision) {
    if (!analysis || !activeFinding) return;
    const next = updatePlanFindingDecision(analysis, activeFinding.id, decision, decisionNote);
    setAnalysis(next);
    setSavingDecision(true);
    try {
      await onFindingDecision?.(next, activeFinding, decision, decisionNote);
      setDecisionNote("");
      void trackProductEvent("finding_decided", {
        decision,
        severity: activeFinding.severity,
      });
    } finally {
      setSavingDecision(false);
    }
  }

  function showSource(page: number) {
    onShowPage(page);
    onClose();
  }

  function exportTakeoff() {
    if (!analysis) return;
    const rows = [
      ["Category", "Item", "Quantity", "Pages", "Confidence", "Review required"],
      ...analysis.takeoff.map((row) => [
        row.category,
        row.item,
        row.quantity,
        row.pages.join(" "),
        confidencePercent(row.confidence),
        row.reviewRequired ? "Yes" : "No",
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sourceFileName.replace(/\.pdf$/i, "") || "hvac-plan"}-ai-takeoff.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    void trackProductEvent("takeoff_exported", {
      format: "csv",
      item_count: analysis.takeoff.length,
      source: "ai_reader",
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

  return <div className="ai-plan-overlay" role="presentation">
    <button className="ai-plan-dismiss" aria-label="Close AI Plan Reader" onClick={onClose} />
    <section
      ref={panelRef}
      className="ai-plan-workspace"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-plan-title"
      onKeyDown={handleKeyDown}
    >
      <header className="ai-plan-header">
        <div className="ai-plan-brand">
          <span><ScanSearch size={22} /></span>
          <div>
            <small>HVAC PLAN STUDIO · V105 + V106</small>
            <h2 id="ai-plan-title">AI Plan Reader</h2>
            <p>{projectName} · {sourceFileName || "No plan loaded"}</p>
          </div>
        </div>
        <div className="ai-plan-header-actions">
          <span className="ai-human-control"><ShieldCheck size={14} /> Human-controlled</span>
          <button aria-label="Close AI Plan Reader" onClick={onClose}><X size={19} /></button>
        </div>
      </header>

      <div className="ai-plan-policy">
        <Sparkles size={15} />
        <span><strong>AI proposes. You approve.</strong> Findings include source evidence and confidence. Nothing is drawn, resized, or changed automatically.</span>
      </div>

      {!analysis ? <div className="ai-plan-start">
        <section>
          <span className="ai-reader-orbit"><ScanSearch size={34} /></span>
          <small>PLAN READING PIPELINE</small>
          <h3>Turn the plan set into reviewable HVAC intelligence.</h3>
          <p>The reader classifies sheets, extracts HVAC evidence, prepares a draft takeoff, and flags plan issues without changing your drawing.</p>
          <div className="ai-plan-capabilities">
            <article><Layers3 size={18} /><strong>Classify sheets</strong><span>Find mechanical plans, schedules, and coordination sheets.</span></article>
            <article><FileSearch size={18} /><strong>Extract evidence</strong><span>Equipment, CFM, duct sizes, air devices, controls, and notes.</span></article>
            <article><ListChecks size={18} /><strong>Explain findings</strong><span>Every issue links back to the source page and extracted text.</span></article>
            <article><Table2 size={18} /><strong>Draft takeoff</strong><span>Reviewable quantities with confidence and source-sheet coverage.</span></article>
          </div>
          {error && <div className="ai-plan-error"><AlertTriangle size={16} /> {error}</div>}
          <button className="ai-analyze-button" disabled={!pdf || running} onClick={runAnalysis}>
            {running ? <LoaderCircle className="spin" size={18} /> : <ScanSearch size={18} />}
            {running ? `Reading page ${progress.completed} of ${progress.total}` : "Analyze this plan set"}
            {!running && <ArrowRight size={17} />}
          </button>
          {!pdf && <small className="ai-plan-no-source">Open a plan PDF before starting analysis.</small>}
          {running && <div className="ai-plan-progress"><i style={{ width: `${progress.total ? progress.completed / progress.total * 100 : 0}%` }} /></div>}
        </section>
        <aside>
          <small>WHAT THE READER CHECKS</small>
          {[
            ["01", "Source quality", "Readable sheets and OCR gaps"],
            ["02", "HVAC systems", "Tags, tonnage, CFM, and schedules"],
            ["03", "Air distribution", "Supply, return, duct, and device evidence"],
            ["04", "Fresh air + controls", "OA references, dampers, thermostats, smoke detection"],
            ["05", "Takeoff confidence", "Items requiring visual confirmation"],
          ].map(([number, title, detail]) => <div key={number}><b>{number}</b><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={15} /></div>)}
        </aside>
      </div> : <>
        <nav className="ai-plan-tabs" aria-label="AI Plan Reader views">
          {([
            ["overview", "Overview", Sparkles],
            ["sheets", "Sheets", Layers3],
            ["evidence", "Evidence", FileSearch],
            ["findings", "Findings", ListChecks],
            ["takeoff", "Takeoff", Table2],
          ] as const).map(([id, label, Icon]) => <button
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={15} /> {label}
            {id === "findings" && <b>{analysis.summary.openFindings}</b>}
          </button>)}
          <button className="ai-rerun" onClick={runAnalysis} disabled={running}>
            {running ? <LoaderCircle className="spin" size={14} /> : <ScanSearch size={14} />} Reanalyze
          </button>
        </nav>

        <section className={`ai-cloud-value-card ${cloudProjectConnected ? "connected" : ""}`}>
          <span><Cloud size={18} /></span>
          <div>
            <small>{cloudProjectConnected ? "CLOUD PROJECT CONNECTED" : "KEEP THE VALUE YOU JUST CREATED"}</small>
            <strong>{cloudProjectConnected ? "This analysis can stay with the project." : "Save findings, decisions, markup, and the draft takeoff for the next revision."}</strong>
            <p>{cloudProjectConnected ? "Named revisions preserve the source plan and its reviewed intelligence across devices." : "The current analysis remains in this browser. A free workspace lets you return to it and continue on another device."}</p>
          </div>
          {!cloudProjectConnected && onOpenCloudWorkspace && <button onClick={onOpenCloudWorkspace}>Save with a cloud project <ArrowRight size={14} /></button>}
        </section>

        <div className="ai-plan-body">
          {view === "overview" && <div className="ai-overview">
            <section className="ai-overview-hero">
              <div>
                <small>PLAN INTELLIGENCE SUMMARY</small>
                <h3>{analysis.summary.openFindings
                  ? `${analysis.summary.openFindings} item${analysis.summary.openFindings === 1 ? "" : "s"} need your review`
                  : "The automated review has no open findings"}</h3>
                <p>{analysis.summary.mechanicalSheets} HVAC-related sheet{analysis.summary.mechanicalSheets === 1 ? "" : "s"} identified across {analysis.pageCount} pages. Results remain draft until you confirm them.</p>
              </div>
              <span className="ai-confidence-ring"><strong>{Math.round(analysis.summary.averageConfidence * 100)}</strong><small>AVG CONFIDENCE</small></span>
            </section>
            <div className="ai-metric-grid">
              <article><Layers3 size={17} /><small>HVAC SHEETS</small><strong>{analysis.summary.mechanicalSheets}</strong><span>{analysis.summary.readableSheets} readable</span></article>
              <article><FileSearch size={17} /><small>EVIDENCE</small><strong>{analysis.evidence.length}</strong><span>source-linked</span></article>
              <article><ListChecks size={17} /><small>OPEN FINDINGS</small><strong>{analysis.summary.openFindings}</strong><span>need a decision</span></article>
              <article><Table2 size={17} /><small>TAKEOFF ROWS</small><strong>{analysis.takeoff.length}</strong><span>draft quantities</span></article>
            </div>
            <div className="ai-overview-grid">
              <section className="ai-overview-card">
                <header><span><ListChecks size={16} /> Priority findings</span><button onClick={() => setView("findings")}>Review all <ArrowRight size={13} /></button></header>
                {sortedFindings.slice(0, 4).map((finding) => <button
                  className={`ai-overview-finding ${finding.severity}`}
                  key={finding.id}
                  onClick={() => { setFindingId(finding.id); setView("findings"); }}
                >
                  <i>{finding.severity === "critical" ? <XCircle size={15} /> : finding.severity === "warning" ? <AlertTriangle size={15} /> : <CircleHelp size={15} />}</i>
                  <span><strong>{finding.title}</strong><small>{finding.detail}</small></span>
                  <b>{finding.decision === "open" ? finding.severity : finding.decision}</b>
                </button>)}
                {!sortedFindings.length && <div className="ai-plan-clear"><CheckCircle2 size={24} /><strong>No automated findings</strong><span>Continue with a visual review before accepting the takeoff.</span></div>}
              </section>
              <section className="ai-overview-card">
                <header><span><FileSearch size={16} /> Extracted plan signals</span><button onClick={() => setView("evidence")}>Open evidence <ArrowRight size={13} /></button></header>
                {[
                  ["Equipment", analysis.summary.equipment],
                  ["Duct sizes", analysis.summary.ductSizes],
                  ["Air devices", analysis.summary.airDevices],
                  ["Schedules", analysis.evidence.filter((row) => row.category === "Schedules").length],
                ].map(([label, count]) => <div className="ai-signal-row" key={String(label)}><span>{label}</span><b>{count}</b></div>)}
              </section>
            </div>
          </div>}

          {view === "sheets" && <div className="ai-table-view">
            <header><div><small>SHEET CLASSIFICATION</small><h3>Plan set map</h3><p>Use the reader’s classifications to move directly to HVAC-relevant sheets.</p></div></header>
            <div className="ai-data-table ai-sheet-table">
              <div className="ai-table-head"><span>Sheet</span><span>Classification</span><span>Text</span><span>Confidence</span><span /></div>
              {analysis.pages.map((page) => <div className="ai-table-row" key={page.page}>
                <span><b>{page.sheetNumber}</b><small>PDF page {page.page}</small></span>
                <span><strong>{page.title}</strong><small>{page.classification}</small></span>
                <span className={page.readable ? "status-good" : "status-review"}>{page.readable ? "Readable" : "Needs OCR"}</span>
                <span><i className="ai-confidence-bar"><em style={{ width: confidencePercent(page.confidence) }} /></i><small>{confidencePercent(page.confidence)}</small></span>
                <button onClick={() => showSource(page.page)}><Eye size={14} /> Open sheet</button>
              </div>)}
            </div>
          </div>}

          {view === "evidence" && <div className="ai-table-view">
            <header className="ai-evidence-header">
              <div><small>SOURCE EVIDENCE</small><h3>What the reader found</h3><p>Every extracted value keeps its sheet, excerpt, and confidence.</p></div>
              <div className="ai-evidence-tools">
                <label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search evidence…" /></label>
                <label><Filter size={14} /><select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categoryOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
              </div>
            </header>
            <div className="ai-data-table ai-evidence-table">
              <div className="ai-table-head"><span>Evidence</span><span>Source excerpt</span><span>Confidence</span><span /></div>
              {visibleEvidence.map((row) => <div className="ai-table-row" key={row.id}>
                <span><b>{row.value}</b><small>{row.category} · {row.label}</small></span>
                <span><strong>{row.excerpt}</strong><small>{row.sheetNumber} · PDF page {row.page}</small></span>
                <span className={`confidence-${confidenceLabel(row.confidence).toLowerCase()}`}><b>{confidenceLabel(row.confidence)}</b><small>{confidencePercent(row.confidence)}</small></span>
                <button onClick={() => showSource(row.page)}><MapPin size={14} /> Show source</button>
              </div>)}
              {!visibleEvidence.length && <div className="ai-empty-table"><FileSearch size={24} /><strong>No evidence matches this filter</strong><span>Clear the search or choose another category.</span></div>}
            </div>
          </div>}

          {view === "findings" && <div className="ai-findings-view">
            <section className="ai-finding-queue">
              <header><div><small>EXPLAINABLE REVIEW</small><h3>Plan findings</h3></div><b>{analysis.summary.openFindings} OPEN</b></header>
              <div>
                {sortedFindings.map((finding) => <button
                  key={finding.id}
                  className={`${finding.severity} ${activeFinding?.id === finding.id ? "active" : ""} ${finding.decision !== "open" ? "decided" : ""}`}
                  onClick={() => { setFindingId(finding.id); setDecisionNote(finding.decisionNote); }}
                >
                  <i>{finding.decision !== "open" ? <Check size={15} /> : finding.severity === "critical" ? <XCircle size={15} /> : finding.severity === "warning" ? <AlertTriangle size={15} /> : <CircleHelp size={15} />}</i>
                  <span><small>{finding.category}</small><strong>{finding.title}</strong><em>{finding.detail}</em></span>
                  <b>{finding.decision === "open" ? finding.severity : finding.decision}</b>
                </button>)}
                {!sortedFindings.length && <div className="ai-plan-clear"><CheckCircle2 size={24} /><strong>No automated findings</strong><span>Complete a visual review before relying on the plan takeoff.</span></div>}
              </div>
            </section>
            <aside className="ai-finding-detail">
              {activeFinding ? <>
                <header><span className={activeFinding.severity}>{activeFinding.severity}</span><small>{activeFinding.category}</small><h3>{activeFinding.title}</h3><p>{activeFinding.detail}</p></header>
                <section><small>RECOMMENDED REVIEW</small><p>{activeFinding.recommendation}</p></section>
                <section>
                  <small>SOURCE EVIDENCE</small>
                  <div className="ai-finding-sources">
                    {activeFinding.evidenceIds.map((id) => evidenceById.get(id)).filter(Boolean).map((row) => row && <button key={row.id} onClick={() => showSource(row.page)}>
                      <span><strong>{row.value}</strong><small>{row.sheetNumber} · {confidencePercent(row.confidence)}</small></span><Eye size={14} />
                    </button>)}
                    {!activeFinding.evidenceIds.length && <p className="ai-no-direct-evidence">This is a plan-set coverage check. Confirm it against the sheet index and visible sheets.</p>}
                  </div>
                </section>
                {activeFinding.page && <button className="ai-source-button" onClick={() => showSource(activeFinding.page!)}><MapPin size={15} /> Show on plan</button>}
                {activeFinding.page && <button className="ai-markup-button" onClick={() => { onPrepareMarkup(activeFinding.page!, activeFinding.title); onClose(); }}><Sparkles size={15} /> Prepare markup</button>}
                <section className="ai-decision-card">
                  <small>YOUR DECISION</small>
                  <textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Optional review note or RFI question…" />
                  <div>
                    <button disabled={savingDecision} onClick={() => decide("accepted")}><Check size={14} /> Accept</button>
                    <button disabled={savingDecision} onClick={() => decide("rejected")}><X size={14} /> Reject</button>
                    <button disabled={savingDecision} onClick={() => decide("rfi")}><CircleHelp size={14} /> Needs RFI</button>
                    <button disabled={savingDecision} onClick={() => decide("ignored")}>Ignore</button>
                  </div>
                  <p>Decision status: <b>{activeFinding.decision}</b>. Accepting a finding documents the review; it does not alter the plan.</p>
                </section>
              </> : <div className="ai-plan-clear"><CheckCircle2 size={28} /><strong>No finding selected</strong></div>}
            </aside>
          </div>}

          {view === "takeoff" && <div className="ai-table-view">
            <header className="ai-takeoff-header">
              <div><small>DRAFT AI TAKEOFF</small><h3>Source-backed quantities</h3><p>Review every flagged row before using this export for estimating.</p></div>
              <button onClick={exportTakeoff}><Download size={15} /> Export CSV</button>
            </header>
            <div className="ai-takeoff-warning"><AlertTriangle size={15} /><span>This is a text-layer takeoff draft. It does not count unlabelled graphical symbols or measure duct length.</span></div>
            <div className="ai-data-table ai-takeoff-table">
              <div className="ai-table-head"><span>Category</span><span>Item</span><span>Quantity</span><span>Source pages</span><span>Confidence</span></div>
              {analysis.takeoff.map((row) => <div className="ai-table-row" key={row.id}>
                <span><b>{row.category}</b></span>
                <span><strong>{row.item}</strong>{row.reviewRequired && <small className="needs-review">VISUAL REVIEW REQUIRED</small>}</span>
                <span><b>{row.quantity}</b></span>
                <span>{row.pages.join(", ")}</span>
                <span><b>{confidencePercent(row.confidence)}</b><small>{confidenceLabel(row.confidence)}</small></span>
              </div>)}
              {!analysis.takeoff.length && <div className="ai-empty-table"><Table2 size={24} /><strong>No takeoff rows extracted</strong><span>Use plan markup tools to build the takeoff manually.</span></div>}
            </div>
          </div>}
        </div>
      </>}
    </section>
  </div>;
}
