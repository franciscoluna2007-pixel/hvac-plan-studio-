"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  PackageCheck,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  fieldPackagePresets,
  fieldPackageSections,
  normalizePackageSections,
  sectionsForPreset,
  type FieldPackagePresetId,
  type FieldPackageSectionId,
} from "./fieldPackage";
import {
  selectedOutputIsReady,
  type OutputSectionReadiness,
} from "./finishJob";

type Props = {
  open: boolean;
  projectName: string;
  systemName: string;
  status: string;
  released: boolean;
  stale: boolean;
  scaleVerified: boolean;
  releaseRevision?: string;
  drawingSignature: string;
  runCount: number;
  critical: number;
  warnings: number;
  connectionProblems: number;
  gateCount: number;
  clearedGateCount: number;
  sectionReadiness: OutputSectionReadiness;
  pageLabel: string;
  onClose: () => void;
  onPrint: (sections: FieldPackageSectionId[]) => void;
  onDownloadManifest: () => void;
  onDownloadRuns: () => void;
  onDownloadTakeoff: () => void;
};

export default function FieldPackageComposer({
  open,
  projectName,
  systemName,
  status,
  released,
  stale,
  scaleVerified,
  releaseRevision,
  drawingSignature,
  runCount,
  critical,
  warnings,
  connectionProblems,
  gateCount,
  clearedGateCount,
  sectionReadiness,
  pageLabel,
  onClose,
  onPrint,
  onDownloadManifest,
  onDownloadRuns,
  onDownloadTakeoff,
}: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [preset, setPreset] = useState<FieldPackagePresetId | "custom">("installer");
  const [sections, setSections] = useState<FieldPackageSectionId[]>(sectionsForPreset("installer"));
  const selectedSections = useMemo(() => normalizePackageSections(sections), [sections]);
  const selectedSectionHolds = selectedSections.filter((section) => !sectionReadiness[section].ready);
  const releaseRecordMissing = !selectedSections.includes("release");
  const outputReady = released &&
    !stale &&
    selectedOutputIsReady(selectedSections, sectionReadiness);
  const packageState = outputReady ? "released" : stale ? "stale" : "draft";
  const outputStatus = outputReady
    ? status
    : releaseRecordMissing
      ? "DRAFT · RELEASE RECORD REQUIRED"
      : selectedSectionHolds.length
      ? "DRAFT · SECTION REVIEW REQUIRED"
      : status;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = requestAnimationFrame(() => {
      setPreset("installer");
      setSections(sectionsForPreset("installer"));
      dialogRef.current?.querySelector<HTMLElement>("button, input")?.focus();
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  function choosePreset(next: FieldPackagePresetId) {
    setPreset(next);
    setSections(sectionsForPreset(next));
  }

  function toggleSection(id: FieldPackageSectionId) {
    setPreset("custom");
    setSections((current) => current.includes(id)
      ? current.filter((section) => section !== id)
      : [...current, id]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

  return <div className="field-package-overlay" role="presentation">
    <button className="field-package-dismiss" aria-label="Close Print and Share" tabIndex={-1} aria-hidden="true" onClick={onClose} />
    <section
      ref={dialogRef}
      className="field-package-composer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="field-package-title"
      onKeyDown={handleKeyDown}
    >
      <header>
        <div className="field-package-title">
          <span><PackageCheck size={20} /></span>
          <div><small>PRINT &amp; SHARE</small><h2 id="field-package-title">Choose what the field needs</h2><p>{projectName} · {systemName}</p></div>
        </div>
        <button aria-label="Close Print and Share" onClick={onClose}><X size={18} /></button>
      </header>

      <div className={`field-package-status ${packageState}`}>
        <div>
          {outputReady ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span><small>CURRENT PACKAGE STATE</small><strong>{outputStatus}</strong></span>
        </div>
        <div className="field-package-status-tags">
          <span className={scaleVerified ? "clear" : "hold"}>{scaleVerified ? <Check size={12} /> : <AlertTriangle size={12} />}{scaleVerified ? "Scale verified" : "Scale unverified"}</span>
          <span className={outputReady ? "clear" : "hold"}>{outputReady ? `Revision ${releaseRevision || "reviewed"}` : "DRAFT · REVIEW REQUIRED"}</span>
        </div>
      </div>

      <div className="field-package-body">
        <section className="package-preset-column">
          <div className="package-section-heading"><strong>1. Field package</strong><span>Recommended starting point</span></div>
          <div className="package-preset-list" role="radiogroup" aria-label="Takeoff package presets">
            {fieldPackagePresets.filter((item) => item.id === "installer").map((item) => <button
              role="radio"
              aria-checked={preset === item.id}
              className={preset === item.id ? "active" : ""}
              key={item.id}
              onClick={() => choosePreset(item.id)}
            >
              <span>{preset === item.id ? <Check size={15} /> : <FileText size={15} />}</span>
              <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            </button>)}
          </div>

          <details className="package-more-presets">
            <summary>Other package presets</summary>
            <div className="package-preset-list" role="radiogroup" aria-label="Other package presets">
              {fieldPackagePresets.filter((item) => item.id !== "installer").map((item) => <button
                role="radio"
                aria-checked={preset === item.id}
                className={preset === item.id ? "active" : ""}
                key={item.id}
                onClick={() => choosePreset(item.id)}
              >
                <span>{preset === item.id ? <Check size={15} /> : <FileText size={15} />}</span>
                <div><strong>{item.label}</strong><small>{item.detail}</small></div>
              </button>)}
            </div>
          </details>

          <details className="package-downloads">
            <summary>Supporting CSV files</summary>
            <button onClick={onDownloadManifest}><Download size={14} /> Analysis manifest</button>
            <button disabled={!runCount} onClick={onDownloadRuns}><Download size={14} /> Duct run schedule</button>
            <button onClick={onDownloadTakeoff}><Download size={14} /> Purchase sheet</button>
          </details>
        </section>

        <section className="package-section-column">
          <div className="package-section-heading"><strong>2. Choose included sections</strong><span>{selectedSections.length} of {fieldPackageSections.length} sections</span></div>
          <p className="package-current-sheet-note">Plan output includes only {pageLabel.toLowerCase()}. Switch PDF sheets and print again when another sheet is needed.</p>
          <div className="package-section-list">
            {fieldPackageSections.map((section) => <label className={selectedSections.includes(section.id) ? "selected" : ""} key={section.id}>
              <input
                type="checkbox"
                checked={selectedSections.includes(section.id)}
                onChange={() => toggleSection(section.id)}
              />
              <span>{selectedSections.includes(section.id) && <Check size={13} />}</span>
              <div><strong>{section.label}</strong><small>{section.detail}</small></div>
            </label>)}
          </div>
        </section>

        <aside className="package-preview-column">
          <div className="package-section-heading"><strong>3. Release preview</strong><span>Controlled output</span></div>
          <div className={`package-preview-sheet ${packageState}`}>
            {!outputReady ? <div className="package-preview-watermark">DRAFT<br />REVIEW REQUIRED</div> : null}
            <div className="package-preview-logo"><FileCheck2 size={18} /><span>HVAC PLAN STUDIO</span></div>
            <small>PLAN INTELLIGENCE &amp; TAKEOFF PACKAGE</small>
            <h3>{projectName}</h3>
            <p>{systemName}</p>
            <dl>
              <div><dt>Status</dt><dd>{outputStatus}</dd></div>
              <div><dt>Revision</dt><dd>{releaseRevision || "DRAFT"}</dd></div>
              <div><dt>Plan scope</dt><dd>{pageLabel}</dd></div>
              <div><dt>Drawing signature</dt><dd>{drawingSignature.toUpperCase()}</dd></div>
              <div><dt>Included sections</dt><dd>{selectedSections.length}</dd></div>
            </dl>
          </div>
          <div className="package-readiness-grid">
            <span className={critical ? "hold" : "clear"}><b>{critical}</b> Critical</span>
            <span className={warnings ? "hold" : "clear"}><b>{warnings}</b> Warnings</span>
            <span className={connectionProblems ? "hold" : "clear"}><b>{connectionProblems}</b> Connections</span>
            <span className={clearedGateCount === gateCount ? "clear" : "hold"}><b>{clearedGateCount}/{gateCount}</b> Gates</span>
          </div>
          {(releaseRecordMissing || selectedSectionHolds.length > 0) && <div className="package-section-holds" role="status">
            <strong>{releaseRecordMissing ? "Release record required for final output" : `${selectedSectionHolds.length} selected section${selectedSectionHolds.length === 1 ? "" : "s"} require review`}</strong>
            {releaseRecordMissing && <span>Include “Analysis summary &amp; run schedule” so every final package carries its revision, reviewer, time, and fingerprints.</span>}
            {selectedSectionHolds.map((section) => <span key={section}>
              {fieldPackageSections.find((item) => item.id === section)?.label}: {sectionReadiness[section].detail}
            </span>)}
          </div>}
          <div className="package-safety-note"><ShieldCheck size={15} /><span>Any selected section that is not current forces the “Review Required” watermark. Geometry is never modified during export.</span></div>
        </aside>
      </div>

      <footer>
        <div><i /><span><strong>{outputReady ? "Source-backed revision ready" : "Draft review package"}</strong><small>{outputReady ? "The reviewed revision and selected section evidence will be printed." : "Confirm every selected section before relying on the package."}</small></span></div>
        <button onClick={onClose}>Cancel</button>
        <button className="primary" disabled={!selectedSections.length} onClick={() => onPrint(selectedSections)}><Printer size={15} /> Print selected package</button>
      </footer>
    </section>
  </div>;
}
