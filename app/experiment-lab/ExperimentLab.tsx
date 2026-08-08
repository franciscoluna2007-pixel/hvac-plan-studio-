"use client";

import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  DraftingCompass,
  GitCompareArrows,
  Play,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Split,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FLATTEN_JS_CANDIDATE_VERSION,
  GEOMETRY_COMPARISON_TOLERANCE_UNITS,
} from "../geometryComparison";
import { LabPlanCanvas } from "./LabPlanCanvas";
import {
  BASELINE_REVISION,
  experimentDefinitions,
  formatCoordinate,
  initialGeometryInputs,
  previewGeometryComparison,
  runGeometryComparison,
  type CompletedGeometryRun,
  type ElbowLabInputs,
  type GeometryExperimentId,
  type GeometryLabInputs,
  type ReducerLabInputs,
} from "./labFixtures";

type EvidenceTab = "inputs" | "differences" | "performance" | "receipt";
const evidenceTabs: EvidenceTab[] = ["inputs", "differences", "performance", "receipt"];

const experimentIcons = {
  elbow: Ruler,
  reducer: Split,
} satisfies Record<GeometryExperimentId, typeof Ruler>;

const experimentOrder: GeometryExperimentId[] = ["elbow", "reducer"];

function runStatusLabel(run: CompletedGeometryRun | null) {
  if (!run) return "Ready to compare";
  if (run.receipt.status === "match") return "Last run: match";
  if (run.receipt.status === "mismatch") return "Last run: mismatch";
  if (run.receipt.status === "rejected") return "Input rejected";
  return "Candidate error";
}

function statusIcon(run: CompletedGeometryRun | null) {
  if (!run) return <Activity size={16} />;
  if (run.receipt.status === "match") return <CheckCircle2 size={16} />;
  if (run.receipt.status === "rejected") return <AlertTriangle size={16} />;
  return <XCircle size={16} />;
}

function statusClass(run: CompletedGeometryRun | null) {
  if (!run) return "pending";
  return run.receipt.status === "match" ? "pass" : run.receipt.status;
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <span className="lab-number-field">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  );
}

function MetricCard({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: "pending" | "pass" | "fail";
}) {
  return (
    <div className={state}>
      {state === "pending" ? <Activity size={20} /> : state === "pass" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
      <span><strong>{label}</strong><small>{value}</small></span>
    </div>
  );
}

function formatReceipt(run: CompletedGeometryRun) {
  return JSON.stringify(run, null, 2);
}

export function ExperimentLab() {
  const shellRef = useRef<HTMLElement>(null);
  const [experimentId, setExperimentId] = useState<GeometryExperimentId>("elbow");
  const [inputs, setInputs] = useState<GeometryLabInputs>(initialGeometryInputs);
  const [run, setRun] = useState<CompletedGeometryRun | null>(null);
  const [activeTab, setActiveTab] = useState<EvidenceTab>("inputs");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const experiment = experimentDefinitions[experimentId];
  const livePreview = useMemo(
    () => previewGeometryComparison(experimentId, inputs),
    [experimentId, inputs],
  );
  const metrics = run?.receipt.metrics ?? null;
  const inputSummary = useMemo(() => experimentId === "elbow"
    ? [
      ["Vertex", `${inputs.elbow.vertexX}, ${inputs.elbow.vertexY}`],
      ["Plan scale", `${inputs.elbow.feetPerUnit} ft/unit`],
      ["Elbow", `${inputs.elbow.angleDegrees}° ${inputs.elbow.turn}`],
      ["Takeouts", `${inputs.elbow.inletTakeoutInches} in / ${inputs.elbow.outletTakeoutInches} in`],
    ]
    : [
      ["Inlet", `${inputs.reducer.inletX}, ${inputs.reducer.inletY}`],
      ["Plan scale", `${inputs.reducer.feetPerUnit} ft/unit`],
      ["Sizes", `${inputs.reducer.inletWidthInches}×${inputs.reducer.inletHeightInches} → ${inputs.reducer.outletWidthInches}×${inputs.reducer.outletHeightInches} in`],
      ["Length", `${inputs.reducer.lengthInches} in · ${inputs.reducer.alignment}`],
    ], [experimentId, inputs]);

  function invalidateRun() {
    setRun(null);
    setActiveTab("inputs");
    setCopyState("idle");
  }

  function changeExperiment(next: GeometryExperimentId) {
    setExperimentId(next);
    invalidateRun();
  }

  function updateElbow<Key extends keyof ElbowLabInputs>(key: Key, value: ElbowLabInputs[Key]) {
    setInputs((current) => ({ ...current, elbow: { ...current.elbow, [key]: value } }));
    invalidateRun();
  }

  function updateReducer<Key extends keyof ReducerLabInputs>(key: Key, value: ReducerLabInputs[Key]) {
    setInputs((current) => ({ ...current, reducer: { ...current.reducer, [key]: value } }));
    invalidateRun();
  }

  function resetLab() {
    setExperimentId("elbow");
    setInputs(initialGeometryInputs);
    invalidateRun();
  }

  function runComparison() {
    const next = runGeometryComparison(experimentId, inputs, new Date());
    setRun(next);
    setActiveTab("differences");
    setCopyState("idle");
  }

  async function copyReceipt() {
    if (!run) return;
    try {
      await navigator.clipboard.writeText(formatReceipt(run));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("failed");
    }
  }

  function exportReceipt() {
    if (!run) return;
    const blob = new Blob([formatReceipt(run)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hvac-geometry-${experimentId}-${run.receipt.status}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function moveEvidenceTab(current: EvidenceTab, direction: -1 | 1) {
    const currentIndex = evidenceTabs.indexOf(current);
    const next = evidenceTabs[(currentIndex + direction + evidenceTabs.length) % evidenceTabs.length];
    setActiveTab(next);
    window.requestAnimationFrame(() => document.getElementById(`lab-tab-${next}`)?.focus());
  }

  const metricState = (finite: boolean | undefined) => run ? (finite ? "pass" : "fail") : "pending";

  useEffect(() => {
    shellRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  return (
    <main ref={shellRef} className="experiment-lab-shell" data-hydrated="false">
      <header className="experiment-lab-header">
        <div className="experiment-lab-brand">
          <span className="experiment-lab-mark" aria-hidden="true"><DraftingCompass size={24} /></span>
          <span>
            <strong>HVAC Plan Studio Experiment Lab</strong>
            <small>Opt-in geometry comparison · production data isolated</small>
          </span>
        </div>
        <div className="experiment-lab-header-actions">
          <span className="experiment-lab-boundary"><ShieldCheck size={16} /> Isolated direct route</span>
          <button type="button" className="lab-button lab-button-secondary" onClick={resetLab}>
            <RefreshCw size={17} /> Reset lab
          </button>
          <button
            type="button"
            className="lab-button lab-button-primary"
            onClick={exportReceipt}
            disabled={!run}
            title={run ? "Export the completed differential receipt" : "Run the comparison before exporting"}
          >
            <Download size={17} /> Export evidence
          </button>
        </div>
      </header>

      <section className="experiment-lab-workspace">
        <nav className="experiment-lab-nav" aria-label="Geometry experiments">
          <div className="experiment-lab-nav-heading">
            <GitCompareArrows size={17} />
            <span>Experiments</span>
          </div>
          {experimentOrder.map((item) => {
            const Icon = experimentIcons[item];
            return (
              <button
                type="button"
                key={item}
                className={item === experimentId ? "active" : ""}
                aria-current={item === experimentId ? "page" : undefined}
                onClick={() => changeExperiment(item)}
              >
                <Icon size={18} />
                <span>{experimentDefinitions[item].label}</span>
              </button>
            );
          })}
          <div className="experiment-lab-nav-note">
            <ShieldCheck size={17} />
            <span><strong>Safe boundary</strong><small>No project storage, uploads, network calls, or production navigation.</small></span>
          </div>
        </nav>

        <section className="experiment-lab-comparison" aria-labelledby="experiment-title">
          <header className="experiment-lab-comparison-heading">
            <span>
              <h1 id="experiment-title">{experiment.label}</h1>
              <small>{experiment.description}</small>
            </span>
            <span className={`lab-run-state ${statusClass(run)}`} role="status" aria-live="polite">
              {statusIcon(run)} {runStatusLabel(run)}
            </span>
          </header>

          <div className="experiment-lab-canvases">
            <article className="experiment-lab-canvas-panel">
              <header>
                <span><strong>Product baseline redraw</strong><small>Updates immediately from the live inputs</small></span>
                <span className="lab-baseline-tag">Live preview</span>
              </header>
              <LabPlanCanvas
                experimentId={experimentId}
                snapshot={livePreview.baseline}
                variant="baseline"
              />
            </article>
            <article className="experiment-lab-canvas-panel">
              <header>
                <span><strong>Flatten.js candidate redraw</strong><small>Updates from the same immutable live input</small></span>
                <span className="lab-candidate-tag">Preview · not evidence</span>
              </header>
              <LabPlanCanvas
                experimentId={experimentId}
                snapshot={livePreview.candidate}
                variant="candidate"
              />
            </article>
          </div>

          <div className="experiment-lab-metric-strip" aria-label="Comparison checks">
            <MetricCard
              label="Coordinate delta"
              value={run ? formatCoordinate(metrics?.maxCoordinateDelta ?? null) : "Not run"}
              state={run ? ((metrics?.maxCoordinateDelta ?? Infinity) <= GEOMETRY_COMPARISON_TOLERANCE_UNITS ? "pass" : "fail") : "pending"}
            />
            <MetricCard
              label="Scalar delta"
              value={run ? formatCoordinate(metrics?.maxScalarDelta ?? null) : "Not run"}
              state={run ? ((metrics?.maxScalarDelta ?? Infinity) <= GEOMETRY_COMPARISON_TOLERANCE_UNITS ? "pass" : "fail") : "pending"}
            />
            <MetricCard label="Baseline finite" value={run ? (metrics?.baselineFinite ? "Yes" : "No") : "Not run"} state={metricState(metrics?.baselineFinite)} />
            <MetricCard label="Candidate finite" value={run ? (metrics?.candidateFinite ? "Yes" : "No") : "Not run"} state={metricState(metrics?.candidateFinite)} />
            <MetricCard label="Overall result" value={run?.receipt.status ?? "Not run"} state={run ? (run.receipt.status === "match" ? "pass" : "fail") : "pending"} />
          </div>
        </section>

        <aside className="experiment-lab-controls" aria-label="Test controls">
          <header><strong>Live geometry inputs</strong><small>Every change invalidates the previous receipt</small></header>

          {experimentId === "elbow" ? (
            <>
              <div className="lab-control-pair">
                <NumberField label="Vertex X" value={inputs.elbow.vertexX} onChange={(value) => updateElbow("vertexX", value)} />
                <NumberField label="Vertex Y" value={inputs.elbow.vertexY} onChange={(value) => updateElbow("vertexY", value)} />
              </div>
              <NumberField label="Plan scale" value={inputs.elbow.feetPerUnit} min={0.01} step={0.01} suffix="ft/unit" onChange={(value) => updateElbow("feetPerUnit", value)} />
              <div className="lab-control-pair">
                <NumberField label="Width" value={inputs.elbow.widthInches} min={1} max={120} suffix="in" onChange={(value) => updateElbow("widthInches", value)} />
                <NumberField label="Height" value={inputs.elbow.heightInches} min={1} max={120} suffix="in" onChange={(value) => updateElbow("heightInches", value)} />
              </div>
              <div className="lab-control-pair">
                <label><span>Angle</span><select value={inputs.elbow.angleDegrees} onChange={(event) => updateElbow("angleDegrees", Number(event.target.value) as 45 | 90)}><option value={45}>45°</option><option value={90}>90°</option></select></label>
                <label><span>Turn</span><select value={inputs.elbow.turn} onChange={(event) => updateElbow("turn", event.target.value as "left" | "right")}><option value="left">Left</option><option value="right">Right</option></select></label>
              </div>
              <NumberField label="Inbound axis" value={inputs.elbow.inboundAngleDegrees} step={1} suffix="deg" onChange={(value) => updateElbow("inboundAngleDegrees", value)} />
              <div className="lab-control-pair">
                <NumberField label="Inlet takeout" value={inputs.elbow.inletTakeoutInches} min={0} max={240} step={0.25} suffix="in" onChange={(value) => updateElbow("inletTakeoutInches", value)} />
                <NumberField label="Outlet takeout" value={inputs.elbow.outletTakeoutInches} min={0} max={240} step={0.25} suffix="in" onChange={(value) => updateElbow("outletTakeoutInches", value)} />
              </div>
              <label><span>Rectangular style</span><select value={inputs.elbow.rectangularStyle} onChange={(event) => updateElbow("rectangularStyle", event.target.value as "radius" | "square")}><option value="radius">Radius</option><option value="square">Square</option></select></label>
            </>
          ) : (
            <>
              <div className="lab-control-pair">
                <NumberField label="Inlet X" value={inputs.reducer.inletX} onChange={(value) => updateReducer("inletX", value)} />
                <NumberField label="Inlet Y" value={inputs.reducer.inletY} onChange={(value) => updateReducer("inletY", value)} />
              </div>
              <NumberField label="Plan scale" value={inputs.reducer.feetPerUnit} min={0.01} step={0.01} suffix="ft/unit" onChange={(value) => updateReducer("feetPerUnit", value)} />
              <div className="lab-control-pair">
                <NumberField label="Inlet width" value={inputs.reducer.inletWidthInches} min={1} max={120} suffix="in" onChange={(value) => updateReducer("inletWidthInches", value)} />
                <NumberField label="Inlet height" value={inputs.reducer.inletHeightInches} min={1} max={120} suffix="in" onChange={(value) => updateReducer("inletHeightInches", value)} />
              </div>
              <div className="lab-control-pair">
                <NumberField label="Outlet width" value={inputs.reducer.outletWidthInches} min={1} max={120} suffix="in" onChange={(value) => updateReducer("outletWidthInches", value)} />
                <NumberField label="Outlet height" value={inputs.reducer.outletHeightInches} min={1} max={120} suffix="in" onChange={(value) => updateReducer("outletHeightInches", value)} />
              </div>
              <NumberField label="Reducer length" value={inputs.reducer.lengthInches} min={1} max={240} step={0.25} suffix="in" onChange={(value) => updateReducer("lengthInches", value)} />
              <NumberField label="Inbound axis" value={inputs.reducer.inboundAngleDegrees} step={1} suffix="deg" onChange={(value) => updateReducer("inboundAngleDegrees", value)} />
              <label><span>Alignment</span><select value={inputs.reducer.alignment} onChange={(event) => updateReducer("alignment", event.target.value as ReducerLabInputs["alignment"])}><option value="centered">Centered</option><option value="top-flat">Top flat</option><option value="bottom-flat">Bottom flat</option><option value="left-flat">Left flat</option><option value="right-flat">Right flat</option></select></label>
            </>
          )}

          <div className="lab-candidate-details">
            <span>Adapter boundary</span>
            <strong>@flatten-js/core {FLATTEN_JS_CANDIDATE_VERSION}</strong>
            <small>Receives an immutable plain-data geometry input. It cannot read or change a project.</small>
          </div>

          <button type="button" className="lab-button lab-button-run" onClick={runComparison}>
            <Play size={17} fill="currentColor" /> Run comparison
          </button>

          <p className="lab-controls-note"><ShieldCheck size={16} /> Only a completed <strong>match</strong> is positive differential evidence. Rejected input, mismatch, or candidate error never authorizes adoption.</p>
        </aside>
      </section>

      <section className="experiment-lab-evidence" aria-label="Evidence">
        <header>
          <div role="tablist" aria-label="Evidence views">
            {evidenceTabs.map((tab) => (
              <button
                type="button"
                role="tab"
                id={`lab-tab-${tab}`}
                aria-controls="lab-evidence-panel"
                aria-selected={activeTab === tab}
                tabIndex={activeTab === tab ? 0 : -1}
                key={tab}
                onClick={() => setActiveTab(tab)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") { event.preventDefault(); moveEvidenceTab(tab, -1); }
                  if (event.key === "ArrowRight") { event.preventDefault(); moveEvidenceTab(tab, 1); }
                  if (event.key === "Home") { event.preventDefault(); setActiveTab("inputs"); window.requestAnimationFrame(() => document.getElementById("lab-tab-inputs")?.focus()); }
                  if (event.key === "End") { event.preventDefault(); setActiveTab("receipt"); window.requestAnimationFrame(() => document.getElementById("lab-tab-receipt")?.focus()); }
                }}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <button type="button" className="lab-button lab-button-secondary" onClick={copyReceipt} disabled={!run} title={run ? "Copy the completed differential receipt" : "Run the comparison before copying"} aria-live="polite">
            {copyState === "copied" ? <Check size={16} /> : copyState === "failed" ? <AlertTriangle size={16} /> : <Clipboard size={16} />}
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy receipt"}
          </button>
        </header>

        <div className="experiment-lab-evidence-body" id="lab-evidence-panel" role="tabpanel" aria-labelledby={`lab-tab-${activeTab}`}>
          {activeTab === "inputs" && (
            <div className="lab-evidence-grid">
              {inputSummary.map(([label, value]) => <dl key={label}><dt>{label}</dt><dd>{value}</dd></dl>)}
              <dl><dt>Baseline</dt><dd>{BASELINE_REVISION.slice(0, 12)}</dd><dt>Candidate</dt><dd>@flatten-js/core {FLATTEN_JS_CANDIDATE_VERSION}</dd></dl>
            </div>
          )}

          {activeTab === "differences" && (
            run ? (
              <div className="lab-difference-layout">
                <div className="lab-overlay-panel">
                  <strong>Difference overlay</strong>
                  <LabPlanCanvas
                    experimentId={experimentId}
                    snapshot={run.receipt.baseline}
                    comparisonSnapshot={run.receipt.candidate}
                    variant="overlay"
                  />
                </div>
                <table className="lab-difference-table">
                  <caption>Geometry comparison metrics</caption>
                  <thead><tr><th>Check</th><th>Observed</th><th>Limit</th><th>Result</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">Coordinate delta</th><td>{formatCoordinate(run.receipt.metrics.maxCoordinateDelta)}</td><td>{GEOMETRY_COMPARISON_TOLERANCE_UNITS}</td><td>{(run.receipt.metrics.maxCoordinateDelta ?? Infinity) <= GEOMETRY_COMPARISON_TOLERANCE_UNITS ? "Pass" : "Fail"}</td></tr>
                    <tr><th scope="row">Scalar delta</th><td>{formatCoordinate(run.receipt.metrics.maxScalarDelta)}</td><td>{GEOMETRY_COMPARISON_TOLERANCE_UNITS}</td><td>{(run.receipt.metrics.maxScalarDelta ?? Infinity) <= GEOMETRY_COMPARISON_TOLERANCE_UNITS ? "Pass" : "Fail"}</td></tr>
                    <tr><th scope="row">Finite snapshots</th><td>{run.receipt.metrics.baselineFinite && run.receipt.metrics.candidateFinite ? "Both finite" : "Invalid value found"}</td><td>Both finite</td><td>{run.receipt.metrics.baselineFinite && run.receipt.metrics.candidateFinite ? "Pass" : "Fail"}</td></tr>
                    <tr><th scope="row">Overall</th><td>{run.receipt.status}</td><td>match</td><td>{run.receipt.status === "match" ? "Pass" : "Fail"}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : <div className="lab-empty-state">Run comparison to generate the redraws, overlay, and difference table.</div>
          )}

          {activeTab === "performance" && (
            <div className="lab-performance-panel">
              <Activity size={22} />
              <span><strong>No performance claim</strong><b>Not benchmarked here</b><small>This route executes a correctness comparison only. Performance adoption requires controlled warm-up, repeated samples, median and p95, and representative loaded-plan browser traces.</small></span>
            </div>
          )}

          {activeTab === "receipt" && (
            run ? (
              <div className="lab-receipt-summary">
                <dl><dt>Status</dt><dd>{run.receipt.status}</dd><dt>Run ID</dt><dd>{run.runId}</dd></dl>
                <dl><dt>Evidence</dt><dd>{run.receipt.provenance.evidenceClass}</dd><dt>Comparison</dt><dd>{run.receipt.comparisonKind}</dd></dl>
                <dl><dt>Baseline</dt><dd>{run.receipt.provenance.baseline.source}</dd><dt>Revision</dt><dd>{run.receipt.provenance.baseline.revision}</dd></dl>
                <dl><dt>Candidate</dt><dd>{run.receipt.provenance.candidate.package}</dd><dt>Version</dt><dd>{run.receipt.provenance.candidate.packageVersion}</dd></dl>
                {run.receipt.rejectionReason && <div className="lab-receipt-alert"><AlertTriangle size={16} /><span><strong>Run did not match</strong>{run.receipt.rejectionReason}</span></div>}
                <div className="lab-receipt-boundaries">
                  <strong>Hard boundaries</strong>
                  <span><ShieldCheck size={14} /> No production project, storage, upload, or network access.</span>
                  <span><ShieldCheck size={14} /> A match is differential evidence, not permission to merge or deploy.</span>
                  <span><ShieldCheck size={14} /> No performance, engineering, code-compliance, or fabrication claim.</span>
                </div>
              </div>
            ) : <div className="lab-empty-state">Run comparison to create a structured differential receipt.</div>
          )}
        </div>
      </section>
    </main>
  );
}
