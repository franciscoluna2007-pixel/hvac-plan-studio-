"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  FileCheck2,
  Mail,
  PackageCheck,
  Printer,
  Send,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  finishJobGateActionLabel,
  type FinishJobGate,
  type FinishJobModel,
  type FinishJobStepId,
} from "./finishJob";

export type FinishJobMaterialRow = {
  category: string;
  item: string;
  size: string;
  quantity: string;
  note: string;
  breakdown?: string;
};

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

type MaterialReview = {
  id: string;
  reviewedBy: string;
  reviewedAt: string;
  current: boolean;
};

type ReleaseSummary = {
  released: boolean;
  stale: boolean;
  status: string;
  revision?: string;
  releasedBy?: string;
  releasedAt?: string;
};

type Props = {
  open: boolean;
  projectName: string;
  systemName: string;
  model: FinishJobModel;
  materialRows: FinishJobMaterialRow[];
  materialAllowance: number;
  materialFlexRolls: number;
  materialDeviceCount: number;
  materialFittingCount: number;
  materialHoldCount: number;
  materialReview?: MaterialReview;
  planCheckCount: number;
  checklist: ChecklistItem[];
  release: ReleaseSummary;
  revision: string;
  reviewedBy: string;
  note: string;
  approvalFingerprint: string;
  issuing: boolean;
  canIssue: boolean;
  issueBlockedReason?: string;
  onClose: () => void;
  onMaterialAllowanceChange: (value: number) => void;
  onReviewMaterials: (reviewer: string) => void;
  onOpenGate: (gate: FinishJobGate) => void;
  onChecklistChange: (id: string, checked: boolean) => void;
  onRevisionChange: (value: string) => void;
  onReviewedByChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onIssue: (approvalFingerprint: string) => void;
  onOpenPrint: () => void;
  onPrintPlanSet: () => Promise<void>;
  onExportPdf: () => Promise<void>;
  onCreateEmailDraft: (input: { recipient: string; subject: string; message: string }) => Promise<void>;
  onCopySummary: () => void;
  onDownloadMaterials: () => void;
  onOpenPlanCheck: () => void;
  onDownloadRuns: () => void;
  onDownloadRelease: () => void;
};

function FinalApprovalControl({
  fingerprint,
  issuing,
  canIssue,
  revision,
  releaseStale,
  onIssue,
}: {
  fingerprint: string;
  issuing: boolean;
  canIssue: boolean;
  revision: string;
  releaseStale: boolean;
  onIssue: (fingerprint: string) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return <>
    <label className={`finish-final-confirmation ${confirmed ? "checked" : ""}`}>
      <input
        type="checkbox"
        checked={confirmed}
        disabled={issuing}
        onChange={(event) => setConfirmed(event.target.checked)}
      />
      <span>{confirmed ? <Check size={16} /> : null}</span>
      <strong>I reviewed this exact plan, material list, holds, and field checklist.</strong>
    </label>
    <button
      className="finish-issue-button"
      disabled={!canIssue || !confirmed || issuing}
      onClick={() => onIssue(fingerprint)}
    >
      <FileCheck2 size={17} />
      {issuing ? "Rechecking current work…" : releaseStale ? "Issue updated revision" : `Issue ${revision.trim() ? `revision ${revision.trim()}` : "revision"} for field use`}
    </button>
  </>;
}

export default function FinishJobStudio({
  open,
  projectName,
  systemName,
  model,
  materialRows,
  materialAllowance,
  materialFlexRolls,
  materialDeviceCount,
  materialFittingCount,
  materialHoldCount,
  materialReview,
  planCheckCount,
  checklist,
  release,
  revision,
  reviewedBy,
  note,
  approvalFingerprint,
  issuing,
  canIssue,
  issueBlockedReason,
  onClose,
  onMaterialAllowanceChange,
  onReviewMaterials,
  onOpenGate,
  onChecklistChange,
  onRevisionChange,
  onReviewedByChange,
  onNoteChange,
  onIssue,
  onOpenPrint,
  onPrintPlanSet,
  onExportPdf,
  onCreateEmailDraft,
  onCopySummary,
  onDownloadMaterials,
  onOpenPlanCheck,
  onDownloadRuns,
  onDownloadRelease,
}: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [activeStep, setActiveStep] = useState<FinishJobStepId>(model.currentStep);
  const [materialReviewer, setMaterialReviewer] = useState(materialReview?.reviewedBy || reviewedBy);
  const [showEmail, setShowEmail] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState(`${projectName} HVAC plan set`);
  const [emailMessage, setEmailMessage] = useState(`Attached is the reviewed HVAC plan set for ${projectName}.`);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [outputBusy, setOutputBusy] = useState<"print" | "pdf" | "email" | null>(null);

  const activeStepModel = useMemo(
    () => model.steps.find((step) => step.id === activeStep) || model.steps[0],
    [activeStep, model.steps],
  );
  const openHolds = model.technicalHolds;
  const finalOutputReady = release.released && !release.stale;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("[data-active-step], button, input")?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!issuing) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
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

  function moveToNextAvailableStep() {
    const index = model.steps.findIndex((step) => step.id === activeStep);
    const next = model.steps.slice(index + 1).find((step) => !step.complete && !step.waiting) ||
      model.steps.find((step) => !step.complete && !step.waiting);
    if (next) setActiveStep(next.id);
  }

  return <div className="finish-job-overlay" role="presentation">
    <button className="finish-job-dismiss" disabled={issuing} tabIndex={-1} aria-hidden="true" aria-label="Close Finish the Job" onClick={onClose} />
    <section
      ref={dialogRef}
      className="finish-job-studio"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finish-job-title"
      onKeyDown={handleKeyDown}
    >
      <header className="finish-job-header">
        <div className="finish-job-brand">
          <span><FileCheck2 size={21} /></span>
          <div>
            <small>V132 · ONE CLOSEOUT PATH</small>
            <h2 id="finish-job-title">Finish the Job</h2>
            <p>{projectName} · {systemName}</p>
          </div>
        </div>
        <div className="finish-job-header-status" aria-live="polite">
          <button className="finish-plan-check-action" disabled={issuing} onClick={onOpenPlanCheck}>
            <ShieldCheck size={15} /> Check connections{planCheckCount ? ` · ${planCheckCount}` : ""}
          </button>
          <span><b>{model.progress}%</b><small>{model.jobReady ? "READY" : `${5 - model.completedSteps} LEFT`}</small></span>
          <button disabled={issuing} aria-label="Close Finish the Job" onClick={onClose}><X size={19} /></button>
        </div>
      </header>

      <div className="finish-job-progress" aria-hidden="true"><i style={{ width: `${model.progress}%` }} /></div>

      <div className="finish-job-body">
        <nav className="finish-job-steps" aria-label="Finish the Job steps">
          <ol>
            {model.steps.map((step, index) => <li key={step.id}>
              <button
                id={`finish-step-${step.id}`}
                data-active-step={activeStep === step.id ? true : undefined}
                className={`${activeStep === step.id ? "active" : ""} ${step.complete ? "complete" : ""} ${step.waiting ? "waiting" : ""}`}
                aria-current={activeStep === step.id ? "step" : undefined}
                aria-expanded={activeStep === step.id}
                aria-controls={`finish-panel-${step.id}`}
                aria-label={`${index + 1}. ${step.label}. ${step.complete ? "Clear" : step.waiting ? "Waiting" : "Needs attention"}. ${step.detail}`}
                disabled={issuing}
                onClick={() => setActiveStep(step.id)}
              >
                <b>{step.complete ? <Check size={16} /> : index + 1}</b>
                <span><strong>{step.label}</strong><small>{step.detail}</small></span>
                <ChevronRight size={16} />
              </button>
            </li>)}
          </ol>
          <div className={`finish-job-safety ${model.jobReady ? "ready" : "review"}`}>
            <ShieldCheck size={17} />
            <span>
              <strong>{model.jobReady ? "Current reviewed package" : "Nothing issues automatically"}</strong>
              <small>{model.jobReady
                ? "A plan, checklist, review, or material change will mark it stale."
                : "You choose what is reviewed, approved, printed, and shared."}</small>
            </span>
          </div>
        </nav>

        <div
          className="finish-job-workspace"
          id={`finish-panel-${activeStep}`}
          role="region"
          aria-labelledby={`finish-step-${activeStep}`}
        >
          <div className="finish-job-section-heading">
            <span><b>{model.steps.findIndex((step) => step.id === activeStep) + 1}</b></span>
            <div><small>CURRENT TASK</small><h3>{activeStepModel.label}</h3><p>{activeStepModel.detail}</p></div>
            <em className={activeStepModel.complete ? "clear" : activeStepModel.waiting ? "waiting" : "open"}>
              {activeStepModel.complete ? "CLEAR" : activeStepModel.waiting ? "WAITING" : "DO THIS"}
            </em>
          </div>

          {activeStep === "materials" && <section className="finish-materials">
            <div className="finish-material-metrics">
              <article><small>Line items</small><strong>{materialRows.length}</strong><span>Current system</span></article>
              <article><small>25-ft flex rolls</small><strong>{materialFlexRolls}</strong><span>Allowance included</span></article>
              <article><small>Air devices</small><strong>{materialDeviceCount}</strong><span>Supply + return</span></article>
              <article><small>T Branch fittings</small><strong>{materialFittingCount}</strong><span>Saved geometry</span></article>
            </div>

            <div className="finish-material-control">
              <label>Material allowance
                <select disabled={issuing} value={materialAllowance} onChange={(event) => onMaterialAllowanceChange(Number(event.target.value))}>
                  {[0, 5, 10, 15, 20].map((value) => <option value={value} key={value}>{value}% waste</option>)}
                </select>
              </label>
              <button disabled={issuing || !materialRows.length} onClick={onDownloadMaterials}><Download size={15} /> Download purchase list</button>
            </div>

            {materialHoldCount > 0 && <div className="finish-inline-warning">
              <AlertTriangle size={17} />
              <span><strong>{materialHoldCount} coordination item{materialHoldCount === 1 ? "" : "s"} still affect fabrication.</strong><small>Review the quantities now, then clear those items in the next step before field issue.</small></span>
            </div>}

            {materialRows.length ? <details className="finish-material-list">
              <summary><PackageCheck size={16} /> Review all {materialRows.length} material items</summary>
              <div>
                {materialRows.map((row, index) => <article key={`${row.item}-${row.size}-${index}`}>
                  <span><i>{row.category}</i><strong>{row.item}</strong><small>{row.size}</small></span>
                  <b>{row.quantity}</b>
                </article>)}
              </div>
            </details> : <div className="finish-empty">
              <PackageCheck size={25} /><strong>No material list yet</strong><span>Draw duct runs or place HVAC equipment, then return here.</span>
            </div>}

            <div className={`finish-review-receipt ${materialReview?.current ? "current" : materialReview ? "stale" : "open"}`}>
              <div>
                {materialReview?.current ? <CheckCircle2 size={20} /> : <ClipboardCheck size={20} />}
                <span>
                  <strong>{materialReview?.current ? "Current quantities reviewed" : materialReview ? "Quantities changed · review again" : "Confirm the current quantities"}</strong>
                  <small>{materialReview?.current
                    ? `${materialReview.reviewedBy} · ${new Date(materialReview.reviewedAt).toLocaleString()}`
                    : "This creates a system-scoped review receipt. It does not order material or change the plan."}</small>
                </span>
              </div>
              {!materialReview?.current && <div>
                <label>Reviewed by
                  <input disabled={issuing} value={materialReviewer} onChange={(event) => setMaterialReviewer(event.target.value)} placeholder="Name or initials" />
                </label>
                <button
                  disabled={issuing || !materialRows.length || !materialReviewer.trim()}
                  onClick={() => onReviewMaterials(materialReviewer.trim())}
                ><Check size={15} /> Materials reviewed for this plan</button>
              </div>}
            </div>
          </section>}

          {activeStep === "holds" && <section className="finish-holds">
            {openHolds.length ? <>
              <div className="finish-inline-warning">
                <Wrench size={18} />
                <span><strong>{openHolds.length} item{openHolds.length === 1 ? "" : "s"} need attention.</strong><small>Open one item, fix it in the correct plan tool, then return to Finish the Job.</small></span>
              </div>
              <div className="finish-hold-list">
                {openHolds.map((gate) => <article key={gate.id}>
                  <span><AlertTriangle size={17} /></span>
                  <div><strong>{gate.label}</strong><p>{gate.detail}</p></div>
                  <button disabled={issuing} onClick={() => onOpenGate(gate)}>{finishJobGateActionLabel(gate.id)} <ChevronRight size={15} /></button>
                </article>)}
              </div>
            </> : <div className="finish-clear-state">
              <CheckCircle2 size={31} />
              <strong>Plan and coordination holds are clear</strong>
              <span>Continue to the field checklist. A later plan or review change can reopen a hold.</span>
              <button disabled={issuing} onClick={moveToNextAvailableStep}>Continue to checklist <ChevronRight size={16} /></button>
            </div>}
          </section>}

          {activeStep === "checklist" && <section className="finish-checklist">
            <fieldset>
              <legend>Field release checks</legend>
              <p>{checklist.filter((item) => item.checked).length} of {checklist.length} field checks complete. Check only what you have actually verified.</p>
              {checklist.map((item) => <label className={item.checked ? "checked" : ""} key={item.id}>
                <input disabled={issuing} type="checkbox" checked={item.checked} onChange={(event) => onChecklistChange(item.id, event.target.checked)} />
                <span>{item.checked ? <Check size={15} /> : null}</span>
                <strong>{item.label}</strong>
              </label>)}
            </fieldset>
            <div className="finish-guardrail"><ShieldCheck size={16} /><span>The checklist records coordination only. It never changes drawing geometry, airflow, duct sizes, or connections.</span></div>
          </section>}

          {activeStep === "revision" && <section className="finish-revision">
            {model.cloudGate && !model.cloudGate.clear && <article className="finish-cloud-hold">
              <AlertTriangle size={18} />
              <span><strong>{model.cloudGate.label}</strong><small>{model.cloudGate.detail}</small></span>
               <button disabled={issuing} onClick={() => onOpenGate(model.cloudGate!)}>{finishJobGateActionLabel("cloud")}</button>
            </article>}

            <div className={`finish-release-state ${release.stale ? "stale" : release.released ? "released" : "draft"}`}>
              {release.released && !release.stale ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              <span>
                <small>CURRENT REVISION STATE</small>
                <strong>{release.stale ? "Prior issue is stale" : release.released ? `Revision ${release.revision} is current` : release.status}</strong>
                <p>{release.released && release.releasedAt
                  ? `${release.releasedBy} · ${new Date(release.releasedAt).toLocaleString()}`
                  : "Enter a revision and reviewer. Nothing is issued until you confirm the exact current state."}</p>
              </span>
            </div>

            <div className="finish-revision-fields">
              <label>Revision name
                 <input disabled={issuing} value={revision} onChange={(event) => onRevisionChange(event.target.value)} placeholder="IFC-1, A, or Field 1" />
              </label>
              <label>Reviewed by
                 <input disabled={issuing} value={reviewedBy} onChange={(event) => onReviewedByChange(event.target.value)} placeholder="Name or initials" />
              </label>
              <label className="wide">Field note <span>(optional)</span>
                 <textarea disabled={issuing} value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="Scope, accepted exceptions, and installer instructions" />
              </label>
            </div>

            {issueBlockedReason && <div className="finish-issue-blocked"><AlertTriangle size={15} /> {issueBlockedReason}</div>}
            <FinalApprovalControl
              key={approvalFingerprint}
              fingerprint={approvalFingerprint}
              issuing={issuing}
              canIssue={canIssue}
              revision={revision}
              releaseStale={release.stale}
              onIssue={onIssue}
            />
            <p className="finish-revision-note">Any later plan, checklist, review, material allowance, or quantity change marks this revision stale.</p>
          </section>}

          {activeStep === "print-share" && <section className="finish-output">
            {release.released && !release.stale ? <div className="finish-clear-state compact">
              <CheckCircle2 size={31} />
              <strong>Revision {release.revision} is ready</strong>
              <span>Print or save the field package as a PDF, then share it from this device. Optional sections that are not current will print as a draft.</span>
            </div> : <div className="finish-inline-warning">
              <AlertTriangle size={18} />
              <span><strong>A current issued revision is required for final output.</strong><small>You can still print a clearly watermarked draft from the package composer.</small></span>
            </div>}
            <div className="finish-output-actions">
              <button className="primary" disabled={!finalOutputReady || Boolean(outputBusy)} onClick={async () => {
                setOutputBusy("print");
                try { await onPrintPlanSet(); } finally { setOutputBusy(null); }
              }}><Printer size={18} /> {outputBusy === "print" ? "Preparing plan set..." : "Print plan set"}</button>
              <button disabled={!finalOutputReady || Boolean(outputBusy)} onClick={async () => {
                setOutputBusy("pdf");
                try { await onExportPdf(); } finally { setOutputBusy(null); }
              }}><Download size={18} /> {outputBusy === "pdf" ? "Building PDF..." : "Download PDF"}</button>
              <button disabled={!finalOutputReady || Boolean(outputBusy)} onClick={() => {
                setShowEmail((current) => !current);
                setEmailConfirmed(false);
              }}><Mail size={18} /> Email plan</button>
              <button onClick={onOpenPrint}><PackageCheck size={18} /> Package options</button>
              <button disabled={!release.released || release.stale} onClick={onCopySummary}><Copy size={18} /> Copy revision summary</button>
            </div>
            {showEmail && <div className="finish-email-review" aria-label="Review plan email">
              <div className="finish-email-heading">
                <Mail size={18} />
                <span><strong>Review the email</strong><small>The generated PDF plan set will be attached.</small></span>
              </div>
              <label>Recipient
                <input type="email" value={emailRecipient} onChange={(event) => {
                  setEmailRecipient(event.target.value);
                  setEmailConfirmed(false);
                }} placeholder="foreman@example.com" />
              </label>
              <label>Subject
                <input value={emailSubject} onChange={(event) => {
                  setEmailSubject(event.target.value);
                  setEmailConfirmed(false);
                }} />
              </label>
              <label>Message
                <textarea value={emailMessage} onChange={(event) => {
                  setEmailMessage(event.target.value);
                  setEmailConfirmed(false);
                }} />
              </label>
              <div className="finish-email-attachment"><FileCheck2 size={16} /><span><strong>{projectName}-{release.revision || "review"}.pdf</strong><small>All plan sheets. Title block and scale appear on the cover sheet only.</small></span></div>
              <label className={`finish-email-confirm ${emailConfirmed ? "checked" : ""}`}>
                <input type="checkbox" checked={emailConfirmed} onChange={(event) => setEmailConfirmed(event.target.checked)} />
                <span>{emailConfirmed ? <Check size={15} /> : null}</span>
                <strong>I reviewed the recipient, message, and attachment.</strong>
              </label>
              <button className="primary finish-email-create" disabled={!emailConfirmed || !emailRecipient.trim() || !emailSubject.trim() || Boolean(outputBusy)} onClick={async () => {
                setOutputBusy("email");
                try {
                  await onCreateEmailDraft({ recipient: emailRecipient, subject: emailSubject, message: emailMessage });
                  setEmailConfirmed(false);
                } finally {
                  setOutputBusy(null);
                }
              }}><Send size={17} /> {outputBusy === "email" ? "Attaching plan..." : "Create attached email draft"}</button>
              <p>Nothing sends automatically. Open the downloaded attached draft in your email app, review it again, and press Send there.</p>
            </div>}
            <div className="finish-output-downloads">
              <button onClick={onDownloadMaterials}><Download size={15} /><span><strong>Purchase list</strong><small>Current material CSV</small></span></button>
              <button onClick={onDownloadRuns}><Download size={15} /><span><strong>Run schedule</strong><small>Current system CSV</small></span></button>
              <button onClick={onDownloadRelease}><Download size={15} /><span><strong>Release record</strong><small>Gates and revision CSV</small></span></button>
            </div>
            <div className="finish-guardrail"><ShieldCheck size={16} /><span>Opening the print dialog is not recorded as proof that a package was printed or shared.</span></div>
          </section>}
        </div>
      </div>

      <footer className="finish-job-footer">
        <div><i className={model.jobReady ? "ready" : ""} /><span><strong>{model.jobReady ? "Job package ready" : model.summary}</strong><small>{projectName} · {systemName}</small></span></div>
        <button disabled={issuing} onClick={onClose}>Close</button>
        {activeStep !== "print-share" && ((activeStep === "holds" && openHolds[0]) || activeStepModel.complete) && <button
          className="primary"
          disabled={issuing || activeStepModel.waiting}
          onClick={() => {
            if (activeStep === "holds" && openHolds[0]) onOpenGate(openHolds[0]);
            else moveToNextAvailableStep();
          }}
        >{activeStep === "holds" && openHolds[0] ? finishJobGateActionLabel(openHolds[0].id) : "Next step"} <ChevronRight size={16} /></button>}
      </footer>
    </section>
  </div>;
}
