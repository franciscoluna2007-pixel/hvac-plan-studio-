export type RenderQualityMode = "auto" | "performance" | "sharp" | "4k";
export type WorkspaceDensity = "comfortable" | "compact";
export type WorkspaceLayoutMode = "desktop" | "tablet-landscape" | "tablet-portrait";

export type WorkspacePreferences = {
  renderQuality: RenderQualityMode;
  density: WorkspaceDensity;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
};

export type Camera = { x: number; y: number };
export type ScreenPoint = { x: number; y: number };

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  renderQuality: "auto",
  density: "comfortable",
  leftPanelOpen: true,
  rightPanelOpen: true,
};

export const MIN_WORKSPACE_ZOOM = 0.25;
export const MAX_WORKSPACE_ZOOM = 12;

const QUALITY_LIMITS: Record<RenderQualityMode, { megapixels: number; maxAxis: number; label: string }> = {
  performance: { megapixels: 4, maxAxis: 4096, label: "Performance · 4 MP" },
  auto: { megapixels: 12, maxAxis: 8192, label: "Auto · up to 12 MP" },
  sharp: { megapixels: 16, maxAxis: 8192, label: "Sharp · up to 16 MP" },
  "4k": { megapixels: 8.2944, maxAxis: 5120, label: "4K Fixed · 8.3 MP" },
};

export function clampZoom(value: number) {
  return Math.max(MIN_WORKSPACE_ZOOM, Math.min(MAX_WORKSPACE_ZOOM, Number.isFinite(value) ? value : 1));
}

export function midpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function pointDistance(a: ScreenPoint, b: ScreenPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pinchCamera(input: {
  anchorPlan: ScreenPoint;
  currentMidpoint: ScreenPoint;
  startDistance: number;
  currentDistance: number;
  startZoom: number;
}) {
  const distanceRatio = input.startDistance > 0
    ? input.currentDistance / input.startDistance
    : 1;
  const zoom = clampZoom(input.startZoom * distanceRatio);
  return {
    zoom,
    camera: {
      x: input.currentMidpoint.x - input.anchorPlan.x * zoom,
      y: input.currentMidpoint.y - input.anchorPlan.y * zoom,
    },
  };
}

export function workspaceLayoutFor(width: number, height: number, coarsePointer = false): WorkspaceLayoutMode {
  if (width >= 1200 && (!coarsePointer || width >= 1360)) return "desktop";
  return width >= height ? "tablet-landscape" : "tablet-portrait";
}

export function normalizeWorkspacePreferences(value: unknown): WorkspacePreferences {
  if (!value || typeof value !== "object") return DEFAULT_WORKSPACE_PREFERENCES;
  const candidate = value as Partial<WorkspacePreferences>;
  return {
    renderQuality: ["auto", "performance", "sharp", "4k"].includes(candidate.renderQuality || "")
      ? candidate.renderQuality as RenderQualityMode
      : DEFAULT_WORKSPACE_PREFERENCES.renderQuality,
    density: ["comfortable", "compact"].includes(candidate.density || "")
      ? candidate.density as WorkspaceDensity
      : DEFAULT_WORKSPACE_PREFERENCES.density,
    leftPanelOpen: typeof candidate.leftPanelOpen === "boolean"
      ? candidate.leftPanelOpen
      : DEFAULT_WORKSPACE_PREFERENCES.leftPanelOpen,
    rightPanelOpen: typeof candidate.rightPanelOpen === "boolean"
      ? candidate.rightPanelOpen
      : DEFAULT_WORKSPACE_PREFERENCES.rightPanelOpen,
  };
}

export function renderQualityPlan(input: {
  logicalWidth: number;
  logicalHeight: number;
  zoom: number;
  devicePixelRatio: number;
  mode: RenderQualityMode;
}) {
  const logicalPixels = Math.max(1, input.logicalWidth * input.logicalHeight);
  const limits = QUALITY_LIMITS[input.mode];
  const requestedRatio = input.mode === "4k"
    ? Math.sqrt((limits.megapixels * 1_000_000) / logicalPixels)
    : input.mode === "performance"
      ? Math.min(1, input.devicePixelRatio)
      : Math.max(1, input.devicePixelRatio * Math.min(input.zoom, 4));
  const budgetRatio = Math.sqrt((limits.megapixels * 1_000_000) / logicalPixels);
  const axisRatio = Math.min(
    limits.maxAxis / Math.max(1, input.logicalWidth),
    limits.maxAxis / Math.max(1, input.logicalHeight),
  );
  const ratio = Math.max(0.01, Math.min(requestedRatio, budgetRatio, axisRatio));
  const width = Math.max(1, Math.floor(input.logicalWidth * ratio));
  const height = Math.max(1, Math.floor(input.logicalHeight * ratio));
  return {
    ratio,
    width,
    height,
    megapixels: width * height / 1_000_000,
    requestedRatio,
    reduced: ratio + 0.01 < requestedRatio,
    label: limits.label,
  };
}
