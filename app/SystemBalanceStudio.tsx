"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Crosshair,
  Download,
  Gauge,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Wind,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  summarizeSystemBalance,
  type BalanceReviewRecord,
  type SystemBalanceModel,
} from "./systemBalance";

type BalanceView = "overview" | "rooms" | "runs" | "reviews";

type Props = {
  open: boolean;
  projectName: string;
  model: SystemBalanceModel;
  onClose: () => void;
  onFocusDrawing: (drawingId: string) => void;
  onOpenEngineering: (view: "system" | "rooms" | "runs") => void;
  onAdjustAirflowChart: () => void;
  onApplySizes: (ids: string[]) => void;
  onApplyCfm: (ids: string[]) => void;
  onRecordReview: (reviewer: string, note: string) => void;
  onExportRooms: () => void;
  onExportRuns: () => void;
};

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function gapLabel(value: number) {
  if (!value) return "Target matched";
  return value > 0 ? `${value} CFM remaining` : `${Math.abs(value)} CFM over`;
}

export default function SystemBalanceStudio({
  open,
  projectName,
  model,
  onClose,
  onFocusDrawing,
  onOpenEngineering,
  onAdjustAirflowChart,
  onApplySizes,
  onApplyCfm,
  onRecordReview,
  onExportRooms,
  onExportRuns,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const priorEvidenceRef = useRef<string | null>(null);
  const [view, setView] = useState<BalanceView>("overview");
  const [selectedSizeIds, setSelectedSizeIds] = useState<string[]>([]);
  const [selectedCfmIds, setSelectedCfmIds] = useState<string[]>([]);
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const summary = useMemo(() => summarizeSystemBalance(model), [model]);
  const candidateSizeIds = model.runs
    .filter((run) => run.applyEligible && run.airflowReviewed && !run.overCapacity)
    .map((run) => run.id);
  const unreviewedAirflowRuns = model.runs.filter((run) => !run.airflowReviewed).length;
  const cfmApplyReady = model.roomTargetSource === "saved-targets";
  const continuousCfmIds = model.cfmProposals
    .filter((proposal) => proposal.connected && cfmApplyReady)
    .map((proposal) => proposal.id);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = requestAnimationFrame(() => {
      setView("overview");
      setSelectedSizeIds([]);
      setSelectedCfmIds([]);
      setNotice("");
      panelRef.current?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (priorEvidenceRef.current === null) {
      priorEvidenceRef.current = model.evidenceFingerprint;
      return;
    }
    if (priorEvidenceRef.current === model.evidenceFingerprint) return;
    priorEvidenceRef.current = model.evidenceFingerprint;
    const frame = requestAnimationFrame(() => {
      setSelectedSizeIds([]);
      setSelectedCfmIds([]);
      setNotice("Applied evidence changed. Review and reselect any remaining proposed changes.");
    });
    return () => cancelAnimationFrame(frame);
  }, [model.evidenceFingerprint, model.systemId, open]);

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

  function recordReview() {
    if (!reviewer.trim()) return;
    onRecordReview(reviewer.trim(), note.trim());
    setNotice(`Named coordination checkpoint recorded for ${reviewer.trim()}.`);
    setNote("");
    setView("reviews");
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: BalanceView) {
    const order: BalanceView[] = ["overview", "rooms", "runs", "reviews"];
    const index = order.indexOf(current);
    let next: BalanceView | undefined;
    if (event.key === "ArrowRight") next = order[(index + 1) % order.length];
    if (event.key === "ArrowLeft") next = order[(index - 1 + order.length) % order.length];
    if (event.key === "Home") next = order[0];
    if (event.key === "End") next = order.at(-1);
    if (!next) return;
    event.preventDefault();
    setView(next);
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(`[data-balance-tab="${next}"]`)?.focus();
    });
  }

  return <div className="system-balance-overlay" role="presentation">
    <button className="system-balance-dismiss" aria-label="Close Airflow and Duct Sizes" tabIndex={-1} aria-hidden="true" onClick={onClose} />
    <section
      ref={panelRef}
      className="system-balance-studio"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-balance-title"
      onKeyDown={handleKeyDown}
    >
      <header className="system-balance-header">
        <div className="system-balance-brand">
          <span><Wind size={20} /></span>
          <div>
            <small>AIRFLOW &amp; DUCT SIZES</small>
            <h2 id="system-balance-title">Check airflow, connected paths, and recommended sizes</h2>
            <p>{projectName} · {model.systemName}</p>
          </div>
        </div>
        <div className="system-balance-header-actions">
          <span className={summary.tone}><i /> {summary.tone === "clear" ? "COORDINATION READY" : summary.tone === "hold" ? "DESIGN HOLD" : "COORDINATION DRAFT"}</span>
          <button aria-label="Close Airflow and Duct Sizes" onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      <div className="system-balance-command">
        <div className={`balance-score-ring ${summary.tone}`}>
          <strong>{summary.score}</strong>
          <span>COORD.</span>
        </div>
        <div>
          <small>NEXT COORDINATION ACTION</small>
          <strong>{summary.headline}</strong>
          <p>Candidates follow terminal-linked or manually entered CFM and your velocity limits. Every change remains selected, reviewed, and undoable.</p>
        </div>
        <button onClick={() => setView(summary.unresolvedNetworks || summary.disconnectedDevices ? "overview" : model.cfmProposals.length ? "rooms" : "runs")}>
          Open next review <ArrowRight size={15} />
        </button>
      </div>

      <div className="system-balance-metrics">
        <article className={summary.planningEstimate ? "attention" : "clear"}><small>{summary.planningEstimate ? "PLANNING AIRFLOW" : "USER-ENTERED AIRFLOW"}</small><strong>{model.designCfm.toLocaleString()}</strong><span>{model.airflowTargetSource.replaceAll("-", " ")}</span></article>
        <article className={Math.abs(summary.supplyGap) <= Math.max(25, model.designCfm * .1) ? "clear" : "attention"}><small>SUPPLY SCHEDULED</small><strong>{model.supplyCfm.toLocaleString()}</strong><span>{gapLabel(summary.supplyGap)}</span></article>
        <article className={Math.abs(summary.returnGap) <= Math.max(50, model.designCfm * .1) ? "clear" : "attention"}><small>RETURN VS PLANNING BASELINE</small><strong>{model.returnCfm.toLocaleString()}</strong><span>{gapLabel(summary.returnGap)}</span></article>
        <article className={summary.unresolvedNetworks || summary.disconnectedDevices ? "hold" : "clear"}><small>NETWORK HEALTH</small><strong>{summary.unresolvedNetworks + summary.disconnectedDevices}</strong><span>unresolved paths / devices</span></article>
      </div>

      <nav className="system-balance-tabs" role="tablist" aria-label="Airflow and Duct Sizes sections">
        {([
          ["overview", "System overview", model.networks.filter((row) => !row.balanced).length],
          ["rooms", "Room CFM", model.cfmProposals.length],
          ["runs", "Duct sizes", model.runs.length],
          ["reviews", "Review history", model.reviews.length],
        ] as Array<[BalanceView, string, number]>).map(([id, label, count]) => <button
          key={id}
          id={`system-balance-tab-${id}`}
          data-balance-tab={id}
          className={view === id ? "active" : ""}
          role="tab"
          aria-selected={view === id}
          aria-controls={`system-balance-panel-${id}`}
          tabIndex={view === id ? 0 : -1}
          onClick={() => setView(id)}
          onKeyDown={(event) => handleTabKeyDown(event, id)}
        >
          {label}<b>{count}</b>
        </button>)}
      </nav>

      <div className="system-balance-workspace">
        {view === "overview" && <section id="system-balance-panel-overview" className="balance-overview-view" role="tabpanel" aria-labelledby="system-balance-tab-overview">
          <div className="balance-flow-compare">
            <article>
              <div><span>Supply assignment</span><b>{summary.supplyPercent}%</b></div>
              <i><em style={{ width: `${Math.min(100, Math.max(0, summary.supplyPercent))}%` }} /></i>
              <small>{model.connectedSupplyTerminals}/{model.supplyTerminalCount} devices on a continuous path to equipment · {model.connectedSupplyCfm} traced CFM</small>
            </article>
            <article>
              <div><span>Return assignment</span><b>{summary.returnPercent}%</b></div>
              <i><em style={{ width: `${Math.min(100, Math.max(0, summary.returnPercent))}%` }} /></i>
              <small>{model.connectedReturnTerminals}/{model.returnTerminalCount} devices on a continuous path to the return plenum · {model.connectedReturnCfm} traced CFM</small>
            </article>
          </div>
          <div className="balance-network-list">
            <div className="balance-section-heading"><span><strong>EQUIPMENT NETWORKS</strong><small>Physically aligned supply paths and branch health</small></span><button onClick={() => onOpenEngineering("system")}>Calculation assumptions</button></div>
            {model.networks.length ? model.networks.map((row) => <article className={row.balanced ? "clear" : "attention"} key={row.unitId}>
              <button onClick={() => onFocusDrawing(row.firstProblemDrawingId || row.unitId)}>
                <span><strong>{row.unitLabel}</strong><small>{row.rootRunId ? `${row.runCount} runs · ${row.fittingCount} T Branch · ${row.terminalCount} diffusers` : "Supply plenum is not connected"}</small></span>
                <b>{row.balanced ? "SCHEDULE ALIGNED" : row.rootRunId ? "REVIEW" : "DISCONNECTED"}</b>
              </button>
              <dl>
                <div><dt>PLANNING TARGET</dt><dd>{row.designCfm} CFM</dd></div>
                <div><dt>TRACED</dt><dd>{row.assignedCfm} CFM</dd></div>
                <div><dt>REMAINING</dt><dd>{signed(row.remainingCfm)} CFM</dd></div>
                <div><dt>PROBLEMS</dt><dd>{row.problemCount}</dd></div>
              </dl>
            </article>) : <div className="system-balance-empty"><Route size={25} /><strong>No equipment network yet</strong><span>Place an indoor unit and connect its supply plenum to a run.</span></div>}
          </div>
          <div className="balance-review-health">
            <article className={summary.overCapacityRuns ? "hold" : "clear"}><Gauge size={17} /><span><strong>{summary.overCapacityRuns} over-capacity runs</strong><small>{summary.overCapacityRuns ? "Add a parallel path or revise the design manually." : "Every proposed size stays within the current velocity limits."}</small></span></article>
            <article className={summary.missingReturnRooms ? "attention" : "clear"}><ShieldCheck size={17} /><span><strong>{summary.missingReturnRooms} bedroom return-path reviews</strong><small>{summary.missingReturnRooms ? "Verify a dedicated return or documented transfer path." : "Assigned bedrooms have a return path in the current schedule."}</small></span></article>
          </div>
          <div className="balance-method-note balance-safety-note">
            <AlertTriangle size={16} />
            <div>
              <p><strong>Planning estimate—not a Manual J, S, D, or T design, permit calculation, TAB report, or manufacturer selection.</strong></p>
              <ul>
                <li>Entered airflow, scale, duct construction, fittings, installation, altitude, leakage, accessories, and blower data all affect the result.</li>
                <li>The editable 400 CFM/ton starting value and the return planning baseline are coordination seeds, not verified design airflow.</li>
                <li>Confirm final sizes, airflow, static pressure, sound, ventilation, code, and equipment operation with approved plans, OEM data, applicable ACCA/ASHRAE procedures, field measurements, and the responsible licensed professional or AHJ.</li>
              </ul>
            </div>
          </div>
        </section>}

        {view === "rooms" && <section id="system-balance-panel-rooms" className="balance-room-view" role="tabpanel" aria-labelledby="system-balance-tab-rooms">
          <div className="balance-section-heading">
            <span><strong>ROOM AIRFLOW REVIEW</strong><small>{model.roomTargetSource === "draft-allocation" ? "Draft even-allocation—save targets before applying" : "Saved coordination targets—not room-load calculations"}</small></span>
            <div><button onClick={onExportRooms}><Download size={14} /> Room CSV</button><button onClick={() => onOpenEngineering("rooms")}>Edit targets</button></div>
          </div>
          <div className="balance-room-review-list">
            {model.rooms.length ? model.rooms.map((room) => <article className={room.needsReturn || room.missingCfm ? "attention" : "clear"} key={room.name}>
              <button onClick={() => room.drawingIds[0] && onFocusDrawing(room.drawingIds[0])}>
                <span><strong>{room.name}</strong><small>{room.type} · {room.connectedDevices}/{room.deviceCount} continuous paths to equipment</small></span>
                <Crosshair size={15} />
              </button>
              <dl>
                <div><dt>SUPPLY TARGET</dt><dd>{room.supplyTarget}</dd></div>
                <div><dt>SCHEDULED</dt><dd>{room.supplyScheduled}<em>{signed(room.supplyScheduled - room.supplyTarget)}</em></dd></div>
                <div><dt>RETURN TARGET</dt><dd>{room.returnTarget}</dd></div>
                <div><dt>SCHEDULED</dt><dd>{room.returnScheduled}<em>{signed(room.returnScheduled - room.returnTarget)}</em></dd></div>
              </dl>
              {room.needsReturn && <p><AlertTriangle size={13} /> Bedroom has supply air but no dedicated return grille. Verify a transfer path if no return is added.</p>}
              {room.missingCfm > 0 && <p><AlertTriangle size={13} /> {room.missingCfm} device{room.missingCfm === 1 ? "" : "s"} still need scheduled CFM.</p>}
            </article>) : <div className="system-balance-empty"><Wind size={25} /><strong>No room schedule yet</strong><span>Assign room names to supply diffusers and return grilles.</span></div>}
          </div>
          <div className="balance-proposal-tray">
            <div><span><strong>{cfmApplyReady ? "SAVED-TARGET CFM CANDIDATES" : "DRAFT TERMINAL CFM"}</strong><small>{cfmApplyReady ? "Only continuous equipment paths can be applied" : "Open Edit targets, review the allocation, then save or recalculate targets"}</small></span><b>{selectedCfmIds.length}/{model.cfmProposals.length}</b></div>
            <div className="balance-proposal-actions">
              <button disabled={!continuousCfmIds.length} onClick={() => setSelectedCfmIds(continuousCfmIds)}>Select continuous</button>
              <button disabled={!selectedCfmIds.length} onClick={() => setSelectedCfmIds([])}>Clear</button>
            </div>
            {model.cfmProposals.map((proposal) => <div className={`balance-select-row ${!proposal.connected || !cfmApplyReady ? "disconnected" : ""}`} key={proposal.id}>
              <input id={`balance-cfm-${proposal.id}`} aria-label={`Select ${proposal.room} ${proposal.kind} CFM candidate`} type="checkbox" disabled={!proposal.connected || !cfmApplyReady} checked={selectedCfmIds.includes(proposal.id)} onChange={() => setSelectedCfmIds((current) => current.includes(proposal.id) ? current.filter((id) => id !== proposal.id) : [...current, proposal.id])} />
              <button type="button" onClick={() => onFocusDrawing(proposal.drawingId)}><span><strong>{proposal.room} · {proposal.kind}</strong><small>{proposal.label} · {proposal.connected ? "continuous equipment path" : "complete the equipment path first"}</small></span><b>{proposal.current} → {proposal.proposed} CFM</b></button>
            </div>)}
            <button className="balance-apply" disabled={!selectedCfmIds.length} onClick={() => { const count = selectedCfmIds.length; onApplyCfm(selectedCfmIds); setSelectedCfmIds([]); setNotice(`${count} reviewed terminal CFM change${count === 1 ? "" : "s"} applied in one undoable step.`); }}>
              Apply {selectedCfmIds.length} reviewed CFM change{selectedCfmIds.length === 1 ? "" : "s"} · one Undo
            </button>
          </div>
        </section>}

        {view === "runs" && <section id="system-balance-panel-runs" className="balance-run-view" role="tabpanel" aria-labelledby="system-balance-tab-runs">
          <div className="balance-section-heading">
            <span><strong>TRANSPARENT DUCT SIZE REVIEW · V112</strong><small>{model.ductSizingVersion} · candidates do not verify pressure, sound, blower performance, or installation conditions</small></span>
            <div><button disabled={!model.runs.length} onClick={onExportRuns}><Download size={14} /> Review CSV</button><button onClick={() => onOpenEngineering("runs")}>Calculation assumptions</button></div>
          </div>
          <div className="balance-rule-strip">
            <span><b>{model.rules.residentialFlexMax}″</b> max residential flex</span>
            <span><b>{model.rules.supplyVelocityLimit}</b> supply FPM</span>
            <span><b>{model.rules.returnVelocityLimit}</b> return FPM</span>
            <span><b>{model.rules.freshVelocityLimit}</b> fresh-air FPM</span>
          </div>
          <div className="balance-run-actions">
            <button disabled={!candidateSizeIds.length} onClick={() => setSelectedSizeIds(candidateSizeIds)}>Select velocity-screened candidates</button>
            <button disabled={!selectedSizeIds.length} onClick={() => setSelectedSizeIds([])}>Clear</button>
          </div>
          {unreviewedAirflowRuns > 0 && <div className="balance-method-note">
            <AlertTriangle size={16} />
            <p><strong>{unreviewedAirflowRuns} size candidate{unreviewedAirflowRuns === 1 ? " is" : "s are"} paused.</strong> Replace planning-seed contributors with fingerprint-matched reviewed room targets or explicit manual values first.</p>
          </div>}
          <div className="balance-method-note balance-safety-note">
            <AlertTriangle size={16} />
            <div>
              <p><strong>Velocity preview only. Pressure remains unverified.</strong></p>
              <ul>
                <li>Diameter follows terminal-linked or manual CFM, the configured velocity limit, and the supported flex ceiling.</li>
                <li>Shown friction and segment loss are rough planning estimates only when scale is verified; they do not use a blower table, available static pressure, or a complete critical path.</li>
              </ul>
            </div>
          </div>
          <div className="balance-run-review-list">
            {model.runs.length ? model.runs.map((run) => <div className={`balance-select-row ${run.sizingStatus === "blocked" ? "over-capacity" : ""}`} key={run.id}>
              <input id={`balance-size-${run.id}`} aria-label={`Select ${run.room} ${run.type} size candidate`} type="checkbox" disabled={!run.applyEligible || !run.airflowReviewed || run.overCapacity} checked={selectedSizeIds.includes(run.id)} onChange={() => setSelectedSizeIds((current) => current.includes(run.id) ? current.filter((id) => id !== run.id) : [...current, run.id])} />
              <button type="button" onClick={() => onFocusDrawing(run.id)}>
                <span><strong>{run.room} · {run.type.toUpperCase()}</strong><small>{run.cfm} CFM · {run.airflowSource} airflow · {run.classification.replaceAll("-", " ")} · {run.sizingStatus}</small></span>
                <em>{run.currentVelocity} → {run.recommendedVelocity} FPM · {run.velocityLimit} FPM limit</em>
                <b>{run.overCapacity && run.currentSize === run.recommendedSize ? `${run.currentSize}″ MAX` : `${run.currentSize}″ → ${run.recommendedSize}″`}</b>
              </button>
              <p>{model.scaleVerified
                ? `${run.physicalLength.toFixed(1)} ft drawn · ${run.equivalentLength.toFixed(1)} ft assumed equivalent · ~${run.frictionRate.toFixed(3)} in. w.g./100 ft · ~${run.pressureDrop.toFixed(3)} in. w.g. segment estimate`
                : "Scale is not verified, so length, friction-path, and segment-loss evidence is withheld."}</p>
              {run.reasonCodes.includes("MANUAL_CFM_BELOW_DOWNSTREAM") && <p className="attention">Manual CFM is below the connected downstream demand; the preview safely uses the higher terminal-linked airflow.</p>}
              {!run.airflowReviewed && <p className="attention">The governing airflow includes an unreviewed planning seed or stale room-target review fingerprint. Guided resizing is blocked.</p>}
              {run.overCapacity && <p className="attention">No supported single flex run passes {run.velocityLimit} FPM. {run.alternatives[0]
                ? `Review ${run.alternatives[0].pathCount} parallel ${run.alternatives[0].diameterInches}″ paths at about ${Math.round(run.alternatives[0].airflowPerPathCfm)} CFM each, or revise the trunk material and topology manually.`
                : "Revise the trunk material or topology manually."}</p>}
            </div>) : <div className="system-balance-empty"><CheckCircle2 size={25} /><strong>No velocity-screened changes are waiting</strong><span>Current sizes are within the entered FPM screens; pressure and sound still require verification.</span></div>}
          </div>
          <button className="balance-apply" disabled={!selectedSizeIds.length} onClick={() => { const count = selectedSizeIds.length; onApplySizes(selectedSizeIds); setSelectedSizeIds([]); setNotice(`${count} size candidate${count === 1 ? "" : "s"} sent to Guided Repair for reviewer identity, pressure override, and final confirmation.`); }}>
            Continue {selectedSizeIds.length} size candidate{selectedSizeIds.length === 1 ? "" : "s"} in Guided Repair
          </button>
        </section>}

        {view === "reviews" && <section id="system-balance-panel-reviews" className="balance-review-view" role="tabpanel" aria-labelledby="system-balance-tab-reviews">
          <div className="balance-section-heading"><span><strong>NAMED COORDINATION CHECKPOINTS</strong><small>Evidence-bound records—not design approval or a TAB report</small></span></div>
          {summary.latestReview && <div className={`balance-latest-review ${summary.reviewStale ? "stale" : "current"}`}>
            {summary.reviewStale ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span><strong>{summary.reviewStale ? "Evidence changed—review again" : "Current evidence reviewed"}</strong><small>{summary.latestReview.reviewer} · {new Date(summary.latestReview.createdAt).toLocaleString()}</small></span>
            <b>{summary.latestReview.score}</b>
          </div>}
          <div className="balance-review-form">
            <div><ClipboardCheck size={20} /><span><strong>Record this coordination state</strong><small>This records the current evidence. It never locks or changes drawing geometry.</small></span></div>
            <label>Reviewer name<input value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Required" /></label>
            <label>Review note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was reviewed, held, or released for further coordination?" /></label>
            <button disabled={!reviewer.trim()} onClick={recordReview}><ClipboardCheck size={15} /> Record checkpoint</button>
          </div>
          <div className="balance-review-history">
            {model.reviews.length ? [...model.reviews].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map((review: BalanceReviewRecord) => <article className={review.evidenceFingerprint === model.evidenceFingerprint ? "current" : "stale"} key={review.id}>
              <span>{review.evidenceFingerprint === model.evidenceFingerprint ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span>
              <div><strong>{review.reviewer}</strong><small>{new Date(review.createdAt).toLocaleString()} · coordination score {review.score}</small><p>{review.note || "No note recorded."}</p></div>
              <dl><div><dt>SUPPLY</dt><dd>{review.supplyCfm}/{review.designCfm}</dd></div><div><dt>RETURN</dt><dd>{review.returnCfm}/{review.designCfm}</dd></div><div><dt>OPEN</dt><dd>{review.openSizeRecommendations + review.openCfmRecommendations + review.connectionProblems}</dd></div></dl>
            </article>) : <div className="system-balance-empty"><ClipboardCheck size={25} /><strong>No named review yet</strong><span>Record one after the system, room CFM, and proposed sizes have been checked.</span></div>}
          </div>
        </section>}
      </div>

      <footer className="system-balance-footer">
        {notice && <div className="balance-live-notice" role="status" aria-live="polite">{notice}</div>}
        <div className="manual-balance-policy"><SlidersHorizontal size={17} /><span><strong>Manual route shapes stay manual.</strong><small>Guided Repair changes only reviewed diameters and may align listed attached endpoints to resized fitting ports; intermediate route vertices never move. Studio never draws new runs, reroutes paths, balances airflow, or numbers ductwork automatically.</small></span></div>
        <button onClick={onAdjustAirflowChart}><SlidersHorizontal size={15} /> Airflow chart</button>
        <button onClick={() => onOpenEngineering(view === "overview" || view === "reviews" ? "system" : view)}><Gauge size={15} /> Calculation details</button>
        <button className="primary" onClick={onClose}><ShieldCheck size={15} /> Return to plan</button>
      </footer>
    </section>
  </div>;
}
