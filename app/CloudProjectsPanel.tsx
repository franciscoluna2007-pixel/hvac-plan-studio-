"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  ChevronRight,
  Cloud,
  CloudCog,
  CloudUpload,
  Download,
  FileClock,
  FolderKanban,
  HardDrive,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  CloudActivity,
  CloudMember,
  CloudProject,
  CloudRevision,
  createCloudProject,
  currentCloudUser,
  inviteCloudMember,
  listCloudActivity,
  listCloudMembers,
  listCloudProjects,
  listCloudRevisions,
  removeCloudMember,
  recordDrivePackageSync,
  saveCloudRevision,
  signInCloud,
  signOutCloud,
  signUpCloud,
  updateCloudProject,
} from "./cloudProjects";
import { saveProjectPackageToDrive } from "./googleDrive";
import { normalizeWorkflowSummary } from "./workflowEngine";

type Snapshot = Record<string, unknown> & {
  fileName?: string;
  drawings?: unknown[];
  savedAt?: string;
  workflowSummary?: Record<string, unknown>;
};

type Props = {
  open: boolean;
  currentName: string;
  currentSourceFileName?: string;
  currentSourceDriveFileId?: string | null;
  buildSnapshot: () => Snapshot;
  onRestoreRevision: (snapshot: Snapshot, project: CloudProject, revision: CloudRevision) => void;
  onClose: () => void;
};

type CloudView = "dashboard" | "revisions" | "people" | "activity";

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function actionLabel(action: string) {
  if (action === "project_created") return "Project created";
  if (action === "revision_saved") return "Revision saved";
  if (action === "drive_package_synced") return "Drive package synced";
  return action.replaceAll("_", " ");
}

export default function CloudProjectsPanel({
  open,
  currentName,
  currentSourceFileName,
  currentSourceDriveFileId,
  buildSnapshot,
  onRestoreRevision,
  onClose,
}: Props) {
  const [userEmail, setUserEmail] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<CloudRevision[]>([]);
  const [members, setMembers] = useState<CloudMember[]>([]);
  const [activity, setActivity] = useState<CloudActivity[]>([]);
  const [view, setView] = useState<CloudView>("dashboard");
  const [revisionTitle, setRevisionTitle] = useState("");
  const [revisionSummary, setRevisionSummary] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [pendingRestore, setPendingRestore] = useState<CloudRevision | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [activeProjectId, projects],
  );
  const visibleProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) =>
      `${project.name} ${project.source_file_name || ""} ${project.status}`.toLowerCase().includes(query));
  }, [projectQuery, projects]);
  const workflow = normalizeWorkflowSummary(activeProject?.workflow_summary);
  const latestRevisionNumber = revisions[0]?.revision_number || 0;
  const syncedRevisionNumber = activeProject?.drive_synced_revision_number || 0;
  const drivePendingCount = Math.max(0, latestRevisionNumber - syncedRevisionNumber);
  const driveState = !activeProject?.drive_package_file_id
    ? "not-linked"
    : syncedRevisionNumber === 0
      ? "legacy"
      : drivePendingCount > 0
        ? "pending"
        : "current";
  const driveStateLabel = driveState === "current"
    ? `DRIVE CURRENT · R${syncedRevisionNumber}`
    : driveState === "pending"
      ? `${drivePendingCount} REVISION${drivePendingCount === 1 ? "" : "S"} PENDING`
      : driveState === "legacy"
        ? "LEGACY PACKAGE · RESYNC"
        : "DRIVE NOT LINKED";

  const refreshProjects = useCallback(async () => {
    const next = await listCloudProjects();
    setProjects(next);
    setActiveProjectId((current) => current && next.some((project) => project.id === current) ? current : next[0]?.id || null);
  }, []);

  const refreshProjectDetails = useCallback(async (projectId: string) => {
    const [nextRevisions, nextMembers, nextActivity] = await Promise.all([
      listCloudRevisions(projectId),
      listCloudMembers(projectId),
      listCloudActivity(projectId),
    ]);
    setRevisions(nextRevisions);
    setMembers(nextMembers);
    setActivity(nextActivity);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const user = await currentCloudUser();
        if (cancelled) return;
        setAuthenticated(Boolean(user));
        setUserEmail(user?.email || "");
        if (user) await refreshProjects();
      } catch (cloudError) {
        if (!cancelled) setError(cloudError instanceof Error ? cloudError.message : "Cloud Projects could not be opened.");
      }
    })();
    return () => { cancelled = true; };
  }, [open, refreshProjects]);

  useEffect(() => {
    if (!open || !activeProjectId || !authenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const [nextRevisions, nextMembers, nextActivity] = await Promise.all([
          listCloudRevisions(activeProjectId),
          listCloudMembers(activeProjectId),
          listCloudActivity(activeProjectId),
        ]);
        if (cancelled) return;
        setRevisions(nextRevisions);
        setMembers(nextMembers);
        setActivity(nextActivity);
      } catch (cloudError) {
        if (!cancelled) setError(cloudError instanceof Error ? cloudError.message : "Project details could not be loaded.");
      }
    })();
    return () => { cancelled = true; };
  }, [activeProjectId, authenticated, open]);

  async function runAction(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cloudError) {
      setError(cloudError instanceof Error ? cloudError.message : "The cloud action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    await runAction("auth", async () => {
      if (authMode === "signin") {
        const user = await signInCloud(email.trim(), password);
        setAuthenticated(Boolean(user));
        setUserEmail(user?.email || email.trim());
        await refreshProjects();
        setMessage("Cloud workspace connected.");
      } else {
        const result = await signUpCloud(email.trim(), password, displayName);
        if (result.session) {
          setAuthenticated(true);
          setUserEmail(result.user?.email || email.trim());
          await refreshProjects();
          setMessage("Cloud account created and connected.");
        } else {
          setAuthMode("signin");
          setMessage("Account created. Confirm the email from Supabase, then sign in.");
        }
      }
    });
  }

  async function createProject() {
    await runAction("create", async () => {
      const project = await createCloudProject({
        name: currentName || "Untitled HVAC Project",
        sourceFileName: currentSourceFileName || currentName,
        sourceDriveFileId: currentSourceDriveFileId,
      });
      setProjects((current) => [project, ...current]);
      setActiveProjectId(project.id);
      setView("dashboard");
      setRevisionTitle("Initial cloud revision");
      setMessage("Cloud project created. Save the first revision when ready.");
    });
  }

  async function saveRevision() {
    if (!activeProject) return;
    await runAction("revision", async () => {
      const snapshot = buildSnapshot();
      const revision = await saveCloudRevision({
        projectId: activeProject.id,
        snapshot,
        title: revisionTitle,
        summary: revisionSummary,
        drawingCount: Array.isArray(snapshot.drawings) ? snapshot.drawings.length : 0,
      });
      const updatedProject = await updateCloudProject(activeProject.id, {
        workflow_summary: snapshot.workflowSummary || {},
      });
      setRevisions((current) => [revision, ...current]);
      setProjects((current) => current.map((project) =>
        project.id === activeProject.id ? { ...updatedProject, updated_at: revision.created_at } : project,
      ));
      setRevisionTitle("");
      setRevisionSummary("");
      setMessage(`Revision ${revision.revision_number} saved to the cloud.`);
      setView("dashboard");
      await refreshProjectDetails(activeProject.id);
    });
  }

  async function exportToDrive() {
    if (!activeProject) return;
    await runAction("drive", async () => {
      const revision = revisions[0];
      if (!revision) throw new Error("Save a cloud revision before creating a verified Drive package.");
      const packageResult = await saveProjectPackageToDrive({
        projectId: activeProject.id,
        projectName: activeProject.name,
        exportedAt: new Date().toISOString(),
        latestRevision: revision.revision_number,
        snapshot: revision.snapshot,
      }, activeProject.drive_package_file_id);
      const updated = await recordDrivePackageSync({
        projectId: activeProject.id,
        fileId: packageResult.id,
        fileUrl: packageResult.webViewLink,
        revisionNumber: revision.revision_number,
      });
      setProjects((current) => current.map((project) => project.id === updated.id ? updated : project));
      await refreshProjectDetails(activeProject.id);
      setMessage(packageResult.updated
        ? `Drive package verified at revision ${revision.revision_number}.`
        : `Drive package created from revision ${revision.revision_number}.`);
    });
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!activeProject) return;
    await runAction("invite", async () => {
      const member = await inviteCloudMember(activeProject.id, inviteEmail, inviteRole);
      setMembers((current) => [...current, member]);
      setInviteEmail("");
      setMessage(`Invitation recorded for ${member.invited_email}.`);
    });
  }

  async function removeMember(member: CloudMember) {
    await runAction(`remove-${member.id}`, async () => {
      await removeCloudMember(member.id);
      setMembers((current) => current.filter((candidate) => candidate.id !== member.id));
      setMessage("Collaborator removed.");
    });
  }

  async function archiveProject() {
    if (!activeProject) return;
    await runAction("archive", async () => {
      await updateCloudProject(activeProject.id, { status: "archived" });
      const next = projects.filter((project) => project.id !== activeProject.id);
      setProjects(next);
      setActiveProjectId(next[0]?.id || null);
      setMessage("Project archived.");
    });
  }

  async function logout() {
    await runAction("logout", async () => {
      await signOutCloud();
      setAuthenticated(false);
      setUserEmail("");
      setProjects([]);
      setActiveProjectId(null);
      setRevisions([]);
      setMembers([]);
      setActivity([]);
      setMessage("Signed out of Cloud Projects.");
    });
  }

  function confirmRestore() {
    if (!activeProject || !pendingRestore) return;
    onRestoreRevision(pendingRestore.snapshot as Snapshot, activeProject, pendingRestore);
    setMessage(`Revision ${pendingRestore.revision_number} opened as the current working copy. The newer cloud revisions remain available.`);
    setPendingRestore(null);
  }

  if (!open) return null;

  return <div className="cloud-projects-overlay" role="dialog" aria-modal="true" aria-label="Cloud Projects">
    <button className="cloud-overlay-dismiss" aria-label="Close Cloud Projects" onClick={onClose} />
    <section className="cloud-projects-drawer">
      <header className="cloud-drawer-header">
        <div className="cloud-drawer-title">
          <span><CloudCog size={20} /></span>
          <div><strong>Cloud Projects</strong><small>Projects, revisions, Drive packages, and collaborators</small></div>
        </div>
        <button aria-label="Close Cloud Projects" onClick={onClose}><X size={18} /></button>
      </header>

      {!authenticated ? <div className="cloud-auth-shell">
        <div className="cloud-auth-hero">
          <span><Cloud size={24} /></span>
          <strong>Your HVAC workspace, available anywhere</strong>
          <p>Keep local autosave, then add secure cloud revisions and collaboration when you are ready.</p>
          <div>
            <b><ShieldCheck size={14} /> Row-level project security</b>
            <b><FileClock size={14} /> Immutable drawing revisions</b>
            <b><HardDrive size={14} /> Google Drive project packages</b>
          </div>
        </div>
        <form className="cloud-auth-form" onSubmit={submitAuth}>
          <div className="cloud-auth-tabs">
            <button type="button" className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>Sign in</button>
            <button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>Create account</button>
          </div>
          {authMode === "signup" && <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Francisco" /></label>}
          <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
          <label>Password<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
          <button className="cloud-primary" disabled={busy === "auth"}>{busy === "auth" ? <LoaderCircle className="spin" size={16} /> : <Cloud size={16} />}{authMode === "signin" ? "Connect cloud workspace" : "Create cloud account"}</button>
          <small>Cloud Projects uses Supabase authentication. Your existing site access remains unchanged.</small>
        </form>
        {(error || message) && <div className={`cloud-message ${error ? "error" : "success"}`}>{error || message}</div>}
      </div> : <>
        <div className="cloud-account-bar">
          <div><span className="cloud-presence-dot" /><span><strong>Cloud connected</strong><small>{userEmail}</small></span></div>
          <button onClick={() => void logout()} disabled={busy === "logout"}><LogOut size={14} /> Sign out</button>
        </div>

        <div className="cloud-workspace">
          <aside className="cloud-project-list">
            <div className="cloud-list-heading">
              <span>PROJECTS <b>{projects.length}</b></span>
              <button title="Refresh projects" onClick={() => void runAction("refresh", refreshProjects)}><RefreshCw className={busy === "refresh" ? "spin" : ""} size={14} /></button>
            </div>
            <button className="cloud-new-project" onClick={() => void createProject()} disabled={busy === "create"}>
              {busy === "create" ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
              Save current plan as project
            </button>
            <label className="cloud-project-search">
              <Search size={14} />
              <input
                aria-label="Search cloud projects"
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
                placeholder="Search projects or plans"
              />
            </label>
            <div className="cloud-project-cards">
              {visibleProjects.map((project) => {
                const projectWorkflow = normalizeWorkflowSummary(project.workflow_summary);
                return <button
                  key={project.id}
                  className={activeProjectId === project.id ? "active" : ""}
                  onClick={() => { setActiveProjectId(project.id); setView("dashboard"); setPendingRestore(null); }}
                >
                  <span><FolderKanban size={15} /></span>
                  <div>
                    <strong>{project.name}</strong>
                    <small>{project.source_file_name || "No source plan"} · {formatDate(project.updated_at)}</small>
                    <em className={project.drive_synced_revision_number ? "synced" : ""}>
                      {projectWorkflow ? `${projectWorkflow.progress}% · ${projectWorkflow.nextAction}` : project.drive_synced_revision_number ? `DRIVE R${project.drive_synced_revision_number}` : "CLOUD ONLY"}
                    </em>
                  </div>
                  <ChevronRight size={14} />
                </button>;
              })}
              {!projects.length && <div className="cloud-empty-projects"><CloudUpload size={22} /><strong>No cloud projects yet</strong><span>Open a plan and save it as your first project.</span></div>}
              {!!projects.length && !visibleProjects.length && <div className="cloud-empty-projects"><Search size={22} /><strong>No matching projects</strong><span>Try a project name, address, or source-plan filename.</span></div>}
            </div>
          </aside>

          <div className="cloud-project-detail">
            {activeProject ? <>
              <div className="cloud-project-heading">
                <div><span>ACTIVE CLOUD PROJECT</span><h2>{activeProject.name}</h2><small>{activeProject.source_file_name || "No source PDF linked"}</small></div>
                <div>
                  <button onClick={() => void exportToDrive()} disabled={busy === "drive" || !latestRevisionNumber}>{busy === "drive" ? <LoaderCircle className="spin" size={14} /> : <HardDrive size={14} />}{latestRevisionNumber ? `Sync Drive to R${latestRevisionNumber}` : "Save revision first"}</button>
                  <button title="Archive project" onClick={() => void archiveProject()} disabled={busy === "archive"}><Archive size={14} /></button>
                </div>
              </div>
              <div className="cloud-project-health">
                <span><b>●</b> SECURE PROJECT</span>
                <span>{revisions.length} REVISION{revisions.length === 1 ? "" : "S"}</span>
                <span>{members.length || 1} COLLABORATOR{(members.length || 1) === 1 ? "" : "S"}</span>
                <span className={driveState === "current" ? "synced" : driveState}>{driveStateLabel}</span>
              </div>
              <nav className="cloud-detail-tabs">
                <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><LayoutDashboard size={14} /> Dashboard</button>
                <button className={view === "revisions" ? "active" : ""} onClick={() => setView("revisions")}><History size={14} /> Revisions</button>
                <button className={view === "people" ? "active" : ""} onClick={() => setView("people")}><Users size={14} /> People</button>
                <button className={view === "activity" ? "active" : ""} onClick={() => setView("activity")}><FileClock size={14} /> Activity</button>
              </nav>

              {view === "dashboard" ? <div className="cloud-dashboard-view">
                <section className="cloud-dashboard-hero">
                  <img src="/hvac-plan-studio-v98-mark.svg" alt="" />
                  <div>
                    <span>SYSTEM COMPLETION MODE · V98</span>
                    <strong>{workflow?.nextAction || "Save a revision to start project tracking"}</strong>
                    <small>{workflow ? `${workflow.systems.length || 1} active system${workflow.systems.length === 1 ? "" : "s"} · last updated ${formatDate(workflow.updatedAt)}` : "The dashboard is generated from named cloud revisions, never an unsaved working copy."}</small>
                  </div>
                  <b>{workflow?.progress || 0}%</b>
                  <i><em style={{ width: `${workflow?.progress || 0}%` }} /></i>
                </section>

                <div className="cloud-dashboard-grid">
                  <article className="cloud-next-action-card">
                    <span><LayoutDashboard size={18} /></span>
                    <div><small>NEXT PROJECT ACTION</small><strong>{workflow?.nextAction || "Save the first named revision"}</strong><p>Open the newest revision as a working copy, continue the system in the plan workspace, then save another named checkpoint.</p></div>
                    <button onClick={() => setView("revisions")}>Open revisions <ChevronRight size={13} /></button>
                  </article>
                  <article className={`cloud-drive-sync-card ${driveState}`}>
                    <span><HardDrive size={18} /></span>
                    <div><small>VERIFIED GOOGLE DRIVE SYNC</small><strong>{driveStateLabel}</strong><p>{driveState === "current" ? `Revision ${syncedRevisionNumber} is the package stored in Drive.` : driveState === "pending" ? `Drive is behind the latest cloud checkpoint by ${drivePendingCount} revision${drivePendingCount === 1 ? "" : "s"}.` : driveState === "legacy" ? "The existing package predates revision verification. Resync it to establish a trusted baseline." : "Create a package from the latest immutable cloud revision."}</p></div>
                    <div className="cloud-drive-actions">
                      <button onClick={() => void exportToDrive()} disabled={busy === "drive" || !latestRevisionNumber}>
                        {busy === "drive" ? <LoaderCircle className="spin" size={13} /> : <HardDrive size={13} />}
                        {activeProject.drive_package_file_id ? "Sync latest revision" : "Create Drive package"}
                      </button>
                      {activeProject.drive_package_url && <a href={activeProject.drive_package_url} target="_blank" rel="noreferrer">Open in Drive <ExternalLink size={12} /></a>}
                    </div>
                    <time>Last verified {formatDate(activeProject.drive_synced_at)}</time>
                  </article>
                </div>

                {workflow?.systems.length ? <div className="cloud-system-progress">
                  <div><strong>System readiness</strong><span>Saved with revision {latestRevisionNumber || "—"}</span></div>
                  {workflow.systems.map((system) => <article key={system.id}>
                    <b>{system.name}</b>
                    <span><i><em style={{ width: `${system.progress}%` }} /></i><small>{system.stage} · {system.blockers} blocker{system.blockers === 1 ? "" : "s"}</small></span>
                    <strong>{system.progress}%</strong>
                  </article>)}
                </div> : <div className="cloud-empty-state"><LayoutDashboard size={22} /><strong>No completion snapshot yet</strong><span>Save a named cloud revision and the dashboard will show system progress, blockers, and the next safe action.</span></div>}
                <p className="cloud-collaboration-note"><ShieldCheck size={13} /> Cloud members and Google Drive sharing are separate. Grant collaborators access to the Drive package when they need the source PDF or exported project file.</p>
              </div> : view === "revisions" ? <div className="cloud-revisions-view">
                <div className="cloud-save-revision">
                  <div><span><CloudUpload size={17} /></span><div><strong>Save a cloud revision</strong><small>Local autosave continues between these named checkpoints.</small></div></div>
                  <div className="cloud-revision-fields">
                    <label>Revision title<input value={revisionTitle} onChange={(event) => setRevisionTitle(event.target.value)} placeholder={`Revision ${(revisions[0]?.revision_number || 0) + 1}`} /></label>
                    <label>What changed?<input value={revisionSummary} onChange={(event) => setRevisionSummary(event.target.value)} placeholder="Adjusted trunk size and added returns" /></label>
                    <button className="cloud-primary" onClick={() => void saveRevision()} disabled={busy === "revision"}>
                      {busy === "revision" ? <LoaderCircle className="spin" size={15} /> : <CloudUpload size={15} />} Save revision
                    </button>
                  </div>
                </div>
                <div className="cloud-revision-list">
                  {revisions.map((revision) => <article key={revision.id}>
                    <div className="cloud-revision-number">R{revision.revision_number}</div>
                    <div><strong>{revision.title}</strong><span>{revision.summary || "No revision note"}</span><small>{formatDate(revision.created_at)} · {revision.drawing_count} drawing objects</small></div>
                    <button onClick={() => setPendingRestore(revision)}><Download size={14} /> Review restore</button>
                  </article>)}
                  {!revisions.length && <div className="cloud-empty-state"><History size={22} /><strong>No revisions saved</strong><span>Save the current drawing as the first cloud checkpoint.</span></div>}
                </div>
              </div> : view === "people" ? <div className="cloud-people-view">
                <form className="cloud-invite-form" onSubmit={invite}>
                  <div><UserPlus size={17} /><span><strong>Invite a collaborator</strong><small>Editors can save revisions. Viewers can inspect project history.</small></span></div>
                  <input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" />
                  <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")}><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
                  <button className="cloud-primary" disabled={busy === "invite"}>{busy === "invite" ? <LoaderCircle className="spin" size={14} /> : <UserPlus size={14} />} Add</button>
                </form>
                <div className="cloud-member-list">
                  {members.map((member) => <article key={member.id}>
                    <span className={member.status === "active" ? "active" : "pending"}>{member.status === "active" ? <Check size={13} /> : <Users size={13} />}</span>
                    <div><strong>{member.invited_email || (member.role === "owner" ? "Project owner" : "Cloud member")}</strong><small>{member.role} · {member.status}</small></div>
                    {member.role !== "owner" && <button title="Remove collaborator" onClick={() => void removeMember(member)} disabled={busy === `remove-${member.id}`}><Trash2 size={14} /></button>}
                  </article>)}
                </div>
              </div> : <div className="cloud-activity-view">
                {activity.map((item) => <article key={item.id}>
                  <span><FileClock size={14} /></span>
                  <div><strong>{actionLabel(item.action)}</strong><small>{formatDate(item.created_at)}</small></div>
                </article>)}
                {!activity.length && <div className="cloud-empty-state"><FileClock size={22} /><strong>No activity yet</strong><span>Project and revision events will appear here.</span></div>}
              </div>}
            </> : <div className="cloud-no-selection"><FolderKanban size={34} /><strong>Select or create a cloud project</strong><span>The current plan stays safely autosaved on this browser until you choose a cloud project.</span></div>}
          </div>
        </div>
        {(error || message) && <div className={`cloud-message cloud-message-bar ${error ? "error" : "success"}`}>{error || message}</div>}
      </>}
      {pendingRestore && activeProject && <div className="cloud-restore-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cloud-restore-title">
        <div className="cloud-restore-card">
          <span><History size={22} /></span>
          <div>
            <small>SAFE RESTORE</small>
            <h3 id="cloud-restore-title">Open revision R{pendingRestore.revision_number}?</h3>
            <p><strong>{pendingRestore.title}</strong> will become your current working copy. The latest cloud revision is never overwritten and remains available in this history.</p>
          </div>
          <dl>
            <div><dt>Saved</dt><dd>{formatDate(pendingRestore.created_at)}</dd></div>
            <div><dt>Drawing objects</dt><dd>{pendingRestore.drawing_count}</dd></div>
          </dl>
          <div className="cloud-restore-actions">
            <button onClick={() => setPendingRestore(null)}>Cancel</button>
            <button className="cloud-primary" onClick={confirmRestore}><Download size={14} /> Open as working copy</button>
          </div>
        </div>
      </div>}
    </section>
  </div>;
}
