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
  patch: Partial<Pick<CloudProject, "name" | "description" | "source_file_name" | "source_drive_file_id" | "drive_package_file_id" | "drive_package_url" | "status">>,
) {
  const client = await getCloudClient();
  const { data, error } = await client.from("projects").update(patch).eq("id", projectId).select("*").single();
  if (error) throw error;
  return data as CloudProject;
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
