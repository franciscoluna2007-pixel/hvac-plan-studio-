"use client";

import { KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Cloud,
  FileText,
  FolderKanban,
  HardDrive,
  LoaderCircle,
  Plus,
  Wind,
  X,
} from "lucide-react";
import {
  currentCloudUser,
  listProjectHomeCards,
  type ProjectHomeCard,
} from "./cloudProjects";
import { trackProductEvent } from "./productAnalytics";

type Props = {
  open: boolean;
  hasPlan: boolean;
  currentProjectName: string;
  currentRevisionLabel: string;
  driveConfigured: boolean | null;
  busy: boolean;
  notice: string;
  onClose: () => void;
  onNewProject: () => void;
  onOpenDrive: () => void;
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
  onNewProject,
  onOpenDrive,
  onOpenProjectHub,
}: Props) {
  const overlayRef = useRef<HTMLElement>(null);
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

  if (!open) return null;

  const recentProjects = cloud.projects.slice(0, 3);

  function closeHome() {
    onClose();
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

  return (
    <section
      ref={overlayRef}
      className="project-home-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="HVAC Plan Studio jobs"
      onKeyDown={handleDialogKeyDown}
    >
      <header className="project-home-header">
        <button
          type="button"
          className="project-home-brand"
          onClick={hasPlan ? closeHome : undefined}
          disabled={!hasPlan}
          aria-label={hasPlan ? "Return to the open plan" : "HVAC Plan Studio home"}
        >
          <span><Wind size={22} strokeWidth={2.4} /></span>
          <div>
            <strong>HVAC Plan Studio</strong>
            <small>Jobs · plans · materials</small>
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
              <span className="home-eyebrow">YOUR JOBS</span>
              <h1>{hasPlan ? "Ready to keep working?" : "Start with the plan."}</h1>
              <p>
                {hasPlan
                  ? "Resume the plan already open, start another job from a PDF, or open a saved job."
                  : "Open a PDF and HVAC Plan Studio will help you set up, mark, check, and finish the job."}
              </p>

              <div className="project-home-primary-actions" aria-label="Job actions">
                {hasPlan && (
                  <button
                    type="button"
                    data-home-primary
                    className="home-primary"
                    onClick={closeHome}
                  >
                    <ArrowRight size={17} /> Resume current job
                  </button>
                )}
                <button
                  type="button"
                  data-home-primary={!hasPlan || undefined}
                  className={hasPlan ? undefined : "home-primary"}
                  onClick={onNewProject}
                >
                  {hasPlan ? <Plus size={17} /> : <FileText size={17} />} Start job from PDF
                </button>
                <button type="button" onClick={() => onOpenProjectHub()}>
                  <FolderKanban size={17} /> Open saved jobs
                </button>
                <button
                  type="button"
                  onClick={onOpenDrive}
                  disabled={driveConfigured === false}
                  title={driveConfigured === false ? "Google Drive is not available for this workspace" : undefined}
                >
                  <HardDrive size={17} /> {driveConfigured === false ? "Drive unavailable" : "Open from Drive"}
                </button>
              </div>

              {hasPlan && (
                <div className="project-home-trust-row" aria-label="Current job">
                  <span><Wind size={14} /> {currentProjectName}</span>
                  <span>{currentRevisionLabel}</span>
                </div>
              )}
            </div>
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
                  View all <ArrowRight size={15} />
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
