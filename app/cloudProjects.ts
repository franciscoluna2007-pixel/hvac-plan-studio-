import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

type CloudConfig = {
  url: string;
  publishableKey: string;
};

export type CloudProject = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  source_file_name: string | null;
  source_drive_file_id: string | null;
  drive_package_file_id: string | null;
  drive_package_url: string | null;
  drive_synced_revision_number: number;
  drive_synced_at: string | null;
  workflow_summary: Record<string, unknown>;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type CloudRevision = {
  id: string;
  project_id: string;
  revision_number: number;
  created_by: string;
  title: string;
  summary: string;
  snapshot: Record<string, unknown>;
  workflow_summary: Record<string, unknown>;
  content_hash: string;
  release_fingerprint: string | null;
  drawing_count: number;
  created_at: string;
};

export type CloudMember = {
  id: string;
  project_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: "owner" | "editor" | "viewer";
  status: "pending" | "active";
  created_at: string;
  accepted_at: string | null;
};

export type CloudActivity = {
  id: number;
  project_id: string;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type CloudWorkItem = {
  id: string;
  project_id: string;
  revision_id: string | null;
  kind: "issue" | "task";
  status: "open" | "in_progress" | "blocked" | "resolved" | "closed";
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  system_id: string | null;
  page_number: number | null;
  drawing_id: string | null;
  anchor: Record<string, unknown>;
  assigned_to: string | null;
  due_at: string | null;
  created_by: string;
  resolved_by: string | null;
  resolved_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type CloudComment = {
  id: number;
  project_id: string;
  work_item_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type CloudApproval = {
  id: string;
  project_id: string;
  revision_id: string;
  reviewer_id: string;
  requested_by: string;
  status: "requested" | "approved" | "changes_requested";
  decision_note: string;
  requested_at: string;
  decided_at: string | null;
};

export type CloudProjectFile = {
  id: string;
  project_id: string;
  revision_id: string | null;
  kind: "source_plan" | "cloud_package" | "field_release" | "takeoff" | "submittal" | "photo" | "other";
  provider: "google_drive";
  provider_file_id: string;
  display_name: string;
  mime_type: string | null;
  web_view_url: string | null;
  status: "active" | "archived";
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CloudFieldRelease = {
  id: string;
  project_id: string;
  revision_id: string;
  system_id: string;
  release_revision: string;
  released_by_name: string;
  drawing_signature: string;
  release_signature: string;
  release_payload: Record<string, unknown>;
  created_by: string;
  created_at: string;
};

export type ProjectHomeCard = CloudProject & {
  latest_revision_id: string | null;
  latest_revision_number: number;
  open_work: number;
  critical_work: number;
  blocked_work: number;
  pending_approvals: number;
  changes_requested: number;
  active_members: number;
  file_count: number;
  release_count: number;
};

let clientPromise: Promise<SupabaseClient> | null = null;

async function getConfiguration(): Promise<CloudConfig> {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Cloud Projects is not configured yet.");
  }
  const config = await response.json() as Partial<CloudConfig>;
  if (!config.url || !config.publishableKey) {
    throw new Error("Cloud Projects is not configured yet.");
  }
  return config as CloudConfig;
}

export function getCloudClient() {
  if (!clientPromise) {
    clientPromise = getConfiguration().then(({ url, publishableKey }) =>
      createClient(url, publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "hvac-plan-studio-cloud-auth",
        },
      }),
    );
  }
  return clientPromise;
}

export async function currentCloudUser(): Promise<User | null> {
  const client = await getCloudClient();
  const { data, error } = await client.auth.getUser();
  if (error && !error.message.toLowerCase().includes("session")) throw error;
  if (data.user) {
    const { error: claimError } = await client.rpc("claim_project_invitations");
    if (claimError) throw claimError;
  }
  return data.user;
}

export async function signInCloud(email: string, password: string) {
  const client = await getCloudClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await client.rpc("claim_project_invitations");
  return data.user;
}

export async function signUpCloud(email: string, password: string, displayName: string) {
  const client = await getCloudClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName.trim() || email.split("@")[0] } },
  });
  if (error) throw error;
  if (data.session) await client.rpc("claim_project_invitations");
  return data;
}

export async function signOutCloud() {
  const client = await getCloudClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function listCloudProjects() {
  const client = await getCloudClient();
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CloudProject[];
}

export async function listProjectHomeCards() {
  const client = await getCloudClient();
  const { data, error } = await client.rpc("list_project_home_cards");
  if (error) {
    // Keep Project Home useful during a staged rollout or local-only setup.
    const projects = await listCloudProjects();
    return projects.map((project) => ({
      ...project,
      latest_revision_id: null,
      latest_revision_number: 0,
      open_work: 0,
      critical_work: 0,
      blocked_work: 0,
      pending_approvals: 0,
      changes_requested: 0,
      active_members: 1,
      file_count: project.source_file_name ? 1 : 0,
      release_count: 0,
    })) satisfies ProjectHomeCard[];
  }
  return (data || []).map((project: ProjectHomeCard) => ({
    ...project,
    latest_revision_number: Number(project.latest_revision_number || 0),
    open_work: Number(project.open_work || 0),
    critical_work: Number(project.critical_work || 0),
    blocked_work: Number(project.blocked_work || 0),
    pending_approvals: Number(project.pending_approvals || 0),
    changes_requested: Number(project.changes_requested || 0),
    active_members: Number(project.active_members || 0),
    file_count: Number(project.file_count || 0),
    release_count: Number(project.release_count || 0),
  })) as ProjectHomeCard[];
}

export async function createCloudProject(input: {
  name: string;
  sourceFileName?: string;
  sourceDriveFileId?: string | null;
}) {
  const client = await getCloudClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw authError || new Error("Sign in to create a cloud project.");
  const { data, error } = await client
    .from("projects")
    .insert({
      owner_id: auth.user.id,
      name: input.name.trim() || "Untitled HVAC Project",
      source_file_name: input.sourceFileName || null,
      source_drive_file_id: input.sourceDriveFileId || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CloudProject;
}

export async function updateCloudProject(
  projectId: string,
  patch: Partial<Pick<CloudProject, "name" | "description" | "source_file_name" | "source_drive_file_id">>,
) {
  const client = await getCloudClient();
  const { data, error } = await client.from("projects").update(patch).eq("id", projectId).select("*").single();
  if (error) throw error;
  return data as CloudProject;
}

export async function setCloudProjectStatus(projectId: string, status: "active" | "archived") {
  const client = await getCloudClient();
  const { data, error } = await client.rpc("set_project_status", {
    project_uuid: projectId,
    next_status: status,
  });
  if (error) throw error;
  const project = Array.isArray(data) ? data[0] : data;
  if (!project) throw new Error("The project status update was not returned.");
  return project as CloudProject;
}

export async function recordDrivePackageSync(input: {
  projectId: string;
  fileId: string;
  fileUrl: string;
  revisionNumber: number;
}) {
  const client = await getCloudClient();
  const { data, error } = await client.rpc("record_drive_package_sync", {
    project_uuid: input.projectId,
    package_file_id: input.fileId,
    package_file_url: input.fileUrl,
    synced_revision: input.revisionNumber,
  });
  if (error) throw error;
  const project = Array.isArray(data) ? data[0] : data;
  if (!project) throw new Error("The Drive sync record was not returned.");
  return project as CloudProject;
}

export async function saveCloudRevision(input: {
  projectId: string;
  snapshot: Record<string, unknown>;
  title: string;
  summary: string;
  drawingCount: number;
}) {
  const client = await getCloudClient();
  const { data, error } = await client
    .rpc("save_project_revision", {
      project_uuid: input.projectId,
      revision_title: input.title,
      revision_summary: input.summary,
      revision_snapshot: input.snapshot,
      revision_drawing_count: input.drawingCount,
    });
  if (error) throw error;
  const revision = Array.isArray(data) ? data[0] : data;
  if (!revision) throw new Error("The cloud revision was not returned after saving.");
  return revision as CloudRevision;
}

export async function issueCloudFieldRelease(input: {
  projectId: string;
  revisionId: string;
  releaseFingerprint: string;
  systemId: string;
  releaseRevision: string;
  releasedByName: string;
  drawingSignature: string;
  releaseSignature: string;
  releasePayload: Record<string, unknown>;
}) {
  const client = await getCloudClient();
  const { data, error } = await client.rpc("issue_project_field_release", {
    project_uuid: input.projectId,
    cloud_revision_uuid: input.revisionId,
    expected_release_fingerprint: input.releaseFingerprint,
    system_identifier: input.systemId,
    release_revision_name: input.releaseRevision,
    released_by_label: input.releasedByName,
    drawing_signature_value: input.drawingSignature,
    release_signature_value: input.releaseSignature,
    release_payload_value: input.releasePayload,
  });
  if (error) throw error;
  const release = Array.isArray(data) ? data[0] : data;
  if (!release) throw new Error("The verified field release was not returned.");
  return release as CloudFieldRelease;
}

export async function listCloudRevisions(projectId: string) {
  const client = await getCloudClient();
  const { data, error } = await client
    .from("project_revisions")
    .select("*")
    .eq("project_id", projectId)
    .order("revision_number", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data || []) as CloudRevision[];
}

export async function listCloudMembers(projectId: string) {
  const client = await getCloudClient();
  const { data, error } = await client
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as CloudMember[];
}

export async function inviteCloudMember(projectId: string, email: string, role: "editor" | "viewer") {
  const client = await getCloudClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw authError || new Error("Sign in to invite a collaborator.");
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) throw new Error("Enter a valid collaborator email.");
  const { data, error } = await client
    .from("project_members")
    .insert({
      project_id: projectId,
      invited_email: normalizedEmail,
      role,
      status: "pending",
      invited_by: auth.user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CloudMember;
}

export async function removeCloudMember(memberId: string) {
  const client = await getCloudClient();
  const { error } = await client.from("project_members").delete().eq("id", memberId);
  if (error) throw error;
}

export async function listCloudActivity(projectId: string) {
  const client = await getCloudClient();
  const { data, error } = await client
    .from("project_activity")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []) as CloudActivity[];
}

export async function listCloudWorkItems(projectId: string) {
  const client = await getCloudClient();
  const { data, error } = await client
    .from("project_work_items")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as CloudWorkItem[];
}

export async function createCloudWorkItem(input: {
  projectId: string;
  revisionId?: string | null;
  kind: CloudWorkItem["kind"];
  priority: CloudWorkItem["priority"];
  category?: string;
  title: string;
  description?: string;
  systemId?: string | null;
  pageNumber?: number | null;
  drawingId?: string | null;
  dueAt?: string | null;
}) {
  const client = await getCloudClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw authError || new Error("Sign in to create project work.");
  const title = input.title.trim();
  if (!title) throw new Error("Add a title for this work item.");
  const { data, error } = await client
    .from("project_work_items")
    .insert({
      project_id: input.projectId,
      revision_id: input.revisionId || null,
      kind: input.kind,
      priority: input.priority,
      category: input.category?.trim() || "coordination",
      title,
      description: input.description?.trim() || "",
      system_id: input.systemId || null,
      page_number: input.pageNumber || null,
      drawing_id: input.drawingId || null,
      due_at: input.dueAt || null,
      created_by: auth.user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CloudWorkItem;
}

export async function updateCloudWorkItem(
  workItemId: string,
  patch: Partial<Pick<
    CloudWorkItem,
    "kind" | "status" | "priority" | "category" | "title" | "description" | "system_id" | "page_number" | "drawing_id" | "assigned_to" | "due_at"
  >>,
) {
  const client = await getCloudClient();
  const { data, error } = await client
    .from("project_work_items")
    .update(patch)
    .eq("id", workItemId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CloudWorkItem;
}

export async function listCloudComments(workItemId: string) {
  const client = await getCloudClient();
  const { data, error } = await client
    .from("project_comments")
    .select("*")
    .eq("work_item_id", workItemId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as CloudComment[];
}

export async function createCloudComment(projectId: string, workItemId: string, body: string) {
  const client = await getCloudClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw authError || new Error("Sign in to comment.");
  const normalizedBody = body.trim();
  if (!normalizedBody) throw new Error("Write a comment first.");
  const { data, error } = await client
    .from("project_comments")
    .insert({
      project_id: projectId,
      work_item_id: workItemId,
      author_id: auth.user.id,
      body: normalizedBody,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CloudComment;
}

export async function listCloudApprovals(projectId: string) {
  const client = await getCloudClient();
  const { data, error } = await client
    .from("project_approvals")
    .select("*")
    .eq("project_id", projectId)
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CloudApproval[];
}

export async function createCloudApproval(projectId: string, revisionId: string, reviewerId: string) {
  const client = await getCloudClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw authError || new Error("Sign in to request a review.");
  const { data, error } = await client
    .from("project_approvals")
    .insert({
      project_id: projectId,
      revision_id: revisionId,
      reviewer_id: reviewerId,
      requested_by: auth.user.id,
      status: "requested",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CloudApproval;
}

export async function decideCloudApproval(
  approvalId: string,
  status: "approved" | "changes_requested",
  decisionNote: string,
) {
  const client = await getCloudClient();
  const { data, error } = await client
    .from("project_approvals")
    .update({ status, decision_note: decisionNote.trim() })
    .eq("id", approvalId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CloudApproval;
}

export async function listCloudProjectFiles(projectId: string) {
  const client = await getCloudClient();
  const { data, error } = await client
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CloudProjectFile[];
}

export async function registerCloudProjectFile(input: {
  projectId: string;
  revisionId?: string | null;
  kind: CloudProjectFile["kind"];
  fileId: string;
  displayName: string;
  mimeType?: string | null;
  webViewUrl?: string | null;
}) {
  const client = await getCloudClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw authError || new Error("Sign in to register a project file.");
  const { data: existing, error: existingError } = await client
    .from("project_files")
    .select("*")
    .eq("project_id", input.projectId)
    .eq("provider", "google_drive")
    .eq("provider_file_id", input.fileId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const { data, error } = await client
      .from("project_files")
      .update({
        revision_id: input.revisionId || null,
        kind: input.kind,
        display_name: input.displayName,
        mime_type: input.mimeType || null,
        web_view_url: input.webViewUrl || null,
        status: "active",
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as CloudProjectFile;
  }
  const { data, error } = await client
    .from("project_files")
    .insert({
      project_id: input.projectId,
      revision_id: input.revisionId || null,
      kind: input.kind,
      provider: "google_drive",
      provider_file_id: input.fileId,
      display_name: input.displayName,
      mime_type: input.mimeType || null,
      web_view_url: input.webViewUrl || null,
      created_by: auth.user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CloudProjectFile;
}
