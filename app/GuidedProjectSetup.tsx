"use client";

import { KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  HardDrive,
  Ruler,
  ShieldCheck,
  Users,
  Wind,
  X,
} from "lucide-react";

export type ProjectSetupValues = {
  source: "drive" | "local";
  projectName: string;
  scale: '1/8" = 1\'-0"' | '3/16" = 1\'-0"' | '1/4" = 1\'-0"' | '1/2" = 1\'-0"';
  defaultDuctSize: string;
  tonnage: string;
  collaboration: "local" | "cloud";
};

type Props = {
  open: boolean;
  driveConfigured: boolean | null;
  onCancel: () => void;
  onStart: (values: ProjectSetupValues) => void;
};

const steps = [
  { id: "source", label: "Source plan" },
  { id: "drawing", label: "Drawing setup" },
  { id: "system", label: "HVAC system" },
  { id: "collaboration", label: "Collaboration" },
] as const;

export default function GuidedProjectSetup({
  open,
  driveConfigured,
  onCancel,
  onStart,
}: Props) {
  const overlayRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ProjectSetupValues>({
    source: driveConfigured === false ? "local" : "drive",
    projectName: "",
    scale: '1/4" = 1\'-0"',
    defaultDuctSize: "14",
    tonnage: "3",
    collaboration: "local",
  });
  const effectiveSource = driveConfigured === false ? "local" : values.source;

  const summary = useMemo(() => ({
    source: effectiveSource === "drive" ? "Google Drive PDF" : "Local PDF",
    system: `${values.tonnage} ton · ${Number(values.tonnage) * 400} CFM reference`,
    drawing: `${values.scale} · ${values.defaultDuctSize}" default run`,
    collaboration: values.collaboration === "cloud" ? "Cloud project after source opens" : "Local-first",
  }), [effectiveSource, values]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      overlayRef.current?.querySelector<HTMLElement>(".project-setup-main > header button")?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  function update<K extends keyof ProjectSetupValues>(key: K, value: ProjectSetupValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab" || !overlayRef.current) return;
    const focusable = Array.from(overlayRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hasAttribute("aria-hidden"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <section ref={overlayRef} className="project-setup-overlay" role="dialog" aria-modal="true" aria-labelledby="project-setup-title" onKeyDown={handleDialogKeyDown}>
      <button className="project-setup-dismiss" onClick={onCancel} aria-label="Cancel project setup" />
      <div className="project-setup-dialog">
        <aside className="project-setup-rail">
          <div className="setup-brand">
            <span><Wind size={22} /></span>
            <div><strong>New HVAC project</strong><small>Guided setup · about 60 seconds</small></div>
          </div>
          <ol>
            {steps.map((item, index) => <li key={item.id} className={index === step ? "active" : index < step ? "complete" : ""}>
              <span>{index < step ? <Check size={15} /> : index + 1}</span>
              <div><small>STEP {index + 1}</small><strong>{item.label}</strong></div>
            </li>)}
          </ol>
          <div className="setup-guardrail">
            <ShieldCheck size={17} />
            <div><strong>You keep geometry control.</strong><p>Setup never draws, reroutes, resizes, reconnects, balances, or numbers ductwork.</p></div>
          </div>
        </aside>

        <div className="project-setup-main">
          <header>
            <div>
              <span>PROJECT SETUP · {step + 1} OF {steps.length}</span>
              <h2 id="project-setup-title">{steps[step].label}</h2>
            </div>
            <button onClick={onCancel} aria-label="Close project setup"><X size={19} /></button>
          </header>

          <div className="project-setup-body">
            {step === 0 && <>
              <div className="setup-copy">
                <h3>Where is the source construction plan?</h3>
                <p>You can change sources later. Existing drawing work remains bound to the plan fingerprint and saved revisions.</p>
              </div>
              <div className="setup-choice-grid source">
                <button
                  className={effectiveSource === "drive" ? "selected" : ""}
                  disabled={driveConfigured === false}
                  onClick={() => update("source", "drive")}
                >
                  <span><HardDrive size={23} /></span>
                  <strong>Google Drive</strong>
                  <p>Choose a PDF from Drive and retain its source-file identity.</p>
                  <em>{driveConfigured === null ? "Checking configuration" : driveConfigured ? "Recommended · ready" : "Setup required"}</em>
                  <i>{effectiveSource === "drive" && <Check size={15} />}</i>
                </button>
                <button className={effectiveSource === "local" ? "selected" : ""} onClick={() => update("source", "local")}>
                  <span><FileText size={23} /></span>
                  <strong>Local PDF</strong>
                  <p>Open a plan from this device and work entirely local-first.</p>
                  <em>Always available</em>
                  <i>{effectiveSource === "local" && <Check size={15} />}</i>
                </button>
              </div>
              <label className="setup-field">
                <span>Project name <small>Optional · defaults to PDF name</small></span>
                <input value={values.projectName} onChange={(event) => update("projectName", event.target.value)} placeholder="Example: Mountain View Residence" />
              </label>
            </>}

            {step === 1 && <>
              <div className="setup-copy">
                <h3>Set the drafting baseline.</h3>
                <p>Scale begins as a reviewed preset and stays unverified until you confirm or calibrate it on the plan.</p>
              </div>
              <div className="setup-form-grid">
                <label>
                  <span><Ruler size={15} /> Drawing scale</span>
                  <select value={values.scale} onChange={(event) => update("scale", event.target.value as ProjectSetupValues["scale"])}>
                    <option value={'1/8" = 1\'-0"'}>{'1/8" = 1\'-0"'}</option>
                    <option value={'3/16" = 1\'-0"'}>{'3/16" = 1\'-0"'}</option>
                    <option value={'1/4" = 1\'-0"'}>{'1/4" = 1\'-0"'}</option>
                    <option value={'1/2" = 1\'-0"'}>{'1/2" = 1\'-0"'}</option>
                  </select>
                  <small>Confirm against a known dimension after the PDF opens.</small>
                </label>
                <label>
                  <span><Wind size={15} /> New run default</span>
                  <select value={values.defaultDuctSize} onChange={(event) => update("defaultDuctSize", event.target.value)}>
                    {Array.from({ length: 13 }, (_, index) => String(16 - index)).map((size) => <option key={size} value={size}>{size}&quot;</option>)}
                  </select>
                  <small>Every run remains independently editable.</small>
                </label>
              </div>
              <div className="setup-information-card">
                <Ruler size={18} />
                <div><strong>Calibration remains the authority.</strong><p>This preset improves speed, but field dimensions and a verified plan scale still control every measurement.</p></div>
              </div>
            </>}

            {step === 2 && <>
              <div className="setup-copy">
                <h3>Choose a starting system reference.</h3>
                <p>Tonnage establishes a coordination target at 400 CFM per ton. It does not calculate room loads or automatically size ductwork.</p>
              </div>
              <div className="setup-tonnage-grid">
                {["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"].map((tons) => <button
                  key={tons}
                  className={values.tonnage === tons ? "selected" : ""}
                  onClick={() => update("tonnage", tons)}
                >
                  <span>{tons}</span>
                  <strong>TON</strong>
                  <small>{Number(tons) * 400} CFM</small>
                  {values.tonnage === tons && <i><Check size={13} /></i>}
                </button>)}
              </div>
              <div className="setup-system-preview">
                <span><Wind size={20} /></span>
                <div><small>STARTING SYSTEM</small><strong>System 1 · {values.tonnage} ton · {Number(values.tonnage) * 400} CFM</strong><p>Place the actual equipment symbol and review its data before balancing.</p></div>
              </div>
            </>}

            {step === 3 && <>
              <div className="setup-copy">
                <h3>Decide how this project should begin.</h3>
                <p>Cloud collaboration is optional. You can start locally and create a controlled cloud project at any time.</p>
              </div>
              <div className="setup-choice-grid collaboration">
                <button className={values.collaboration === "local" ? "selected" : ""} onClick={() => update("collaboration", "local")}>
                  <span><FileText size={23} /></span>
                  <strong>Start local-first</strong>
                  <p>Open the plan immediately with device autosave and no sign-in requirement.</p>
                  <em>Fastest start</em>
                  <i>{values.collaboration === "local" && <Check size={15} />}</i>
                </button>
                <button className={values.collaboration === "cloud" ? "selected" : ""} onClick={() => update("collaboration", "cloud")}>
                  <span><Users size={23} /></span>
                  <strong>Prepare collaboration</strong>
                  <p>Open Project Hub after the source plan loads to name a revision and invite the team.</p>
                  <em>Controlled revisions</em>
                  <i>{values.collaboration === "cloud" && <Check size={15} />}</i>
                </button>
              </div>
              <div className="setup-review">
                <div><small>SOURCE</small><strong>{summary.source}</strong></div>
                <div><small>DRAWING</small><strong>{summary.drawing}</strong></div>
                <div><small>SYSTEM</small><strong>{summary.system}</strong></div>
                <div><small>WORKSPACE</small><strong>{summary.collaboration}</strong></div>
              </div>
            </>}
          </div>

          <footer>
            <button disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft size={16} /> Back</button>
            <span>{steps.map((_, index) => <i key={index} className={index === step ? "active" : index < step ? "complete" : ""} />)}</span>
            {step < steps.length - 1
              ? <button className="setup-next" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>Continue <ArrowRight size={16} /></button>
              : <button className="setup-next" onClick={() => onStart({ ...values, source: effectiveSource })}>{effectiveSource === "drive" ? <HardDrive size={16} /> : <FileText size={16} />} Choose source and enter Studio</button>}
          </footer>
        </div>
      </div>
    </section>
  );
}
