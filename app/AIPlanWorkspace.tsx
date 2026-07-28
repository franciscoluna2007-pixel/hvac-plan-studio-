"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
  Ruler,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  analyzeHvacPlan,
  updatePlanFindingDecision,
  type PlanAnalysis,
  type PlanEvidence,
  type PlanEvidenceCategory,
  type PlanFindingDecision,
  type PlanReaderFinding,
} from "./planReader";
import { trackProductEvent } from "./productAnalytics";
import { buildAdvancedPlanIntelligence } from "./advancedPlanIntelligence";
import {
  buildSmartPlanSetup,
  type PlanFactStatus,
} from "./planSetup";

type WorkspaceView = "setup" | "overview" | "sheets" | "evidence" | "coverage" | "findings" | "takeoff";

type Props = {
  open: boolean;
  initialView?: "setup" | "reader" | "findings";
  autoRun?: boolean;
  pdf: PDFDocumentProxy | null;
  sourceFingerprint: string;
  sourceFileName: string;
  projectName: string;
  onClose: () => void;
  onShowPage: (page: number, region?: PlanEvidence["region"]) => void;
  onPrepareMarkup: (page: number, note?: string) => void;
  currentScaleLabel: string;
  scaleVerified: boolean;
  onUseDetectedScale: (label: string, page: number) => void;
  onStartCalibration: (page: number) => void;
  onOpenConnectionRepair: () => void;
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
  "Scale",
  "Rooms",
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
  if (value >= 0.9) return "Strong match";
  if (value >= 0.8) return "Review match";
  return "Weak match";
}

function confidencePercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function confidenceTone(value: number) {
  if (value >= 0.9) return "high";
  if (value >= 0.8) return "review";
  return "low";
}

function planFactLabel(status: PlanFactStatus) {
  if (status === "verified") return "Confirmed";
  if (status === "likely") return "Found on plan";
  if (status === "estimated") return "Suggested";
  return "Not found";
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function AIPlanWorkspace({
  open,
  initialView = "setup",
  autoRun = true,
  pdf,
  sourceFingerprint,
  sourceFileName,
  projectName,
  onClose,
  onShowPage,
  onPrepareMarkup,
  currentScaleLabel,
  scaleVerified,
  onUseDetectedScale,
  onStartCalibration,
  onOpenConnectionRepair,
  cloudProjectConnected = false,
  onOpenCloudWorkspace,
  onAnalysisChange,
  onFindingDecision,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const automaticFingerprintRef = useRef("");
  const analysisGenerationRef = useRef(0);
  const onAnalysisChangeRef = useRef(onAnalysisChange);
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null);
  const [view, setView] = useState<WorkspaceView>("setup");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | PlanEvidenceCategory>("All");
  const [findingId, setFindingId] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);

  useEffect(() => {
    onAnalysisChangeRef.current = onAnalysisChange;
  }, [onAnalysisChange]);

  const runAnalysis = useCallback(async () => {
    if (!pdf) return;
    automaticFingerprintRef.current = sourceFingerprint;
    const generation = ++analysisGenerationRef.current;
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
        onProgress: (completed, total) => {
          if (analysisGenerationRef.current === generation) {
            setProgress({ completed, total });
          }
        },
      });
      if (analysisGenerationRef.current !== generation) return;
      setAnalysis(result);
      setFindingId(result.findings[0]?.id || "");
      setView("setup");
      void trackProductEvent("ai_analysis_completed", {
        page_count: result.pageCount,
        finding_count: result.findings.length,
        takeoff_rows: result.takeoff.length,
        duration_ms: Math.round(performance.now() - startedAt),
      });
      try {
        await onAnalysisChangeRef.current?.(result);
      } catch {
        setError("The analysis finished in this browser, but its cloud copy could not be updated.");
      }
    } catch (caught) {
      if (analysisGenerationRef.current !== generation) return;
      setError(caught instanceof Error ? caught.message : "The plan reader could not analyze this PDF.");
      void trackProductEvent("ai_analysis_failed", {
        page_count: pdf.numPages,
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } finally {
      if (analysisGenerationRef.current === generation) setRunning(false);
    }
  }, [pdf, sourceFileName, sourceFingerprint]);

  useEffect(() => {
    analysisGenerationRef.current += 1;
    const frame = requestAnimationFrame(() => {
      setAnalysis(null);
      setRunning(false);
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
      setView(initialView === "findings" ? "findings" : initialView === "reader" ? "overview" : "setup");
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
  const advanced = useMemo(
    () => buildAdvancedPlanIntelligence(analysis),
    [analysis],
  );
  const smartSetup = useMemo(
    () => buildSmartPlanSetup(analysis),
    [analysis],
  );
  const setupSourceById = useMemo(() => {
    const sources = [
      ...(smartSetup?.scales.flatMap((scale) => scale.candidates.flatMap((candidate) => candidate.sources)) || []),
      ...(smartSetup?.rooms.flatMap((room) => room.sources) || []),
      ...(smartSetup?.equipment.flatMap((equipment) => equipment.sources) || []),
      ...(smartSetup?.systems.flatMap((system) => system.sources) || []),
      ...(smartSetup?.unassignedCeilingHeights.flatMap((height) => height.sources) || []),
    ];
    return new Map(sources.map((source) => [source.id, source]));
  }, [smartSetup]);

  useEffect(() => {
    if (
      !autoRun ||
      !pdf ||
      !sourceFingerprint ||
      automaticFingerprintRef.current === sourceFingerprint
    ) return;
    const frame = requestAnimationFrame(() => {
      if (automaticFingerprintRef.current === sourceFingerprint) return;
      automaticFingerprintRef.current = sourceFingerprint;
      void runAnalysis();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoRun, pdf, runAnalysis, sourceFingerprint]);

  if (!open) return null;

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

  function showSource(page: number, region?: PlanEvidence["region"]) {
    onShowPage(page, region);
    onClose();
  }

  function exportTakeoff() {
    if (!analysis) return;
    const rows = [
      ["Category", "Item", "Text references", "Pages", "Extraction score", "Review required"],
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
    <button className="ai-plan-dismiss" aria-label="Close plan setup" onClick={onClose} />
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
            <small>HVAC PLAN STUDIO · PLAN READER</small>
            <h2 id="ai-plan-title">Plan Setup &amp; Source Review</h2>
            <p>{projectName} · {sourceFileName || "No plan loaded"}</p>
          </div>
        </div>
        <div className="ai-plan-header-actions">
          <span className="ai-human-control"><ShieldCheck size={14} /> You approve every fix</span>
          <button aria-label="Close plan setup" onClick={onClose}><X size={19} /></button>
        </div>
      </header>

      <div className="ai-plan-policy">
        <Sparkles size={15} />
        <span><strong>The plan stays in your control.</strong> The reader finds useful setup information and missing details, but never changes a drawing or accepts a guess for you.</span>
      </div>

      {!analysis ? <div className="ai-plan-start">
        <section>
          <span className="ai-reader-orbit"><ScanSearch size={34} /></span>
          <small>SMART PLAN SETUP</small>
          <h3>Read the plan before you start marking it up.</h3>
          <p>Plan Setup looks for scale, room names, ceiling heights, equipment, systems, and HVAC notes. It shows exactly what still needs your answer.</p>
          <div className="ai-plan-capabilities">
            <article><Ruler size={18} /><strong>Find drawing scales</strong><span>Detect printed scales per plan sheet and ask when they disagree.</span></article>
            <article><Layers3 size={18} /><strong>Find rooms and heights</strong><span>Collect room labels, ceiling notes, vaulted areas, and missing heights.</span></article>
            <article><FileSearch size={18} /><strong>Link HVAC information</strong><span>Find units, systems, zones, schedules, airflow, and duct notes.</span></article>
            <article><ListChecks size={18} /><strong>Prepare safe repairs</strong><span>Explain problems and preview fixes before anything changes.</span></article>
          </div>
          {error && <div className="ai-plan-error"><AlertTriangle size={16} /> {error}</div>}
          <button className="ai-analyze-button" disabled={!pdf || running} onClick={runAnalysis}>
            {running ? <LoaderCircle className="spin" size={18} /> : <ScanSearch size={18} />}
            {running ? `Reading page ${progress.completed} of ${progress.total}` : "Read this plan"}
            {!running && <ArrowRight size={17} />}
          </button>
          {!pdf && <small className="ai-plan-no-source">Open a plan PDF to begin.</small>}
          {running && <div className="ai-plan-progress"><i style={{ width: `${progress.total ? progress.completed / progress.total * 100 : 0}%` }} /></div>}
        </section>
        <aside>
          <small>WHAT PLAN SETUP CHECKS</small>
          {[
            ["01", "Drawing setup", "Scale, sheet type, and readable plan areas"],
            ["02", "Rooms", "Room names, ceiling heights, and special conditions"],
            ["03", "HVAC systems", "Tags, tonnage, CFM, schedules, and zones"],
            ["04", "Plan problems", "Missing, conflicting, and unclear information"],
            ["05", "Safe next step", "What can continue and what needs your answer"],
          ].map(([number, title, detail]) => <div key={number}><b>{number}</b><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={15} /></div>)}
        </aside>
      </div> : <>
        <nav className="ai-plan-tabs" aria-label="Plan setup views">
          {([
            ["setup", "Plan setup", ScanSearch],
            ["overview", "Summary", Sparkles],
            ["sheets", "Sheets", Layers3],
            ["evidence", "What I found", FileSearch],
            ["coverage", "What’s missing", CircleHelp],
            ["findings", "Problems", ListChecks],
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
            {running ? <LoaderCircle className="spin" size={14} /> : <ScanSearch size={14} />} Read plan again
          </button>
        </nav>

        {analysis.persistence?.truncated && <div className="ai-plan-snapshot-warning" role="status">
          <AlertTriangle size={17} />
          <span>
            <strong>Restored analysis snapshot is partial.</strong>{" "}
            This browser saved {analysis.persistence.savedEvidenceCount} of {analysis.persistence.originalEvidenceCount} evidence rows,
            {" "}{analysis.persistence.savedFindingCount} of {analysis.persistence.originalFindingCount} findings, and
            {" "}{analysis.persistence.savedTakeoffCount} of {analysis.persistence.originalTakeoffCount} takeoff rows.
            Reanalyze the source PDF before relying on coverage or automation readiness.
          </span>
        </div>}

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
          {view === "setup" && smartSetup && <div className="ai-smart-setup">
            <section className="ai-smart-setup-hero">
              <div>
                <small>PLAN SCAN COMPLETE</small>
                <h3>{smartSetup.summary.headline}</h3>
                <p>{smartSetup.summary.detail}</p>
              </div>
              <span className={smartSetup.counts.requiredReviewItems ? "attention" : "ready"}>
                <strong>{smartSetup.counts.reviewItems}</strong>
                <small>{smartSetup.counts.reviewItems === 1 ? "DETAIL TO REVIEW" : "DETAILS TO REVIEW"}</small>
              </span>
            </section>

            <div className="ai-smart-setup-metrics">
              <article className={scaleVerified ? "confirmed" : smartSetup.counts.verifiedScales + smartSetup.counts.likelyScales ? "found" : "missing"}>
                <Ruler size={18} />
                <small>DRAWING SCALE</small>
                <strong>{scaleVerified ? currentScaleLabel : `${smartSetup.counts.verifiedScales + smartSetup.counts.likelyScales} found`}</strong>
                <span>{scaleVerified ? "Confirmed for current drawing" : "Confirm before measured work"}</span>
              </article>
              <article className={smartSetup.counts.roomHeights ? "found" : "missing"}>
                <Layers3 size={18} />
                <small>ROOMS &amp; HEIGHTS</small>
                <strong>{smartSetup.counts.rooms} rooms</strong>
                <span>{smartSetup.counts.roomHeights} ceiling heights found</span>
              </article>
              <article className={smartSetup.counts.equipment ? "found" : "missing"}>
                <FileSearch size={18} />
                <small>EQUIPMENT</small>
                <strong>{smartSetup.counts.equipment} unit{smartSetup.counts.equipment === 1 ? "" : "s"}</strong>
                <span>{smartSetup.counts.systems} system label{smartSetup.counts.systems === 1 ? "" : "s"}</span>
              </article>
              <article className={smartSetup.counts.requiredReviewItems ? "missing" : "confirmed"}>
                <ShieldCheck size={18} />
                <small>NEXT STEP</small>
                <strong>{smartSetup.counts.requiredReviewItems ? `${smartSetup.counts.requiredReviewItems} required` : "Ready to connect"}</strong>
                <span>Only dependent measurements pause</span>
              </article>
            </div>

            <div className="ai-smart-setup-grid">
              <section className="ai-smart-setup-section">
                <header>
                  <div><small>NEEDS YOUR REVIEW</small><h3>Answer only what controls the next step</h3></div>
                  <b>{smartSetup.reviewQuestions.length}</b>
                </header>
                <div className="ai-smart-setup-list">
                  {smartSetup.reviewQuestions.slice(0, 8).map((question) => {
                    const source = question.sourceIds.map((sourceId) => setupSourceById.get(sourceId)).find(Boolean);
                    return <article className="ai-smart-setup-question" key={question.id}>
                      <span className={question.priority}>{question.priority === "required" ? "Needed next" : "Good to check"}</span>
                      <div><strong>{question.title}</strong><p>{question.prompt}</p></div>
                      {source && <button onClick={() => showSource(source.page, source.region)}><Eye size={14} /> Show source</button>}
                    </article>;
                  })}
                  {!smartSetup.reviewQuestions.length && <div className="ai-plan-clear">
                    <CheckCircle2 size={24} />
                    <strong>No setup questions are blocking you</strong>
                    <span>You can still inspect every plan fact and source below.</span>
                  </div>}
                </div>
              </section>

              <section className="ai-smart-setup-section">
                <header><div><small>SCALE BY DRAWING</small><h3>Use the scale the plan actually shows</h3></div></header>
                <div className="ai-smart-setup-list">
                  {smartSetup.scales.slice(0, 8).map((scale) => {
                    const selected = scale.candidates.find((candidate) => candidate.id === scale.selectedCandidateId) || scale.candidates[0];
                    const source = selected?.sources[0];
                    return <article className="ai-smart-setup-fact" key={`${scale.page}-${scale.sheetNumber}`}>
                      <div>
                        <span className={`fact-status ${scale.status}`}>{planFactLabel(scale.status)}</span>
                        <strong>{scale.sheetNumber} · {scale.title}</strong>
                        <p>{scale.conflict ? "More than one scale was found on this drawing." : selected?.label || "No usable printed scale found."}</p>
                      </div>
                      <div className="ai-smart-setup-actions">
                        {source && <button onClick={() => showSource(source.page, source.region)}><Eye size={14} /> Show source</button>}
                        {selected && selected.kind !== "not-to-scale" && !scale.conflict
                          ? <button className="primary" onClick={() => onUseDetectedScale(selected.label, scale.page)}>Use this scale</button>
                          : <button className="primary" onClick={() => onStartCalibration(scale.page)}>Calibrate this drawing</button>}
                      </div>
                    </article>;
                  })}
                </div>
              </section>

              <section className="ai-smart-setup-section">
                <header><div><small>ROOM INFORMATION</small><h3>Names and ceiling heights</h3></div><b>{smartSetup.rooms.length}</b></header>
                <div className="ai-smart-setup-list">
                  {smartSetup.rooms.slice(0, 10).map((room) => {
                    const source = room.sources[0];
                    return <article className="ai-smart-setup-fact" key={room.id}>
                      <div>
                        <span className={`fact-status ${room.status}`}>{planFactLabel(room.status)}</span>
                        <strong>{room.number ? `${room.number} · ` : ""}{room.name}</strong>
                        <p>{room.ceilingHeight
                          ? `${room.ceilingType === "vaulted" ? "Vaulted · " : ""}${room.ceilingHeight.label}`
                          : "Ceiling height not found"}</p>
                      </div>
                      {source && <button onClick={() => showSource(source.page, source.region)}><Eye size={14} /> Show source</button>}
                    </article>;
                  })}
                  {!smartSetup.rooms.length && <div className="ai-plan-clear">
                    <CircleHelp size={22} />
                    <strong>No room labels were found in readable text</strong>
                    <span>Use the plan visually and add rooms as you mark them up.</span>
                  </div>}
                </div>
              </section>

              <section className="ai-smart-setup-section">
                <header><div><small>HVAC INFORMATION</small><h3>Equipment, systems, and zones</h3></div><b>{smartSetup.equipment.length + smartSetup.systems.length}</b></header>
                <div className="ai-smart-setup-list">
                  {smartSetup.equipment.slice(0, 8).map((equipment) => {
                    const source = equipment.sources[0];
                    return <article className="ai-smart-setup-fact" key={equipment.id}>
                      <div>
                        <span className={`fact-status ${equipment.status}`}>{planFactLabel(equipment.status)}</span>
                        <strong>{equipment.tag}</strong>
                        <p>{equipment.equipmentType}{equipment.tonnage ? ` · ${equipment.tonnage} ton` : " · tonnage not found"}</p>
                      </div>
                      {source && <button onClick={() => showSource(source.page, source.region)}><Eye size={14} /> Show source</button>}
                    </article>;
                  })}
                  {smartSetup.systems.slice(0, 6).map((system) => {
                    const source = system.sources[0];
                    return <article className="ai-smart-setup-fact" key={system.id}>
                      <div>
                        <span className={`fact-status ${system.status}`}>{planFactLabel(system.status)}</span>
                        <strong>{system.label}</strong>
                        <p>{system.kind === "zone" ? "Zone label" : "System label"}</p>
                      </div>
                      {source && <button onClick={() => showSource(source.page, source.region)}><Eye size={14} /> Show source</button>}
                    </article>;
                  })}
                  {!smartSetup.equipment.length && !smartSetup.systems.length && <div className="ai-plan-clear">
                    <CircleHelp size={22} />
                    <strong>No equipment or system labels were found</strong>
                    <span>You can keep drawing, but confirm the system before connecting runs.</span>
                  </div>}
                </div>
              </section>
            </div>

            <div className="ai-smart-setup-actions">
              <button onClick={() => setView("findings")}><ListChecks size={15} /> Review plan problems</button>
              <button className="primary" onClick={onOpenConnectionRepair}><Wrench size={15} /> Connect &amp; repair the system</button>
            </div>
          </div>}

          {view === "overview" && <div className="ai-overview">
            <section className="ai-overview-hero">
              <div>
                <small>PLAN INTELLIGENCE SUMMARY</small>
                <h3>{analysis.summary.openFindings
                  ? `${analysis.summary.openFindings} item${analysis.summary.openFindings === 1 ? "" : "s"} need your review`
                  : "The automated review has no open findings"}</h3>
                <p>{analysis.summary.mechanicalSheets} HVAC-related sheet{analysis.summary.mechanicalSheets === 1 ? "" : "s"} identified across {analysis.pageCount} pages. Results remain draft until you confirm them.</p>
              </div>
              <span className="ai-confidence-ring"><strong>{Math.round(analysis.summary.averageConfidence * 100)}</strong><small>AVG MATCH SCORE</small></span>
            </section>
            <div className="ai-metric-grid">
              <article><Layers3 size={17} /><small>HVAC SHEETS</small><strong>{analysis.summary.mechanicalSheets}</strong><span>{analysis.summary.readableSheets} readable</span></article>
              <article><FileSearch size={17} /><small>EVIDENCE</small><strong>{analysis.evidence.length}</strong><span>source-linked</span></article>
              <article><ListChecks size={17} /><small>OPEN FINDINGS</small><strong>{analysis.summary.openFindings}</strong><span>need a decision</span></article>
              <article><Table2 size={17} /><small>EVIDENCE ROWS</small><strong>{analysis.takeoff.length}</strong><span>text-reference groups</span></article>
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
              <div className="ai-table-head"><span>Sheet</span><span>Classification</span><span>Text</span><span>Match score</span><span /></div>
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
              <div><small>SOURCE EVIDENCE</small><h3>What the reader found</h3><p>Every extracted value keeps its sheet, excerpt, source region, and deterministic match score.</p></div>
              <div className="ai-evidence-tools">
                <label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search evidence…" /></label>
                <label><Filter size={14} /><select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categoryOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
              </div>
            </header>
            <div className="ai-data-table ai-evidence-table">
              <div className="ai-table-head"><span>Evidence</span><span>Source excerpt</span><span>Match score</span><span /></div>
              {visibleEvidence.map((row) => <div className="ai-table-row" key={row.id}>
                <span><b>{row.value}</b><small>{row.category} · {row.label}</small></span>
                <span><strong>{row.excerpt}</strong><small>{row.sheetNumber} · PDF page {row.page}{row.region ? ` · region ${Math.round(row.region.x)}, ${Math.round(row.region.y)}` : " · page-linked"}</small></span>
                <span className={`confidence-${confidenceTone(row.confidence)}`}><b>{confidenceLabel(row.confidence)}</b><small>{confidencePercent(row.confidence)}</small></span>
                <button onClick={() => showSource(row.page, row.region)}><MapPin size={14} /> Show source</button>
              </div>)}
              {!visibleEvidence.length && <div className="ai-empty-table"><FileSearch size={24} /><strong>No evidence matches this filter</strong><span>Clear the search or choose another category.</span></div>}
            </div>
          </div>}

          {view === "coverage" && advanced && <div className="ai-table-view ai-coverage-view">
            <header>
              <div>
                <small>SOURCE READINESS</small>
                <h3>Sheet coverage and source relationships</h3>
                <p>Coverage explains what the reader could verify, what needs OCR, and which cross-sheet links still need human confirmation.</p>
              </div>
              <span className={`ai-coverage-score ${advanced.blockers.length ? "attention" : "clear"}`}>
                <strong>{advanced.readinessScore}</strong>
                <small>EVIDENCE INDEX</small>
              </span>
            </header>
            <div className="ai-evidence-heuristic"><ShieldCheck size={17} /><span><strong>Review-only heuristic.</strong> This index is not a probability, approval, or release gate and never authorizes plan changes.</span></div>
            <div className="ai-coverage-summary">
              <article><strong>{advanced.averageCoveragePercent}%</strong><span>category coverage</span></article>
              <article><strong>{advanced.averageRegionCoveragePercent}%</strong><span>exact text regions</span></article>
              <article><strong>{advanced.ocrRequiredPages.length}</strong><span>OCR / visual checks</span></article>
              <article><strong>{advanced.relationships.length}</strong><span>relationships to confirm</span></article>
            </div>
            {advanced.blockers.length > 0 && <div className="ai-coverage-blockers">
              <AlertTriangle size={18} />
              <div><strong>Source review still required</strong>{advanced.blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}</div>
            </div>}
            <div className="ai-data-table ai-coverage-table">
              <div className="ai-table-head"><span>Sheet</span><span>Covered evidence</span><span>Missing / review</span><span>Regions</span><span /></div>
              {advanced.coverage.map((row) => <div className="ai-table-row" key={row.page}>
                <span><b>{row.sheetNumber}</b><small>{row.title}</small></span>
                <span><strong>{row.coveredCategories.join(", ") || "No HVAC evidence"}</strong><small>{row.evidenceCount} extracted item{row.evidenceCount === 1 ? "" : "s"}</small></span>
                <span className={row.ocrStatus === "required" || row.missingCategories.length ? "status-review" : "status-good"}>
                  {row.ocrStatus === "required" ? "OCR / visual confirmation" : row.missingCategories.length ? row.missingCategories.join(", ") : "Covered"}
                </span>
                <span><b>{row.regionCoveragePercent}%</b><small>exact regions</small></span>
                <button onClick={() => showSource(row.page)}><Eye size={14} /> Open sheet</button>
              </div>)}
            </div>
            <section className="ai-relationship-panel">
              <header><div><small>CROSS-SHEET RELATIONSHIPS</small><h3>Exact-source links to confirm</h3></div></header>
              {advanced.relationships.map((relationship) => {
                const sourceKeys = new Set<string>();
                const sources = relationship.evidenceIds.flatMap((evidenceId) => {
                  const evidence = evidenceById.get(evidenceId);
                  if (!evidence) return [];
                  const key = `${evidence.page}:${evidence.sheetNumber}:${evidence.region ? `${evidence.region.x}:${evidence.region.y}:${evidence.region.width}:${evidence.region.height}` : "page"}`;
                  if (sourceKeys.has(key)) return [];
                  sourceKeys.add(key);
                  return [evidence];
                });
                return <article key={relationship.id}>
                  <div className="ai-relationship-summary">
                    <span><strong>{relationship.label}</strong><small>{relationship.sourceSheets.join(" ↔ ")}</small></span>
                    <b className="ai-relationship-status">UNCONFIRMED EXACT-TAG CANDIDATE</b>
                  </div>
                  <p>Rule-based text match {Math.round(relationship.confidence * 100)}/100 · not a probability. Matching tags do not prove a schedule-row, airflow, or equipment association.</p>
                  <div className="ai-relationship-sources">
                    {sources.map((evidence) => <button key={evidence.id} onClick={() => showSource(evidence.page, evidence.region)}>
                      <Eye size={14} /> Open {evidence.sheetNumber || `page ${evidence.page}`} source
                    </button>)}
                  </div>
                </article>;
              })}
              {!advanced.relationships.length && <div className="ai-plan-clear"><CheckCircle2 size={22} /><strong>No exact cross-sheet relationships found</strong><span>The reader will not guess relationships from nearby numbers.</span></div>}
            </section>
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
                    {activeFinding.evidenceIds.map((id) => evidenceById.get(id)).filter(Boolean).map((row) => row && <button key={row.id} onClick={() => showSource(row.page, row.region)}>
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
            <div className="ai-takeoff-warning"><AlertTriangle size={15} /><span>These are text-reference counts, not installed quantities. Repeated tags can appear on plans, schedules, details, and notes; visually reconcile every row before purchasing.</span></div>
            <div className="ai-data-table ai-takeoff-table">
              <div className="ai-table-head"><span>Category</span><span>Item</span><span>Text refs</span><span>Source pages</span><span>Match score</span></div>
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
