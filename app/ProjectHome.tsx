"use client";

import { DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Cloud,
  DraftingCompass,
  FileText,
  FolderKanban,
  HardDrive,
  LoaderCircle,
  Plus,
  ScanSearch,
  X,
} from "lucide-react";
import {
  currentCloudUser,
  listProjectHomeCards,
  type ProjectHomeCard,
} from "./cloudProjects";
import { trackProductEvent } from "./productAnalytics";
import type { PdfStartMode } from "./pdfStartPreference";

type Props = {
  open: boolean;
  hasPlan: boolean;
  currentProjectName: string;
  currentRevisionLabel: string;
  driveConfigured: boolean | null;
  busy: boolean;
  notice: string;
  pdfStartMode: PdfStartMode;
  onClose: () => void;
  onOpenPdfDirect: () => void;
  onOpenPdfGuided: () => void;
  onOpenDrive: () => void;
  onDropPdf: (file: File) => void;
  onPdfStartModeChange: (mode: PdfStartMode) => void;
  onOpenProjectHub: (projectId?: string) => void;
};

type CloudHomeState =
  | { status: "loading"; projects: ProjectHomeCard[]; message: string }
  | { status: "signed-out"; projects: ProjectHomeCard[]; message: string }
  | { status: "ready"; projects: ProjectHomeCard[]; message: string }
  | { status: "unavailable"; projects: ProjectHomeCard[]; message: string };

function formatProjectDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function ProjectHome({
  open,
  hasPlan,
  currentProjectName,
  currentRevisionLabel,
  driveConfigured,
  busy,
  notice,
  onClose,
  onOpenPdfDirect,
  onOpenPdfGuided,
  onOpenDrive,
  onDropPdf,
  onOpenProjectHub,
}: Props) {
  const overlayRef = useRef<HTMLElement>(null);
  const firstPlanSourceRef = useRef<HTMLButtonElement>(null);
  const [showPlanSources, setShowPlanSources] = useState(false);
  const [cloud, setCloud] = useState<CloudHomeState>({
    status: "loading",
    projects: [],
    message: "Checking your saved jobs…",
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void currentCloudUser()
      .then(async (user) => {
        if (cancelled) return;
        if (!user) {
          setCloud({
            status: "signed-out",
            projects: [],
            message: "Sign in through Saved jobs when you want to keep work online.",
          });
          return;
        }
        const projects = await listProjectHomeCards();
        if (!cancelled) {
          setCloud({
            status: "ready",
            projects,
            message: projects.length
              ? `${projects.length} saved job${projects.length === 1 ? "" : "s"} available`
              : "Your saved-jobs workspace is ready.",
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCloud({
            status: "unavailable",
            projects: [],
            message: "Saved jobs are temporarily unavailable. You can still work from a PDF on this device.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void trackProductEvent("workspace_opened", {}, { oncePerSession: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      overlayRef.current?.querySelector<HTMLElement>("[data-home-primary]")?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && showPlanSources) firstPlanSourceRef.current?.focus();
  }, [open, showPlanSources]);

  if (!open) return null;

  const recentProjects = cloud.projects.slice(0, 3);

  function closeHome() {
    setShowPlanSources(false);
    onClose();
  }

  function openPdfDirect() {
    setShowPlanSources(false);
    onOpenPdfDirect();
  }

  function openPdfGuided() {
    setShowPlanSources(false);
    onOpenPdfGuided();
  }

  function openDrive() {
    setShowPlanSources(false);
    onOpenDrive();
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && hasPlan) {
      event.preventDefault();
      closeHome();
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

  function handlePdfDrop(event: ReactDragEvent<HTMLElement>) {
    event.preventDefault();
    if (busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setShowPlanSources(false);
      onDropPdf(file);
    }
  }

  return (
    <section
      ref={overlayRef}
      className="project-home-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="HVAC Plan Studio jobs"
      onKeyDown={handleDialogKeyDown}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handlePdfDrop}
    >
      <header className="project-home-header">
        <button
          type="button"
          className="project-home-brand"
          onClick={hasPlan ? closeHome : undefined}
          disabled={!hasPlan}
          aria-label={hasPlan ? "Return to the open plan" : "HVAC Plan Studio home"}
        >
          <span><DraftingCompass size={22} strokeWidth={2.4} /></span>
          <div>
            <strong>HVAC Plan Studio</strong>
            <small>Draw &amp; Detail</small>
          </div>
        </button>

        <nav className="project-home-nav" aria-label="Current area">
          <button type="button" className="active"><FolderKanban size={15} /> Jobs</button>
        </nav>

        <div className="project-home-header-actions">
          {hasPlan && (
            <button type="button" className="home-close" onClick={closeHome} aria-label="Close jobs home">
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      <div className="project-home-scroll">
        <main className="project-home-content">
          <section className="project-home-hero">
            <div className="project-home-hero-copy">
              <h1>{hasPlan ? "Your plan is ready." : "Open the plan. Run the job."}</h1>
              <p>
                {hasPlan
                  ? "Return to the source plan with your tools, review state, and field controls exactly where you left them."
                  : "Bring in the source PDF, draw directly over it, and move from routing through field release in one controlled workspace."}
              </p>

              <div className="project-home-primary-actions" aria-label="Job actions">
                {hasPlan ? (
                  <button
                    type="button"
                    data-home-primary
                    className="home-primary"
                    onClick={closeHome}
                    disabled={busy}
                  >
                    <ArrowRight size={17} /> Continue current job
                  </button>
                ) : (
                  <button
                    type="button"
                    data-home-primary
                    className="home-primary"
                    onClick={() => setShowPlanSources((visible) => !visible)}
                    disabled={busy}
                    aria-expanded={showPlanSources}
                    aria-controls="project-home-plan-sources"
                  >
                    <FileText size={17} /> Open a plan
                  </button>
                )}
                {hasPlan && (
                  <button
                    type="button"
                    onClick={() => setShowPlanSources((visible) => !visible)}
                    disabled={busy}
                    aria-expanded={showPlanSources}
                    aria-controls="project-home-plan-sources"
                  >
                    <Plus size={17} /> Open another plan
                  </button>
                )}
              </div>

              {showPlanSources && (
                <section
                  id="project-home-plan-sources"
                  className="project-home-plan-sources"
                  aria-labelledby="project-home-plan-sources-title"
                >
                  <div className="project-home-plan-sources-heading">
                    <div>
                      <span>OPEN A PLAN</span>
                      <h2 id="project-home-plan-sources-title">Where is the PDF?</h2>
                    </div>
                    <button
                      type="button"
                      className="project-home-plan-sources-close"
                      onClick={() => setShowPlanSources(false)}
                      aria-label="Close plan choices"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="project-home-plan-source-buttons">
                    <button
                      ref={firstPlanSourceRef}
                      type="button"
                      className="recommended"
                      onClick={openPdfDirect}
                      disabled={busy}
                    >
                      <FileText size={20} />
                      <span>
                        <strong>This device</strong>
                        <small>Open PDF and start drawing</small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={openDrive}
                      disabled={busy || driveConfigured === false}
                      title={driveConfigured === false ? "Google Drive is not available for this workspace" : undefined}
                    >
                      <HardDrive size={20} />
                      <span>
                        <strong>{driveConfigured === false ? "Drive unavailable" : "Google Drive"}</strong>
                        <small>{driveConfigured === false ? "Not connected for this workspace" : "Choose a PDF from Drive"}</small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="project-home-guided-choice"
                    onClick={openPdfGuided}
                    disabled={busy}
                  >
                    <ScanSearch size={17} />
                    <span>
                      <strong>Help me set up this plan</strong>
                      <small>Optional help with scale and job details</small>
                    </span>
                  </button>

                  <div className="project-home-drop-zone">
                    <FileText size={15} />
                    <span>Drop a PDF here to open it directly</span>
                  </div>
                </section>
              )}

              {hasPlan && (
                <div className="project-home-trust-row" aria-label="Current job">
                  <span><DraftingCompass size={14} /> {currentProjectName}</span>
                  <span>{currentRevisionLabel}</span>
                </div>
              )}
            </div>

            <aside className="home-command-preview" aria-label="Field command workflow">
              <header>
                <div>
                  <small>JOB TRAVELER</small>
                  <strong>{hasPlan ? currentProjectName : "Ready for source plan"}</strong>
                </div>
                <span className={hasPlan ? "ready" : "standby"}>{hasPlan ? "LIVE" : "STANDBY"}</span>
              </header>
              <ol>
                <li className={hasPlan ? "complete" : "active"}>
                  <b>01</b><span><strong>Source plan</strong><small>{hasPlan ? "Loaded and authoritative" : "Open the construction PDF"}</small></span>
                </li>
                <li className={hasPlan ? "active" : ""}>
                  <b>02</b><span><strong>Draw &amp; detail</strong><small>Routes, symbols, and T Branches</small></span>
                </li>
                <li>
                  <b>03</b><span><strong>Review systems</strong><small>Airflow, sizing, layers, and Fix Plan</small></span>
                </li>
                <li>
                  <b>04</b><span><strong>Issue field work</strong><small>Materials, checks, and controlled output</small></span>
                </li>
              </ol>
              <footer>
                <span><i /> Plan-first workspace</span>
                <strong>Nothing changes without approval</strong>
              </footer>
            </aside>
          </section>

          {(busy || notice) && (
            <div className={`project-home-notice ${notice ? "error" : "busy"}`} role={notice ? "alert" : "status"}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <AlertTriangle size={16} />}
              <span>{notice || "Opening the source plan…"}</span>
            </div>
          )}

          <section className="project-home-grid">
            <div className="project-home-projects">
              <div className="home-section-heading">
                <div>
                  <span>RECENT JOBS</span>
                  <h2>Open a saved job.</h2>
                </div>
                <button type="button" onClick={() => onOpenProjectHub()}>
                  Open saved jobs <ArrowRight size={15} />
                </button>
              </div>

              {cloud.status === "loading" ? (
                <div className="home-project-skeletons" aria-label="Loading recent jobs">
                  {[0, 1, 2].map((item) => <div key={item}><i /><span /><b /></div>)}
                </div>
              ) : recentProjects.length ? (
                <div className="home-project-cards">
                  {recentProjects.map((project) => (
                    <button
                      type="button"
                      key={project.id}
                      onClick={() => onOpenProjectHub(project.id)}
                      aria-label={`Open ${project.name}`}
                      style={{ minHeight: 128 }}
                    >
                      <div className="home-project-card-top">
                        <span><FolderKanban size={17} /></span>
                        <em className="neutral">{formatProjectDate(project.updated_at)}</em>
                      </div>
                      <strong>{project.name}</strong>
                      <small>{project.source_file_name || "PDF not linked yet"}</small>
                      <div className="home-project-card-meta">
                        <span>R{project.latest_revision_number || "—"}</span>
                        <span>{project.open_work ? `${project.open_work} open item${project.open_work === 1 ? "" : "s"}` : "Ready to open"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="project-home-empty">
                  <span><Cloud size={23} /></span>
                  <div>
                    <strong>{cloud.status === "signed-out" ? "Your PDF work can stay on this device" : "No saved jobs yet"}</strong>
                    <p>{cloud.message}</p>
                  </div>
                  <button type="button" onClick={() => onOpenProjectHub()}>
                    {cloud.status === "signed-out" ? "Sign in to save jobs" : "Open saved jobs"} <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
