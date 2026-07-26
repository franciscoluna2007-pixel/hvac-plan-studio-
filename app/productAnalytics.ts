"use client";

import { PRODUCT_ENTITLEMENTS, tierFromProfile, type ProductTier } from "./entitlements";
import { currentCloudUser, getCloudClient } from "./cloudProjects";

export type ProductEventName =
  | "workspace_opened"
  | "pdf_opened"
  | "ai_analysis_started"
  | "ai_analysis_completed"
  | "ai_analysis_failed"
  | "finding_decided"
  | "markup_created"
  | "takeoff_exported"
  | "takeoff_package_saved"
  | "cloud_project_saved"
  | "cloud_revision_saved"
  | "drive_imported"
  | "drive_package_saved"
  | "revision_opened"
  | "upgrade_viewed"
  | "early_access_requested"
  | "application_error";

export type PlatformProfile = {
  id: string;
  email: string;
  display_name: string | null;
  platform_role: "member" | "owner" | "admin";
  plan_tier: "free" | "professional" | "team";
  subscription_status: "none" | "early_access" | "trialing" | "active" | "past_due" | "canceled";
};

export type AccountUsageSummary = {
  tier: ProductTier;
  aiPagesUsed: number;
  aiPagesLimit: number;
  takeoffExportsUsed: number;
  takeoffExportsLimit: number;
  cloudProjectsUsed: number;
  cloudProjectsLimit: number;
  periodStart: string;
};

export type OwnerAnalyticsSummary = {
  windowDays: number;
  generatedAt: string;
  audience: {
    uniqueVisitors: number;
    visits: number;
    returningVisitors: number;
    registeredAccounts: number;
    newAccounts: number;
    signupConversionPercent: number;
  };
  activation: {
    pdfsOpened: number;
    aiAnalyses: number;
    findingsDecided: number;
    takeoffsExported: number;
    activatedVisitors: number;
  };
  engagement: {
    dailyActive: number;
    weeklyActive: number;
    monthlyActive: number;
    activeCloudProjects: number;
    aiPagesRead: number;
    driveImports: number;
  };
  growth: {
    upgradeViews: number;
    earlyAccessRequests: number;
    freeAccounts: number;
    professionalAccounts: number;
    teamAccounts: number;
  };
  reliability: {
    completedAnalyses: number;
    failedAnalyses: number;
    analysisSuccessPercent: number;
    applicationErrors: number;
  };
  topEvents: Array<{ event: string; count: number }>;
};

const VISITOR_KEY = "hvac-plan-studio-visitor-id";
const SESSION_KEY = "hvac-plan-studio-session-id";
const BLOCKED_PROPERTY_PATTERN = /(address|customer|email|excerpt|file|filename|name|pdf|plan_text|source)/i;

function browserId(key: string, storage: Storage) {
  const existing = storage.getItem(key);
  if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
    return existing;
  }
  const value = crypto.randomUUID();
  storage.setItem(key, value);
  return value;
}

function safeProperties(input: Record<string, unknown>) {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (BLOCKED_PROPERTY_PATTERN.test(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) output[key] = value;
    if (typeof value === "boolean") output[key] = value;
    if (typeof value === "string" && value.length <= 80) output[key] = value;
  }
  return output;
}

export async function trackProductEvent(
  eventName: ProductEventName,
  properties: Record<string, unknown> = {},
  options: { oncePerSession?: boolean } = {},
) {
  if (typeof window === "undefined") return;
  const onceKey = `hvac-event:${eventName}`;
  if (options.oncePerSession && sessionStorage.getItem(onceKey)) return;
  try {
    const client = await getCloudClient();
    const { error } = await client.from("usage_events").insert({
      visitor_id: browserId(VISITOR_KEY, localStorage),
      session_id: browserId(SESSION_KEY, sessionStorage),
      event_name: eventName,
      page_path: window.location.pathname,
    app_version: "112",
      properties: safeProperties(properties),
    });
    if (error) throw error;
    if (options.oncePerSession) sessionStorage.setItem(onceKey, "1");
  } catch {
    // Analytics must never interrupt plan reading, drawing, or takeoff work.
  }
}

export async function currentPlatformProfile(): Promise<PlatformProfile | null> {
  const user = await currentCloudUser();
  if (!user) return null;
  const client = await getCloudClient();
  const { data, error } = await client.rpc("get_account_context");
  if (error) throw error;
  return data as PlatformProfile;
}

export async function currentAccountUsage(): Promise<AccountUsageSummary> {
  const user = await currentCloudUser();
  if (!user) {
    const guest = PRODUCT_ENTITLEMENTS.guest;
    return {
      tier: "guest",
      aiPagesUsed: 0,
      aiPagesLimit: guest.aiPagesPerMonth,
      takeoffExportsUsed: 0,
      takeoffExportsLimit: guest.takeoffExportsPerMonth,
      cloudProjectsUsed: 0,
      cloudProjectsLimit: guest.cloudProjects,
      periodStart: new Date().toISOString().slice(0, 7) + "-01",
    };
  }
  const client = await getCloudClient();
  const { data, error } = await client.rpc("get_current_account_usage");
  if (error) throw error;
  const raw = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  const tier = tierFromProfile(String(raw?.tier || "free"));
  const limits = PRODUCT_ENTITLEMENTS[tier];
  return {
    tier,
    aiPagesUsed: Number(raw?.ai_pages_used || 0),
    aiPagesLimit: Number(raw?.ai_pages_limit ?? limits.aiPagesPerMonth),
    takeoffExportsUsed: Number(raw?.takeoff_exports_used || 0),
    takeoffExportsLimit: Number(raw?.takeoff_exports_limit ?? limits.takeoffExportsPerMonth),
    cloudProjectsUsed: Number(raw?.cloud_projects_used || 0),
    cloudProjectsLimit: Number(raw?.cloud_projects_limit ?? limits.cloudProjects),
    periodStart: String(raw?.period_start || new Date().toISOString().slice(0, 7) + "-01"),
  };
}

export async function joinProfessionalEarlyAccess() {
  const user = await currentCloudUser();
  if (!user) throw new Error("Create a free workspace before joining Professional early access.");
  const client = await getCloudClient();
  const { error } = await client.from("professional_early_access").insert({ source: "project_home" });
  if (error && error.code !== "23505") throw error;
  await trackProductEvent("early_access_requested");
}

export async function loadOwnerAnalytics(windowDays = 30) {
  const client = await getCloudClient();
  const { data, error } = await client.rpc("get_owner_analytics", { window_days: windowDays });
  if (error) throw error;
  return data as OwnerAnalyticsSummary;
}
