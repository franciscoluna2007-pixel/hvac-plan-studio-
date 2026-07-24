"use client";

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudCog,
  CloudUpload,
  Download,
  FileClock,
  FileStack,
  FolderKanban,
  HardDrive,
  History,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LogOut,
  ExternalLink,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  CloudActivity,
  CloudApproval,
  CloudMember,
  CloudProject,
  CloudProjectFile,
  CloudRevision,
  CloudWorkItem,
  createCloudApproval,
  createCloudComment,
  createCloudProject,
  createCloudWorkItem,
  currentCloudUser,
  decideCloudApproval,
  inviteCloudMember,
  listCloudActivity,
  listCloudApprovals,
  listCloudComments,
  listCloudMembers,
  listCloudProjectFiles,
  listCloudProjects,
  listCloudRevisions,
  listCloudWorkItems,
  removeCloudMember,
  recordDrivePackageSync,
  saveCloudRevision,
  setCloudProjectStatus,
  signInCloud,
  signOutCloud,
  signUpCloud,
  updateCloudWorkItem,
} from "./cloudProjects";
import { saveProjectPackageToDrive } from "./googleDrive";
import { buildProjectIntelligenceSummary, normalizeWorkflowSummary } from "./workflowEngine";

type Snapshot = Record<string, unknown> & {
  fileName?: string;
  drawings?: unknown[];
  savedAt?: string;
  workflowSummary?: Record<string, unknown>;
};

export type CloudProjectRisk = {
  projectId: string;
  verification: "verified" | "unverified";
  latestRevisionId: string | null;
  latestRevisionNumber: number;
  latestReleaseFingerprint: string | null;
  openCriticalWork: number;
  pendingApprovals: number;
  changesRequested: number;
  approvedApprovals: number;
};

type Props = {
  open: boolean;
  currentName: string;
  currentSourceFileName?: string;
  currentSourceDriveFileId?: string | null;
  workingProjectId: string | null;
  buildSnapshot: () => Snapshot;
  onRestoreRevision: (snapshot: Snapshot, project: CloudProject, revision: CloudRevision) => void;
  onWorkingProjectChange: (projectId: string | null) => void;
  onWorkingRevisionSaved: (revision: CloudRevision) => void;
  onProjectRiskChange: (risk: CloudProjectRisk | null) => void;
  onContinueWorkflow: () => void;
  onClose: () => void;
};

type CloudView = "command" | "work" | "revisions" | "reviews" | "files" | "people" | "activity";

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
  workingProjectId,
  buildSnapshot,
  onRestoreRevision,
  onWorkingProjectChange,
  onWorkingRevisionSaved,
  onProjectRiskChange,
  onContinueWorkflow,
  onClose,
}: Props) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);
  const detailsRequestRef = useRef(0);
  const mutationLockRef = useRef(false);
  const [userId, setUserId] = useState("");
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
  const [workItems, setWorkItems] = useState<CloudWorkItem[]>([]);
  const [approvals, setApprovals] = useState<CloudApproval[]>([]);
  const [projectFiles, setProjectFiles] = useState<CloudProjectFile[]>([]);
  const [detailsLoadedProjectId, setDetailsLoadedProjectId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Awaited<ReturnType<typeof listCloudComments>>>>({});
  const [view, setView] = useState<CloudView>("command");
  const [revisionTitle, setRevisionTitle] = useState("");
  const [revisionSummary, setRevisionSummary] = useState("");
  const [workTitle, setWorkTitle] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [workKind, setWorkKind] = useState<CloudWorkItem["kind"]>("task");
  const [workPriority, setWorkPriority] = useState<CloudWorkItem["priority"]>("medium");
  const [workCategory, setWorkCategory] = useState("coordination");
  const [workSystemId, setWorkSystemId] = useState("");
  const [workPageNumber, setWorkPageNumber] = useState("");
  const [expandedWorkItemId, setExpandedWorkItemId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [approvalReviewerId, setApprovalReviewerId] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
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
  const intelligence = buildProjectIntelligenceSummary({
    workflow,
    workItems,
    approvals,
    latestRevisionNumber,
    driveSyncedRevisionNumber: syncedRevisionNumber,
  });
  const openWorkItems = workItems.filter((item) => !["resolved", "closed"].includes(item.status));
  const pendingApprovals = approvals.filter((approval) => approval.status === "requested");
  const currentMembership = members.find((member) => member.user_id === userId && member.status === "active");
  const canEdit = currentMembership?.role === "owner" || currentMembership?.role === "editor";
  const isOwner = currentMembership?.role === "owner";
  const workingProjectMatchesActive = Boolean(activeProject && workingProjectId === activeProject.id);

  function clearProjectDetails() {
    detailsRequestRef.current += 1;
    setRevisions([]);
    setMembers([]);
    setActivity([]);
    setWorkItems([]);
    setApprovals([]);
    setProjectFiles([]);
    setDetailsLoadedProjectId(null);
    setComments({});
    setExpandedWorkItemId(null);
    setPendingRestore(null);
  }

  function selectProject(projectId: string) {
    if (busy) return;
    if (projectId === activeProjectId) return;
    clearProjectDetails();
    setActiveProjectId(projectId);
    setView("command");
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !drawerRef.current) return;
    const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hasAttribute("aria-hidden") && element.offsetParent !== null);
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

  const refreshProjects = useCallback(async () => {
    const next = await listCloudProjects();
    setProjects(next);
    setActiveProjectId((current) => current && next.some((project) => project.id === current) ? current : next[0]?.id || null);
  }, []);

  const refreshProjectDetails = useCallback(async (projectId: string) => {
    const requestId = ++detailsRequestRef.current;
    const [nextRevisions, nextMembers, nextActivity, nextWorkItems, nextApprovals, nextFiles] = await Promise.all([
      listCloudRevisions(projectId),
      listCloudMembers(projectId),
      listCloudActivity(projectId),
      listCloudWorkItems(projectId),
      listCloudApprovals(projectId),
      listCloudProjectFiles(projectId),
    ]);
    if (requestId !== detailsRequestRef.current || activeProjectIdRef.current !== projectId) return;
    setRevisions(nextRevisions);
    setMembers(nextMembers);
    setActivity(nextActivity);
    setWorkItems(nextWorkItems);
    setApprovals(nextApprovals);
    setProjectFiles(nextFiles);
    setDetailsLoadedProjectId(projectId);
  }, []);

  useEffect(() => {
    if (!activeProjectId || detailsLoadedProjectId !== activeProjectId || workingProjectId !== activeProjectId) return;
    onProjectRiskChange({
      projectId: activeProjectId,
      verification: "verified",
      latestRevisionId: revisions[0]?.id || null,
      latestRevisionNumber: revisions[0]?.revision_number || 0,
      latestReleaseFingerprint: revisions[0]?.release_fingerprint || null,
      openCriticalWork: workItems.filter((item) =>
        item.priority === "critical" && !["resolved", "closed"].includes(item.status)).length,
      pendingApprovals: approvals.filter((approval) =>
        approval.revision_id === revisions[0]?.id && approval.status === "requested").length,
      changesRequested: approvals.filter((approval) =>
        approval.revision_id === revisions[0]?.id && approval.status === "changes_requested").length,
      approvedApprovals: approvals.filter((approval) =>
        approval.revision_id === revisions[0]?.id && approval.status === "approved").length,
    });
  }, [activeProjectId, approvals, detailsLoadedProjectId, onProjectRiskChange, revisions, workItems, workingProjectId]);

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
    detailsRequestRef.current += 1;
  }, [activeProjectId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const user = await currentCloudUser();
        if (cancelled) return;
        setAuthenticated(Boolean(user));
        setUserId(user?.id || "");
        setUserEmail(user?.email || "");
        if (user) await refreshProjects();
      } catch (cloudError) {
        if (!cancelled) setError(cloudError instanceof Error ? cloudError.message : "Cloud Projects could not be opened.");
      }
    })();
    return () => { cancelled = true; };
  }, [open, refreshProjects]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !activeProjectId || !authenticated) return;
    void refreshProjectDetails(activeProjectId).catch((cloudError) => {
      if (activeProjectIdRef.current === activeProjectId) {
        setError(cloudError instanceof Error ? cloudError.message : "Project details could not be loaded.");
      }
    });
  }, [activeProjectId, authenticated, open, refreshProjectDetails]);

  async function runAction(label: string, action: () => Promise<void>) {
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cloudError) {
      setError(cloudError instanceof Error ? cloudError.message : "The cloud action could not be completed.");
    } finally {
      mutationLockRef.current = false;
      setBusy("");
    }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    await runAction("auth", async () => {
      if (authMode === "signin") {
        const user = await signInCloud(email.trim(), password);
        setAuthenticated(Boolean(user));
        setUserId(user?.id || "");
        setUserEmail(user?.email || email.trim());
        await refreshProjects();
        setMessage("Cloud workspace connected.");
      } else {
        const result = await signUpCloud(email.trim(), password, displayName);
        if (result.session) {
          setAuthenticated(true);
          setUserId(result.user?.id || "");
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
      clearProjectDetails();
      setActiveProjectId(project.id);
      onWorkingProjectChange(project.id);
      setView("command");
      setRevisionTitle("Initial cloud revision");
      setMessage("Cloud project created. Save the first revision when ready.");
    });
  }

  async function saveRevision() {
    if (!activeProject) return;
    if (!workingProjectMatchesActive) {
      setError("Open a revision from this project before saving. This protects another project's drawing from being saved here.");
      setView("revisions");
      return;
    }
    await runAction("revision", async () => {
      const snapshot = buildSnapshot();
      const revision = await saveCloudRevision({
        projectId: activeProject.id,
        snapshot,
        title: revisionTitle,
        summary: revisionSummary,
        drawingCount: Array.isArray(snapshot.drawings) ? snapshot.drawings.length : 0,
      });
      setRevisions((current) => [revision, ...current]);
      setProjects((current) => current.map((project) =>
        project.id === activeProject.id
          ? { ...project, workflow_summary: snapshot.workflowSummary || {}, updated_at: revision.created_at }
          : project,
      ));
      setRevisionTitle("");
      setRevisionSummary("");
      onWorkingRevisionSaved(revision);
      setMessage(`Revision ${revision.revision_number} saved to the cloud.`);
      setView("command");
      await refreshProjectDetails(activeProject.id);
    });
  }

  async function exportToDrive() {
    if (!activeProject) return;
    await runAction("drive", async () => {
      const revision = revisions[0];
      if (!revision || revision.project_id !== activeProject.id) {
        throw new Error("Wait for this project's latest revision before creating a verified Drive package.");
      }
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
      await setCloudProjectStatus(activeProject.id, "archived");
      const next = projects.filter((project) => project.id !== activeProject.id);
      setProjects(next);
      clearProjectDetails();
      setActiveProjectId(next[0]?.id || null);
      if (workingProjectId === activeProject.id) onWorkingProjectChange(null);
      setMessage("Project archived.");
    });
  }

  async function logout() {
    await runAction("logout", async () => {
      await signOutCloud();
      setAuthenticated(false);
      setUserId("");
      setUserEmail("");
      setProjects([]);
      setActiveProjectId(null);
      setRevisions([]);
      setMembers([]);
      setActivity([]);
      setWorkItems([]);
      setApprovals([]);
      setProjectFiles([]);
      setComments({});
      setDetailsLoadedProjectId(null);
      onWorkingProjectChange(null);
      onProjectRiskChange(null);
      setMessage("Signed out of Cloud Projects.");
    });
  }

  async function createWorkItem(event: FormEvent) {
    event.preventDefault();
    if (!activeProject) return;
    await runAction("create-work", async () => {
      const item = await createCloudWorkItem({
        projectId: activeProject.id,
        revisionId: revisions[0]?.id || null,
        kind: workKind,
        priority: workPriority,
        category: workCategory,
        title: workTitle,
        description: workDescription,
        systemId: workSystemId || null,
        pageNumber: Number(workPageNumber) || null,
      });
      setWorkItems((current) => [item, ...current]);
      setWorkTitle("");
      setWorkDescription("");
      setMessage(`${item.kind === "issue" ? "Issue" : "Task"} added to the project.`);
      await refreshProjectDetails(activeProject.id);
    });
  }

  async function setWorkItemStatus(item: CloudWorkItem, status: CloudWorkItem["status"]) {
    await runAction(`work-${item.id}`, async () => {
      const updated = await updateCloudWorkItem(item.id, { status });
      setWorkItems((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setMessage(`${item.title} moved to ${status.replaceAll("_", " ")}.`);
      if (activeProject) await refreshProjectDetails(activeProject.id);
    });
  }

  async function toggleWorkItem(item: CloudWorkItem) {
    const nextExpanded = expandedWorkItemId === item.id ? null : item.id;
    setExpandedWorkItemId(nextExpanded);
    setCommentDraft("");
    if (!nextExpanded || comments[item.id]) return;
    await runAction(`comments-${item.id}`, async () => {
      const nextComments = await listCloudComments(item.id);
      setComments((current) => ({ ...current, [item.id]: nextComments }));
    });
  }

  async function addComment(event: FormEvent, item: CloudWorkItem) {
    event.preventDefault();
    if (!activeProject) return;
    await runAction(`comment-${item.id}`, async () => {
      const comment = await createCloudComment(activeProject.id, item.id, commentDraft);
      setComments((current) => ({ ...current, [item.id]: [...(current[item.id] || []), comment] }));
      setCommentDraft("");
      setMessage("Coordination comment added.");
      await refreshProjectDetails(activeProject.id);
    });
  }

  async function requestApproval(event: FormEvent) {
    event.preventDefault();
    if (!activeProject || !revisions[0] || revisions[0].project_id !== activeProject.id) return;
    await runAction("approval", async () => {
      const reviewerId = approvalReviewerId;
      if (!reviewerId) throw new Error("Choose an active collaborator before requesting approval.");
      const approval = await createCloudApproval(activeProject.id, revisions[0].id, reviewerId);
      setApprovals((current) => [approval, ...current]);
      setApprovalReviewerId("");
      setMessage(`Revision ${revisions[0].revision_number} sent for review.`);
      await refreshProjectDetails(activeProject.id);
    });
  }

  async function decideApproval(approval: CloudApproval, status: "approved" | "changes_requested") {
    await runAction(`approval-${approval.id}`, async () => {
      const updated = await decideCloudApproval(approval.id, status, approvalNote);
      setApprovals((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setApprovalNote("");
      setMessage(status === "approved" ? "Revision approved." : "Changes requested. The drawing remains unchanged.");
      if (activeProject) await refreshProjectDetails(activeProject.id);
    });
  }

  function confirmRestore() {
    if (!activeProject || !pendingRestore) return;
    onRestoreRevision(pendingRestore.snapshot as Snapshot, activeProject, pendingRestore);
    setMessage(`Revision ${pendingRestore.revision_number} opened as the current working copy. The newer cloud revisions remain available.`);
    setPendingRestore(null);
  }

  if (!open) return null;

  return <div className="cloud-projects-overlay" role="dialog" aria-modal="true" aria-label="Project Intelligence Hub" onKeyDown={handleDialogKeyDown}>
    <button className="cloud-overlay-dismiss" aria-label="Close Project Intelligence Hub" tabIndex={-1} aria-hidden="true" onClick={onClose} />
    <section ref={drawerRef} className="cloud-projects-drawer">
      <header className="cloud-drawer-header">
        <div className="cloud-drawer-title">
          <span><CloudCog size={21} /></span>
          <div><strong>HVAC Plan Studio</strong><small>Project Intelligence Hub · v100</small></div>
        </div>
        <div className="cloud-drawer-header-status"><span>PROJECT DELIVERY OS</span><button ref={closeButtonRef} aria-label="Close Project Intelligence Hub" onClick={onClose}><X size={18} /></button></div>
      </header>

      {!authenticated ? <div className="cloud-auth-shell">
        <div className="cloud-auth-hero">
          <span><Target size={24} /></span>
          <small>HVAC PLAN STUDIO · PROJECT INTELLIGENCE</small>
          <strong>From working plan to field-ready package.</strong>
          <p>Coordinate issues, approve immutable revisions, and keep verified Google Drive evidence in one secure project workspace.</p>
          <div>
            <b><ShieldCheck size={15} /> Project-level access controls</b>
            <b><FileClock size={15} /> Immutable drawing checkpoints</b>
            <b><HardDrive size={15} /> Verified Drive packages</b>
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
          <small>Secure project access is powered by Supabase. Your browser autosave remains available whether or not you sign in.</small>
        </form>
        {(error || message) && <div className={`cloud-message ${error ? "error" : "success"}`}>{error || message}</div>}
      </div> : <>
        <div className="cloud-account-bar">
          <div><span className="cloud-presence-dot" /><span><strong>Cloud connected · {currentMembership?.role || "member"}</strong><small>{userEmail}</small></span></div>
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
                  disabled={Boolean(busy)}
                  onClick={() => selectProject(project.id)}
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
                <div><span>PROJECT INTELLIGENCE HUB</span><h2>{activeProject.name}</h2><small>{activeProject.source_file_name || "No source PDF linked"} · Updated {formatDate(activeProject.updated_at)}</small></div>
                <div>
                  {canEdit && <button onClick={() => void exportToDrive()} disabled={busy === "drive" || !latestRevisionNumber}>{busy === "drive" ? <LoaderCircle className="spin" size={14} /> : <HardDrive size={14} />}{latestRevisionNumber ? `Sync Drive to R${latestRevisionNumber}` : "Save revision first"}</button>}
                  {isOwner && <button title="Archive project" onClick={() => void archiveProject()} disabled={busy === "archive"}><Archive size={14} /></button>}
                </div>
              </div>
              <div className="cloud-project-health">
                <span><b>●</b> SECURE PROJECT</span>
                <span className={workingProjectMatchesActive ? "current" : "detached"}>
                  {workingProjectMatchesActive ? "CURRENT DRAWING" : "OPEN A REVISION TO EDIT"}
                </span>
                <span>{revisions.length} REVISION{revisions.length === 1 ? "" : "S"}</span>
                <span>{members.length || 1} COLLABORATOR{(members.length || 1) === 1 ? "" : "S"}</span>
                <span className={driveState === "current" ? "synced" : driveState}>{driveStateLabel}</span>
              </div>
              <nav className="cloud-detail-tabs">
                <button className={view === "command" ? "active" : ""} onClick={() => setView("command")}><LayoutDashboard size={14} /> Command Center</button>
                <button className={view === "work" ? "active" : ""} onClick={() => setView("work")}><ListChecks size={14} /> Work {openWorkItems.length > 0 && <b>{openWorkItems.length}</b>}</button>
                <button className={view === "revisions" ? "active" : ""} onClick={() => setView("revisions")}><History size={14} /> Revisions</button>
                <button className={view === "reviews" ? "active" : ""} onClick={() => setView("reviews")}><ShieldCheck size={14} /> Reviews {pendingApprovals.length > 0 && <b>{pendingApprovals.length}</b>}</button>
                <button className={view === "files" ? "active" : ""} onClick={() => setView("files")}><FileStack size={14} /> Files</button>
                <button className={view === "people" ? "active" : ""} onClick={() => setView("people")}><Users size={14} /> People</button>
                <button className={view === "activity" ? "active" : ""} onClick={() => setView("activity")}><Activity size={14} /> Activity</button>
              </nav>

              {view === "command" ? <div className="cloud-dashboard-view cloud-command-view">
                <section className={`cloud-dashboard-hero v100 ${intelligence.health}`}>
                  <span className="cloud-hub-mark" aria-hidden="true" />
                  <div>
                    <span>PROJECT INTELLIGENCE · V100</span>
                    <strong>{intelligence.headline}</strong>
                    <small>{intelligence.detail}</small>
                  </div>
                  <b>{intelligence.score}<small>/100</small></b>
                  <i><em style={{ width: `${intelligence.score}%` }} /></i>
                </section>

                <section className="cloud-executive-metrics" aria-label="Project delivery metrics">
                  <article><span>DESIGN PROGRESS</span><strong>{workflow?.progress || 0}%</strong><small>{workflow?.systems.length || 0} active system{workflow?.systems.length === 1 ? "" : "s"}</small></article>
                  <article><span>OPEN WORK</span><strong>{intelligence.counts.open}</strong><small>{intelligence.counts.critical} critical · {intelligence.counts.blocked} blocked</small></article>
                  <article><span>PENDING REVIEWS</span><strong>{intelligence.counts.pendingApprovals}</strong><small>{approvals.filter((approval) => approval.status === "approved").length} approved</small></article>
                  <article><span>VERIFIED PACKAGE</span><strong>{syncedRevisionNumber ? `R${syncedRevisionNumber}` : "—"}</strong><small>{driveStateLabel}</small></article>
                </section>

                <div className="cloud-dashboard-grid">
                  <article className="cloud-next-action-card">
                    <span>{intelligence.health === "critical" ? <AlertTriangle size={19} /> : <Target size={19} />}</span>
                    <div><small>NEXT SAFE ACTION</small><strong>{intelligence.headline}</strong><p>{intelligence.detail} Every recommendation is review-only; drawing geometry changes only when you edit it.</p></div>
                    <button onClick={() =>
                      !workingProjectMatchesActive
                        ? setView("revisions")
                        : intelligence.action === "command"
                          ? onContinueWorkflow()
                          : setView(intelligence.action)
                    }>
                      {workingProjectMatchesActive ? "Continue" : "Open project revision"} <ChevronRight size={14} />
                    </button>
                  </article>
                  <article className={`cloud-drive-sync-card ${driveState}`}>
                    <span><HardDrive size={18} /></span>
                    <div><small>VERIFIED GOOGLE DRIVE SYNC</small><strong>{driveStateLabel}</strong><p>{driveState === "current" ? `Revision ${syncedRevisionNumber} is the package stored in Drive.` : driveState === "pending" ? `Drive is behind the latest cloud checkpoint by ${drivePendingCount} revision${drivePendingCount === 1 ? "" : "s"}.` : driveState === "legacy" ? "The existing package predates revision verification. Resync it to establish a trusted baseline." : "Create a package from the latest immutable cloud revision."}</p></div>
                    <div className="cloud-drive-actions">
                      {canEdit && <button onClick={() => void exportToDrive()} disabled={busy === "drive" || !latestRevisionNumber}>
                        {busy === "drive" ? <LoaderCircle className="spin" size={13} /> : <HardDrive size={13} />}
                        {activeProject.drive_package_file_id ? "Sync latest revision" : "Create Drive package"}
                      </button>}
                      {activeProject.drive_package_url && <a href={activeProject.drive_package_url} target="_blank" rel="noreferrer">Open in Drive <ExternalLink size={12} /></a>}
                    </div>
                    <time>Last verified {formatDate(activeProject.drive_synced_at)}</time>
                  </article>
                </div>

                {workflow?.systems.length ? <div className="cloud-system-progress">
                  <div><strong>System delivery readiness</strong><span>Evidence from revision {latestRevisionNumber || "—"}</span></div>
                  {workflow.systems.map((system) => <article key={system.id}>
                    <b>{system.name}</b>
                    <span><i><em style={{ width: `${system.progress}%` }} /></i><small>{system.stage} · {system.blockers} blocker{system.blockers === 1 ? "" : "s"}</small></span>
                    <strong>{system.progress}%</strong>
                  </article>)}
                </div> : <div className="cloud-empty-state"><LayoutDashboard size={22} /><strong>Project intelligence is ready to activate</strong><span>Save a named cloud revision to establish the first trusted delivery checkpoint.</span></div>}
                <section className="cloud-recent-coordination">
                  <div><strong>Recent coordination</strong><button onClick={() => setView("work")}>Open all work <ChevronRight size={13} /></button></div>
                  {workItems.slice(0, 4).map((item) => <article key={item.id}>
                    <span className={`priority ${item.priority}`}>{item.priority}</span>
                    <div><strong>{item.title}</strong><small>{item.category} · {item.status.replaceAll("_", " ")}{item.page_number ? ` · page ${item.page_number}` : ""}</small></div>
                    <button onClick={() => { setView("work"); void toggleWorkItem(item); }}><ChevronRight size={14} /></button>
                  </article>)}
                  {!workItems.length && <div className="cloud-empty-compact"><CheckCircle2 size={17} /> No coordination work has been logged.</div>}
                </section>
                <p className="cloud-collaboration-note"><ShieldCheck size={14} /> Project access and Google Drive sharing are separate controls. Share Drive evidence only with the people who need it.</p>
              </div> : view === "work" ? <div className="cloud-work-view">
                {canEdit ? <form className="cloud-work-create" onSubmit={createWorkItem}>
                  <div className="cloud-section-heading"><span><ListChecks size={19} /></span><div><strong>Coordination work</strong><small>Create traceable tasks and issues without changing the drawing.</small></div></div>
                  <label className="wide">Title<input required value={workTitle} onChange={(event) => setWorkTitle(event.target.value)} placeholder="Coordinate return path above corridor" /></label>
                  <label>Type<select value={workKind} onChange={(event) => setWorkKind(event.target.value as CloudWorkItem["kind"])}><option value="task">Task</option><option value="issue">Issue</option></select></label>
                  <label>Priority<select value={workPriority} onChange={(event) => setWorkPriority(event.target.value as CloudWorkItem["priority"])}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
                  <label>Category<select value={workCategory} onChange={(event) => setWorkCategory(event.target.value)}><option value="coordination">Coordination</option><option value="design">Design</option><option value="airflow">Airflow</option><option value="field">Field</option><option value="review">Review</option></select></label>
                  <label>System<input value={workSystemId} onChange={(event) => setWorkSystemId(event.target.value)} placeholder="S1" /></label>
                  <label>Page<input inputMode="numeric" value={workPageNumber} onChange={(event) => setWorkPageNumber(event.target.value)} placeholder="3" /></label>
                  <label className="wide">Description<textarea value={workDescription} onChange={(event) => setWorkDescription(event.target.value)} placeholder="Add the decision, constraint, or field condition the team needs to resolve." /></label>
                  <button className="cloud-primary" disabled={busy === "create-work"}>{busy === "create-work" ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Add to project</button>
                </form> : <div className="cloud-permission-note"><ShieldCheck size={17} /><div><strong>Review access</strong><span>Viewers can inspect work and add coordination notes. An editor can create or change project work.</span></div></div>}
                <div className="cloud-work-list">
                  <div className="cloud-list-title"><strong>Project work</strong><span>{openWorkItems.length} open · {workItems.length} total</span></div>
                  {workItems.map((item) => <article key={item.id} className={`cloud-work-item ${expandedWorkItemId === item.id ? "expanded" : ""}`}>
                    <button className="cloud-work-summary" onClick={() => void toggleWorkItem(item)}>
                      <span className={`priority ${item.priority}`}>{item.priority}</span>
                      <div><strong>{item.title}</strong><small>{item.kind} · {item.category}{item.system_id ? ` · ${item.system_id}` : ""}{item.page_number ? ` · page ${item.page_number}` : ""} · v{item.version}</small></div>
                      <em className={`status ${item.status}`}>{item.status.replaceAll("_", " ")}</em>
                      <ChevronRight size={15} />
                    </button>
                    {expandedWorkItemId === item.id && <div className="cloud-work-expanded">
                      <p>{item.description || "No additional description."}</p>
                      {canEdit && <div className="cloud-work-actions">
                        {item.status !== "open" && <button onClick={() => void setWorkItemStatus(item, "open")}>Open</button>}
                        {item.status !== "in_progress" && <button onClick={() => void setWorkItemStatus(item, "in_progress")}>Start work</button>}
                        {item.status !== "blocked" && <button onClick={() => void setWorkItemStatus(item, "blocked")}>Mark blocked</button>}
                        {item.status !== "resolved" && <button onClick={() => void setWorkItemStatus(item, "resolved")}><Check size={13} /> Resolve</button>}
                      </div>}
                      <div className="cloud-comments">
                        <strong><MessageSquare size={14} /> Coordination notes</strong>
                        {(comments[item.id] || []).map((comment) => <div key={comment.id}><p>{comment.body}</p><small>{formatDate(comment.created_at)}</small></div>)}
                        <form onSubmit={(event) => void addComment(event, item)}><input required value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add a decision or handoff note" /><button disabled={busy === `comment-${item.id}`}>Comment</button></form>
                      </div>
                    </div>}
                  </article>)}
                  {!workItems.length && <div className="cloud-empty-state"><ListChecks size={23} /><strong>No coordination work yet</strong><span>Add the first field question, design task, or review issue above.</span></div>}
                </div>
              </div> : view === "revisions" ? <div className="cloud-revisions-view">
                {canEdit ? <div className="cloud-save-revision">
                  <div><span><CloudUpload size={17} /></span><div><strong>Save a cloud revision</strong><small>Local autosave continues between these named checkpoints.</small></div></div>
                  {!workingProjectMatchesActive && <div className="cloud-revision-safety"><ShieldCheck size={15} /><span><strong>Project-safe save is locked</strong><small>Open one of this project&apos;s revisions below before saving. Your current drawing stays untouched.</small></span></div>}
                  <div className="cloud-revision-fields">
                    <label>Revision title<input value={revisionTitle} onChange={(event) => setRevisionTitle(event.target.value)} placeholder={`Revision ${(revisions[0]?.revision_number || 0) + 1}`} /></label>
                    <label>What changed?<input value={revisionSummary} onChange={(event) => setRevisionSummary(event.target.value)} placeholder="Adjusted trunk size and added returns" /></label>
                    <button className="cloud-primary" onClick={() => void saveRevision()} disabled={busy === "revision" || !workingProjectMatchesActive}>
                      {busy === "revision" ? <LoaderCircle className="spin" size={15} /> : <CloudUpload size={15} />} Save revision
                    </button>
                  </div>
                </div> : <div className="cloud-permission-note"><ShieldCheck size={17} /><div><strong>Immutable revision history</strong><span>You can review and safely open prior checkpoints. Editors save new revisions.</span></div></div>}
                <div className="cloud-revision-list">
                  {revisions.map((revision) => <article key={revision.id}>
                    <div className="cloud-revision-number">R{revision.revision_number}</div>
                    <div><strong>{revision.title}</strong><span>{revision.summary || "No revision note"}</span><small>{formatDate(revision.created_at)} · {revision.drawing_count} drawing objects{revision.content_hash ? ` · ${revision.content_hash.slice(0, 10)}…` : ""}</small></div>
                    <button onClick={() => setPendingRestore(revision)}><Download size={14} /> Review restore</button>
                  </article>)}
                  {!revisions.length && <div className="cloud-empty-state"><History size={22} /><strong>No revisions saved</strong><span>Save the current drawing as the first cloud checkpoint.</span></div>}
                </div>
              </div> : view === "reviews" ? <div className="cloud-reviews-view">
                {canEdit ? <form className="cloud-approval-request" onSubmit={requestApproval}>
                  <div className="cloud-section-heading"><span><ShieldCheck size={19} /></span><div><strong>Revision approvals</strong><small>Request a formal review of the latest immutable revision. Decisions never alter geometry.</small></div></div>
                  <label>Latest revision<input readOnly value={revisions[0] ? `R${revisions[0].revision_number} · ${revisions[0].title}` : "Save a revision first"} /></label>
                  <label>Reviewer<select required value={approvalReviewerId} onChange={(event) => setApprovalReviewerId(event.target.value)}><option value="">Select an active collaborator</option>{members.filter((member) => member.status === "active" && member.user_id && member.user_id !== userId).map((member) => <option key={member.id} value={member.user_id || ""}>{member.invited_email || "Cloud collaborator"} · {member.role}</option>)}</select></label>
                  <button className="cloud-primary" disabled={busy === "approval" || !revisions[0]}>{busy === "approval" ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />} Request review</button>
                </form> : <div className="cloud-permission-note"><ShieldCheck size={17} /><div><strong>Independent review</strong><span>You can inspect every decision and respond to reviews assigned to you.</span></div></div>}
                <label className="cloud-approval-note">Decision note<textarea value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="State what was approved or what must change before the next revision." /></label>
                <div className="cloud-approval-list">
                  {approvals.map((approval) => {
                    const revision = revisions.find((candidate) => candidate.id === approval.revision_id);
                    return <article key={approval.id}>
                      <span className={`approval-icon ${approval.status}`}>{approval.status === "approved" ? <CheckCircle2 size={18} /> : approval.status === "changes_requested" ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}</span>
                      <div><strong>{revision ? `Revision ${revision.revision_number}` : "Revision review"}</strong><small>{approval.status.replaceAll("_", " ")} · requested {formatDate(approval.requested_at)}</small>{approval.decision_note && <p>{approval.decision_note}</p>}</div>
                      {approval.status === "requested" && approval.reviewer_id === userId && <div><button onClick={() => void decideApproval(approval, "changes_requested")}>Request changes</button><button className="approve" onClick={() => void decideApproval(approval, "approved")}><Check size={13} /> Approve</button></div>}
                    </article>;
                  })}
                  {!approvals.length && <div className="cloud-empty-state"><ShieldCheck size={22} /><strong>No revision reviews yet</strong><span>Save a revision, invite the reviewer, then request a traceable decision.</span></div>}
                </div>
              </div> : view === "files" ? <div className="cloud-files-view">
                <section className="cloud-file-hero">
                  <span><FileStack size={22} /></span>
                  <div><small>PROJECT EVIDENCE</small><strong>One trusted trail from source plan to field package.</strong><p>Google Drive holds shareable files; Supabase records which immutable revision produced each package.</p></div>
                </section>
                <div className="cloud-file-grid">
                  <article><span><FileStack size={18} /></span><div><small>SOURCE PLAN</small><strong>{activeProject.source_file_name || "No source plan linked"}</strong><p>{activeProject.source_drive_file_id ? "Linked from Google Drive" : "Imported locally; add a Drive source when collaboration begins."}</p></div></article>
                  <article className={driveState}><span><HardDrive size={18} /></span><div><small>VERIFIED CLOUD PACKAGE</small><strong>{driveStateLabel}</strong><p>{activeProject.drive_package_file_id ? `Latest evidence points to cloud revision R${syncedRevisionNumber || "—"}.` : "Create a package after saving the first named revision."}</p>{activeProject.drive_package_url && <a href={activeProject.drive_package_url} target="_blank" rel="noreferrer">Open package <ExternalLink size={12} /></a>}</div>{canEdit && <button onClick={() => void exportToDrive()} disabled={busy === "drive" || !latestRevisionNumber}>{busy === "drive" ? <LoaderCircle className="spin" size={14} /> : <HardDrive size={14} />} Sync latest revision</button>}</article>
                </div>
                <div className="cloud-file-list">
                  <div className="cloud-list-title"><strong>Registered project files</strong><span>{projectFiles.length} active</span></div>
                  {projectFiles.map((file) => <article key={file.id}><span><FileStack size={16} /></span><div><strong>{file.display_name}</strong><small>{file.kind.replaceAll("_", " ")} · {formatDate(file.updated_at)}</small></div>{file.web_view_url && <a href={file.web_view_url} target="_blank" rel="noreferrer">Open <ExternalLink size={12} /></a>}</article>)}
                  {!projectFiles.length && <div className="cloud-empty-state"><HardDrive size={22} /><strong>No verified files registered</strong><span>Sync the latest revision to Google Drive to establish the first evidence package.</span></div>}
                </div>
              </div> : view === "people" ? <div className="cloud-people-view">
                {isOwner && <form className="cloud-invite-form" onSubmit={invite}>
                  <div><UserPlus size={17} /><span><strong>Invite a collaborator</strong><small>Editors can save revisions. Viewers can inspect project history.</small></span></div>
                  <input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" />
                  <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")}><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
                  <button className="cloud-primary" disabled={busy === "invite"}>{busy === "invite" ? <LoaderCircle className="spin" size={14} /> : <UserPlus size={14} />} Add</button>
                </form>}
                <div className="cloud-member-list">
                  {members.map((member) => <article key={member.id}>
                    <span className={member.status === "active" ? "active" : "pending"}>{member.status === "active" ? <Check size={13} /> : <Users size={13} />}</span>
                    <div><strong>{member.invited_email || (member.role === "owner" ? "Project owner" : "Cloud member")}</strong><small>{member.role} · {member.status}</small></div>
                    {isOwner && member.role !== "owner" && <button title="Remove collaborator" onClick={() => void removeMember(member)} disabled={busy === `remove-${member.id}`}><Trash2 size={14} /></button>}
                  </article>)}
                </div>
              </div> : <div className="cloud-activity-view">
                {activity.map((item) => <article key={item.id}>
                  <span><Activity size={14} /></span>
                  <div><strong>{actionLabel(item.action)}</strong><small>{formatDate(item.created_at)}</small></div>
                </article>)}
                {!activity.length && <div className="cloud-empty-state"><Activity size={22} /><strong>No activity yet</strong><span>Trusted project, revision, coordination, approval, and Drive events will appear here.</span></div>}
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
