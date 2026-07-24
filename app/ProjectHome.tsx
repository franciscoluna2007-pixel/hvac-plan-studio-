"use client";

import { KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Command,
  FileCheck2,
  FileText,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Wind,
  Workflow,
  X,
} from "lucide-react";
import {
  currentCloudUser,
  listProjectHomeCards,
  type ProjectHomeCard,
} from "./cloudProjects";

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
  onOpenLocal: () => void;
  onOpenDrive: () => void;
  onOpenProjectHub: (projectId?: string) => void;
  onOpenCommand: () => void;
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
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function readiness(project: ProjectHomeCard) {
  const raw = project.workflow_summary?.progress;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(100, Math.round(raw)));
  }
  const deductions =
    project.critical_work * 22 +
    project.blocked_work * 12 +
    project.pending_approvals * 7 +
    project.changes_requested * 16;
  return Math.max(project.latest_revision_number ? 18 : 8, 100 - deductions);
}

function projectStatus(project: ProjectHomeCard) {
  if (project.critical_work) return { label: "Critical hold", tone: "danger" };
  if (project.changes_requested) return { label: "Changes requested", tone: "warning" };
  if (project.pending_approvals) return { label: "Awaiting review", tone: "review" };
  if (!project.latest_revision_number) return { label: "Baseline needed", tone: "neutral" };
  if (project.drive_synced_revision_number < project.latest_revision_number) {
    return { label: "Drive sync due", tone: "warning" };
  }
  return { label: "Current", tone: "success" };
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
  onOpenLocal,
  onOpenDrive,
  onOpenProjectHub,
  onOpenCommand,
}: Props) {
  const overlayRef = useRef<HTMLElement>(null);
  const [cloud, setCloud] = useState<CloudHomeState>({
    status: "loading",
    projects: [],
    message: "Checking your project workspace…",
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
            message: "Sign in through Project Hub to see shared projects and reviews.",
          });
          return;
        }
        const projects = await listProjectHomeCards();
        if (!cancelled) {
          setCloud({
            status: "ready",
            projects,
            message: projects.length
              ? `${projects.length} active project${projects.length === 1 ? "" : "s"} available`
              : "Your cloud workspace is ready for its first project.",
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCloud({
            status: "unavailable",
            projects: [],
            message: error instanceof Error
              ? "Cloud workspace is unavailable. Local drawing remains fully available."
              : "Local drawing remains fully available.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
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

  const projects = cloud.projects.slice(0, 4);
  const metrics = useMemo(() => cloud.projects.reduce(
    (total, project) => ({
      critical: total.critical + project.critical_work,
      blocked: total.blocked + project.blocked_work,
      reviews: total.reviews + project.pending_approvals + project.changes_requested,
      syncDue: total.syncDue + (
        project.latest_revision_number > project.drive_synced_revision_number ? 1 : 0
      ),
    }),
    { critical: 0, blocked: 0, reviews: 0, syncDue: 0 },
  ), [cloud.projects]);

  if (!open) return null;

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && hasPlan) {
      event.preventDefault();
      onClose();
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
    <section ref={overlayRef} className="project-home-overlay" role="dialog" aria-modal="true" aria-label="HVAC Plan Studio Project Home" onKeyDown={handleDialogKeyDown}>
      <header className="project-home-header">
        <button className="project-home-brand" onClick={hasPlan ? onClose : undefined} aria-label={hasPlan ? "Return to the open plan" : "HVAC Plan Studio home"}>
          <span><Wind size={22} strokeWidth={2.4} /></span>
          <div>
            <strong>HVAC Plan Studio</strong>
            <small>Project delivery operating system</small>
          </div>
        </button>
        <nav className="project-home-nav" aria-label="Primary workspace">
          <button className="active"><LayoutDashboard size={15} /> Home</button>
          <button onClick={() => onOpenProjectHub()}><FolderKanban size={15} /> Projects</button>
          <button disabled={!hasPlan} onClick={onClose}><FileText size={15} /> Studio</button>
          <button onClick={() => onOpenProjectHub()}><ShieldCheck size={15} /> Reviews</button>
        </nav>
        <div className="project-home-header-actions">
          <button className="home-command" onClick={onOpenCommand}>
            <Search size={15} />
            <span>Search or run a command</span>
            <kbd>⌘K</kbd>
          </button>
          <span className={`home-cloud-state ${cloud.status}`}>
            {cloud.status === "loading" ? <LoaderCircle className="spin" size={14} /> : <Cloud size={14} />}
            {cloud.status === "ready" ? "Cloud ready" : cloud.status === "signed-out" ? "Local mode" : cloud.status === "loading" ? "Connecting" : "Local mode"}
          </span>
          {hasPlan && <button className="home-close" onClick={onClose} aria-label="Close Project Home"><X size={18} /></button>}
        </div>
      </header>

      <div className="project-home-scroll">
        <div className="project-home-content">
          <section className="project-home-hero">
            <div className="project-home-hero-copy">
              <span className="home-eyebrow"><Sparkles size={13} /> PROJECT INTELLIGENCE · V101</span>
              <h1>From source plan to field release, in one controlled workspace.</h1>
              <p>
                Draw complete HVAC systems, coordinate revisions, review problems, and prepare field-ready packages without surrendering control of the geometry.
              </p>
              <div className="project-home-primary-actions">
                <button data-home-primary className="home-primary" onClick={onNewProject}><Plus size={17} /> Start a project</button>
                <button onClick={onOpenDrive} disabled={driveConfigured === false}><HardDrive size={17} /> Open from Drive</button>
                <button onClick={onOpenLocal}><FileText size={17} /> Open PDF</button>
              </div>
              <div className="project-home-trust-row">
                <span><CheckCircle2 size={14} /> Manual geometry stays manual</span>
                <span><ShieldCheck size={14} /> Revision-controlled releases</span>
                <span><Workflow size={14} /> Field-first workflow</span>
              </div>
            </div>

            <div className="project-home-hero-visual" aria-label="System delivery workflow">
              <div className="home-visual-heading">
                <div>
                  <span>DELIVERY CONTROL</span>
                  <strong>{hasPlan ? currentProjectName : "Ready for a source plan"}</strong>
                </div>
                <b>{hasPlan ? currentRevisionLabel : "NEW"}</b>
              </div>
              <svg viewBox="0 0 560 220" role="img" aria-label="HVAC supply, return, and field-release workflow">
                <defs>
                  <linearGradient id="home-flow-blue" x1="0" x2="1">
                    <stop offset="0" stopColor="#2f80ff" />
                    <stop offset="1" stopColor="#2ccce4" />
                  </linearGradient>
                </defs>
                <path className="home-flow-grid" d="M24 44H536M24 92H536M24 140H536M24 188H536M72 20V204M168 20V204M264 20V204M360 20V204M456 20V204" />
                <path className="home-flow-supply" d="M54 166H154L226 100H320L386 56H502" />
                <path className="home-flow-return" d="M54 184H180L250 142H360L430 112H502" />
                <path className="home-flow-branch" d="M226 100L286 58M320 100L382 146" />
                <g className="home-flow-unit" transform="translate(40 152)">
                  <rect width="42" height="47" rx="7" />
                  <path d="M7 13H35M7 24H35M7 35H35" />
                </g>
                <g className="home-flow-diffuser" transform="translate(494 42)">
                  <rect width="28" height="28" rx="4" />
                  <path d="M4 4L24 24M24 4L4 24M14 2V26M2 14H26" />
                </g>
                <circle className="home-flow-node" cx="226" cy="100" r="8" />
                <circle className="home-flow-node" cx="320" cy="100" r="8" />
                <circle className="home-flow-node" cx="386" cy="56" r="8" />
              </svg>
              <div className="home-visual-footer">
                <span><i className="supply" /> Supply routing</span>
                <span><i className="return" /> Return routing</span>
                <span><i className="fitting" /> Reviewed fittings</span>
                <strong><ShieldCheck size={14} /> Installer-ready only after approval</strong>
              </div>
            </div>
          </section>

          <section className="project-home-status-strip" aria-label="Workspace status">
            <article>
              <span className="status-icon cloud"><Cloud size={17} /></span>
              <div><small>CLOUD WORKSPACE</small><strong>{cloud.status === "ready" ? "Connected" : cloud.status === "loading" ? "Checking…" : "Local-first"}</strong></div>
              <em className={cloud.status === "ready" ? "success" : "neutral"}>{cloud.status === "ready" ? "LIVE" : "SAFE"}</em>
            </article>
            <article>
              <span className="status-icon drive"><HardDrive size={17} /></span>
              <div><small>GOOGLE DRIVE</small><strong>{driveConfigured === null ? "Checking…" : driveConfigured ? "Picker ready" : "Setup needed"}</strong></div>
              <em className={driveConfigured ? "success" : "warning"}>{driveConfigured ? "READY" : "REVIEW"}</em>
            </article>
            <article>
              <span className="status-icon review"><ShieldCheck size={17} /></span>
              <div><small>OPEN REVIEWS</small><strong>{cloud.status === "ready" ? `${metrics.reviews} decision${metrics.reviews === 1 ? "" : "s"}` : "Sign in to verify"}</strong></div>
              <em className={metrics.reviews ? "warning" : "success"}>{metrics.reviews ? "ACTION" : "CLEAR"}</em>
            </article>
            <article>
              <span className="status-icon field"><FileCheck2 size={17} /></span>
              <div><small>FIELD CONTROL</small><strong>Approval-gated</strong></div>
              <em className="success">ON</em>
            </article>
          </section>

          {(busy || notice) && <div className={`project-home-notice ${notice ? "error" : "busy"}`} role={notice ? "alert" : "status"}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <AlertTriangle size={16} />}
            <span>{notice || "Opening the source plan…"}</span>
          </div>}

          {hasPlan && <section className="project-home-continue">
            <div className="home-section-heading">
              <div>
                <span>CONTINUE WORKING</span>
                <h2>Your current plan is exactly where you left it.</h2>
              </div>
              <button onClick={onClose}>Enter Studio <ArrowRight size={16} /></button>
            </div>
            <article className="continue-project-card">
              <span className="continue-project-mark"><Wind size={24} /></span>
              <div>
                <small>OPEN WORKING COPY</small>
                <strong>{currentProjectName}</strong>
                <p>{currentRevisionLabel} · autosave active · canvas remains mounted</p>
              </div>
              <div className="continue-project-status">
                <b><i /> Ready</b>
                <span>Right-click pan and wheel zoom preserved</span>
              </div>
              <button onClick={onClose}><ArrowRight size={18} /></button>
            </article>
          </section>}

          <section className="project-home-grid">
            <div className="project-home-projects">
              <div className="home-section-heading">
                <div>
                  <span>RECENT PROJECTS</span>
                  <h2>Resume from a controlled revision.</h2>
                </div>
                <button onClick={() => onOpenProjectHub()}>View all projects <ArrowRight size={15} /></button>
              </div>

              {cloud.status === "loading" ? <div className="home-project-skeletons" aria-label="Loading recent projects">
                {[0, 1, 2].map((item) => <div key={item}><i /><span /><b /></div>)}
              </div> : projects.length ? <div className="home-project-cards">
                {projects.map((project) => {
                  const status = projectStatus(project);
                  const progress = readiness(project);
                  return <button key={project.id} onClick={() => onOpenProjectHub(project.id)}>
                    <div className="home-project-card-top">
                      <span><FolderKanban size={17} /></span>
                      <em className={status.tone}>{status.label}</em>
                    </div>
                    <strong>{project.name}</strong>
                    <small>{project.source_file_name || "Source plan not linked"}</small>
                    <div className="home-project-progress"><i style={{ width: `${progress}%` }} /></div>
                    <div className="home-project-card-meta">
                      <span>R{project.latest_revision_number || "—"}</span>
                      <span>{project.open_work} open</span>
                      <span>{formatProjectDate(project.updated_at)}</span>
                    </div>
                  </button>;
                })}
              </div> : <div className="project-home-empty">
                <span><Cloud size={23} /></span>
                <div>
                  <strong>{cloud.status === "signed-out" ? "Cloud projects are one sign-in away" : "Create your first controlled project"}</strong>
                  <p>{cloud.message}</p>
                </div>
                <button onClick={() => onOpenProjectHub()}>{cloud.status === "signed-out" ? "Sign in" : "Open Project Hub"} <ArrowRight size={15} /></button>
              </div>}
            </div>

            <aside className="project-home-coordination">
              <div className="home-section-heading">
                <div>
                  <span>TODAY&apos;S COORDINATION</span>
                  <h2>What needs attention.</h2>
                </div>
              </div>
              <div className="coordination-metrics">
                <button onClick={() => onOpenProjectHub()} className={metrics.critical ? "danger" : ""}>
                  <span><AlertTriangle size={17} /></span>
                  <div><strong>{metrics.critical}</strong><small>Critical holds</small></div>
                  <ArrowRight size={14} />
                </button>
                <button onClick={() => onOpenProjectHub()} className={metrics.blocked ? "warning" : ""}>
                  <span><Activity size={17} /></span>
                  <div><strong>{metrics.blocked}</strong><small>Blocked work</small></div>
                  <ArrowRight size={14} />
                </button>
                <button onClick={() => onOpenProjectHub()} className={metrics.reviews ? "review" : ""}>
                  <span><ShieldCheck size={17} /></span>
                  <div><strong>{metrics.reviews}</strong><small>Review decisions</small></div>
                  <ArrowRight size={14} />
                </button>
                <button onClick={() => onOpenProjectHub()} className={metrics.syncDue ? "warning" : ""}>
                  <span><HardDrive size={17} /></span>
                  <div><strong>{metrics.syncDue}</strong><small>Drive sync due</small></div>
                  <ArrowRight size={14} />
                </button>
              </div>
              <p className="coordination-note">
                <ShieldCheck size={15} />
                Review intelligence can flag work, but it never changes duct geometry or releases a plan without your decision.
              </p>
            </aside>
          </section>

          <section className="project-home-workflow">
            <div className="home-section-heading">
              <div>
                <span>ONE DELIVERY SYSTEM</span>
                <h2>Move work forward without losing field context.</h2>
              </div>
            </div>
            <div className="home-workflow-cards">
              <article>
                <span className="workflow-index">01</span>
                <div className="workflow-icon design"><Wind size={19} /></div>
                <strong>Design</strong>
                <p>Manual runs, smart connections, real duct lengths, CFM, velocity, and system balance.</p>
              </article>
              <article>
                <span className="workflow-index">02</span>
                <div className="workflow-icon review"><ShieldCheck size={19} /></div>
                <strong>Review</strong>
                <p>Explainable HVAC findings, RFIs, punch items, and revision-specific approvals.</p>
              </article>
              <article>
                <span className="workflow-index">03</span>
                <div className="workflow-icon field"><FileCheck2 size={19} /></div>
                <strong>Field</strong>
                <p>Installer schedules, controlled field releases, takeoffs, and closeout evidence.</p>
              </article>
              <article>
                <span className="workflow-index">04</span>
                <div className="workflow-icon files"><HardDrive size={19} /></div>
                <strong>Files</strong>
                <p>Source plans and revision-verified project packages connected through Google Drive.</p>
              </article>
            </div>
          </section>
        </div>

        <footer className="project-home-footer">
          <span><Wind size={14} /> HVAC Plan Studio v101</span>
          <p>Engineering before geometry · local-first by design · cloud control when your team needs it</p>
          <button onClick={onOpenCommand}><Command size={14} /> Command palette</button>
        </footer>
      </div>
    </section>
  );
}
