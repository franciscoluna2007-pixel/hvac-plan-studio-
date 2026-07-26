"use client";

import { currentCloudUser, getCloudClient } from "./cloudProjects";
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  normalizeWorkspacePreferences,
  type WorkspacePreferences,
} from "./workspaceDisplay";

const STORAGE_KEY = "hvac-plan-studio:workspace-preferences:v1";

export function loadLocalWorkspacePreferences() {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE_PREFERENCES;
  try {
    return normalizeWorkspacePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }
}

export function saveLocalWorkspacePreferences(preferences: WorkspacePreferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export async function loadCloudWorkspacePreferences() {
  try {
    const user = await currentCloudUser();
    if (!user) return null;
    const client = await getCloudClient();
    const { data, error } = await client
      .from("workspace_preferences")
      .select("render_quality,ui_density,left_panel_open,right_panel_open")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return normalizeWorkspacePreferences({
      renderQuality: data.render_quality,
      density: data.ui_density,
      leftPanelOpen: data.left_panel_open,
      rightPanelOpen: data.right_panel_open,
    });
  } catch {
    return null;
  }
}

export async function saveCloudWorkspacePreferences(preferences: WorkspacePreferences) {
  try {
    const user = await currentCloudUser();
    if (!user) return false;
    const client = await getCloudClient();
    const { error } = await client.from("workspace_preferences").upsert({
      user_id: user.id,
      render_quality: preferences.renderQuality,
      ui_density: preferences.density,
      left_panel_open: preferences.leftPanelOpen,
      right_panel_open: preferences.rightPanelOpen,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

