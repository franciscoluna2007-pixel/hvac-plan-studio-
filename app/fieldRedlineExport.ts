export const FIELD_REDLINE_EXPORT_VERSION = "field-redline-export-v133.0";

export const FIELD_REDLINE_EXPORT_ROLE_ATTRIBUTE =
  "data-field-redline-export-role";

export const FIELD_REDLINE_TRANSIENT_ROLE_ATTRIBUTE =
  "data-field-redline-transient-role";

export const FIELD_REDLINE_APPROVAL_NOTICE =
  "FIELD REDLINE - NOT APPROVED HVAC DESIGN";

export const FIELD_REDLINE_DOWNLOAD_RELEASE_DELAY_MS = 1_500;
export const FIELD_REDLINE_PDF_DOWNLOAD_RELEASE_DELAY_MS = 300_000;

export const FIELD_REDLINE_EXPORT_LIMITS = Object.freeze({
  standardLongEdge: 2048,
  fourKLongEdge: 4096,
  maxPixels: 8_294_400,
  maxAxis: 5_120,
  selectedAreaPadding: 24,
  jpegQuality: 0.92,
  maxFilenameLength: 120,
});

/**
 * These are committed scene roles, not DOM selectors. Export renderers must
 * draw only these roles from the scene model.
 */
export const FIELD_REDLINE_EXPORT_CONTENT_ALLOWLIST = Object.freeze([
  "source-plan",
  "hvac-runs",
  "hvac-symbols",
  "hvac-labels",
  "verified-measurements",
  "field-redlines",
] as const);

/**
 * Temporary interaction state is excluded even when it is visually present in
 * the editor. This list is passed to every committed-scene renderer.
 */
export const FIELD_REDLINE_EXPORT_TRANSIENT_EXCLUSIONS = Object.freeze([
  "selection-handles",
  "action-wheel",
  "hover-targets",
  "active-cursors",
  "placement-ghosts",
  "in-progress-strokes",
  "measure-previews",
  "assistant-suggestions",
  "repair-previews",
  "branch-opportunity-markers",
  "tool-chrome",
] as const);

export type FieldRedlineExportContentRole =
  typeof FIELD_REDLINE_EXPORT_CONTENT_ALLOWLIST[number];

export type FieldRedlineExportTransientRole =
  typeof FIELD_REDLINE_EXPORT_TRANSIENT_EXCLUSIONS[number];

export type FieldRedlineExportFormat = "png" | "jpg" | "pdf";
export type FieldRedlineRasterPreset = "standard" | "4k";
export type FieldRedlineArtifactState = "current" | "draft";

export type FieldRedlineRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FieldRedlineSheet = {
  id: string;
  page: number;
  label: string;
  width: number;
  height: number;
};

export type FieldRedlineExportScope =
  | { kind: "current-sheet" }
  | {
    kind: "selected-area";
    selection: FieldRedlineRect;
    padding?: number;
  };

export type FieldRedlineResolvedCrop = FieldRedlineRect & {
  kind: FieldRedlineExportScope["kind"];
  padding: number;
};

export type FieldRedlineRasterSize = {
  width: number;
  height: number;
  requestedLongEdge: number;
  actualLongEdge: number;
  pixelCount: number;
  preset: FieldRedlineRasterPreset;
};

export type FieldRedlineReleaseState = {
  current: boolean;
  revision?: string;
  fingerprint?: string;
};

export type FieldRedlineReviewState = {
  visibleCount: number;
  fingerprint?: string;
  reviewedFingerprint?: string | null;
};

export type FieldRedlineArtifactStatusReason =
  | "hvac-release-not-current"
  | "visible-redlines-unreviewed"
  | "visible-redlines-changed";

export type FieldRedlineArtifactStatus = {
  artifactState: FieldRedlineArtifactState;
  label: string;
  reasons: FieldRedlineArtifactStatusReason[];
  hvacReleaseCurrent: boolean;
  hvacReleaseLabel: string;
  redlineReview: "not-visible" | "current" | "unreviewed" | "changed";
  redlinesChanged: boolean;
};

export type FieldRedlineFooterField = {
  key:
    | "project"
    | "sheet"
    | "system"
    | "revision"
    | "hvac-release"
    | "redline-review"
    | "exported"
    | "artifact";
  label: string;
  value: string;
};

export type FieldRedlineFooterModel = {
  featureLabel: "Field Redline";
  artifactState: FieldRedlineArtifactState;
  statusStamp: string;
  title: string;
  fields: FieldRedlineFooterField[];
  approvalNotice: typeof FIELD_REDLINE_APPROVAL_NOTICE;
  notice: string;
};

export type FieldRedlineArtifactFingerprintInputs = {
  version: typeof FIELD_REDLINE_EXPORT_VERSION;
  sourceFingerprint: string;
  committedSceneFingerprint: string;
  sheet: {
    id: string;
    page: number;
    label: string;
  };
  scope: {
    kind: FieldRedlineExportScope["kind"];
    crop: FieldRedlineResolvedCrop;
  };
  raster: FieldRedlineRasterSize;
  format: FieldRedlineExportFormat;
  includedContent: FieldRedlineExportContentRole[];
  excludedTransientContent: FieldRedlineExportTransientRole[];
  hvacRelease: {
    current: boolean;
    revision: string;
    fingerprint: string;
  };
  redlines: {
    visibleCount: number;
    fingerprint: string;
    reviewedFingerprint: string;
  };
  artifactStatus: {
    state: FieldRedlineArtifactState;
    reasons: FieldRedlineArtifactStatusReason[];
  };
  metadata: {
    projectName: string;
    systemName: string;
    reviewer: string;
    exportedAt: string;
  };
};

export type BuildFieldRedlineExportPlanInput = {
  sheet: FieldRedlineSheet;
  scope: FieldRedlineExportScope;
  preset?: FieldRedlineRasterPreset;
  requestedLongEdge?: number;
  format: FieldRedlineExportFormat | string;
  filename: string;
  sourceFingerprint: string;
  committedSceneFingerprint: string;
  hvacRelease: FieldRedlineReleaseState;
  redlines: FieldRedlineReviewState;
  projectName: string;
  systemName: string;
  reviewer?: string;
  exportedAt: string;
  includedContent?: readonly (FieldRedlineExportContentRole | string)[];
};

export type FieldRedlineCommittedSceneRenderRequest = {
  version: typeof FIELD_REDLINE_EXPORT_VERSION;
  artifactFingerprint: string;
  sheet: FieldRedlineSheet;
  scope: FieldRedlineExportScope["kind"];
  crop: FieldRedlineResolvedCrop;
  pixelSize: {
    width: number;
    height: number;
  };
  includedContent: readonly FieldRedlineExportContentRole[];
  excludedTransientContent: readonly FieldRedlineExportTransientRole[];
  footer: FieldRedlineFooterModel;
};

export type FieldRedlineExportPlan = {
  version: typeof FIELD_REDLINE_EXPORT_VERSION;
  sheet: FieldRedlineSheet;
  scope: FieldRedlineExportScope["kind"];
  crop: FieldRedlineResolvedCrop;
  raster: FieldRedlineRasterSize;
  format: FieldRedlineExportFormat;
  mimeType: string;
  filename: string;
  includedContent: FieldRedlineExportContentRole[];
  excludedTransientContent: FieldRedlineExportTransientRole[];
  status: FieldRedlineArtifactStatus;
  artifactFingerprintInputs: FieldRedlineArtifactFingerprintInputs;
  artifactFingerprint: string;
  footer: FieldRedlineFooterModel;
  renderRequest: FieldRedlineCommittedSceneRenderRequest;
};

export type FieldRedlineCanvasSource = {
  width: number;
  height: number;
  toBlob: (
    callback: (blob: Blob | null) => void,
    type?: string,
    quality?: number,
  ) => void;
};

export type FieldRedlineCommittedSceneRenderer = (
  request: Readonly<FieldRedlineCommittedSceneRenderRequest>,
) => FieldRedlineCanvasSource | Promise<FieldRedlineCanvasSource>;

export type FieldRedlineExportArtifact = {
  blob: Blob;
  filename: string;
  mimeType: string;
  artifactFingerprint: string;
  status: FieldRedlineArtifactStatus;
};

export type FieldRedlineDownloadAnchor = {
  href: string;
  download: string;
  rel: string;
  target?: string;
  click: () => void;
  remove?: () => void;
};

export type FieldRedlineDownloadEnvironment = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createAnchor: () => FieldRedlineDownloadAnchor;
  scheduleRelease: (
    release: () => void,
    delayMilliseconds: number,
  ) => void;
};

export type SinglePageJpegPdfInput = {
  jpegBytes: Uint8Array;
  imageWidth: number;
  imageHeight: number;
  pageWidthPoints?: number;
  pageHeightPoints?: number;
  title?: string;
  subject?: string;
  creator?: string;
  createdAt?: string;
};

const FORMAT_MIME_TYPES: Record<FieldRedlineExportFormat, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  pdf: "application/pdf",
};

const FORMAT_EXTENSIONS: Record<FieldRedlineExportFormat, string> = {
  png: "png",
  jpg: "jpg",
  pdf: "pdf",
};

const WINDOWS_RESERVED_FILENAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:[.-]|$)/i;

function finiteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function positiveNumber(value: number, label: string) {
  finiteNumber(value, label);
  if (value <= 0) throw new RangeError(`${label} must be greater than zero`);
  return value;
}

function nonNegativeInteger(value: number, label: string) {
  finiteNumber(value, label);
  if (value < 0 || !Number.isInteger(value)) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
  return value;
}

function boundedText(value: string | undefined | null, fallback = "", maximum = 160) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return fallback;
  return Array.from(normalized).slice(0, maximum).join("");
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalValue(entry)]),
  );
}

export function canonicalFieldRedlineJson(value: unknown) {
  return JSON.stringify(canonicalValue(value));
}

function stableTextHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function normalizeFieldRedlineExportFormat(
  value: FieldRedlineExportFormat | string,
): FieldRedlineExportFormat {
  const normalized = String(value).trim().toLowerCase().replace(/^\./, "");
  if (["png", "image/png"].includes(normalized)) return "png";
  if (["jpg", "jpeg", "image/jpg", "image/jpeg"].includes(normalized)) return "jpg";
  if (["pdf", "application/pdf"].includes(normalized)) return "pdf";
  throw new RangeError("Export format must be PNG, JPG, or PDF");
}

export function fieldRedlineExportMimeType(
  value: FieldRedlineExportFormat | string,
) {
  return FORMAT_MIME_TYPES[normalizeFieldRedlineExportFormat(value)];
}

export function sanitizeFieldRedlineExportFilename(
  value: string,
  requestedFormat: FieldRedlineExportFormat | string,
) {
  const format = normalizeFieldRedlineExportFormat(requestedFormat);
  const extension = FORMAT_EXTENSIONS[format];
  let stem = String(value ?? "")
    .normalize("NFKC")
    .replace(/\.(?:png|jpe?g|pdf)\s*$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/\.+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[\s.-]+|[\s.-]+$/g, "");
  if (!stem) stem = "field-redline";
  if (WINDOWS_RESERVED_FILENAME.test(stem)) stem = `hvac-${stem}`;
  const availableCharacters = Math.max(
    1,
    FIELD_REDLINE_EXPORT_LIMITS.maxFilenameLength - extension.length - 1,
  );
  stem = Array.from(stem).slice(0, availableCharacters).join("")
    .replace(/[\s.-]+$/g, "");
  if (!stem) stem = "field-redline";
  return `${stem}.${extension}`;
}

export function resolveFieldRedlineExportCrop(
  sheet: Pick<FieldRedlineSheet, "width" | "height">,
  scope: FieldRedlineExportScope,
): FieldRedlineResolvedCrop {
  const sheetWidth = positiveNumber(sheet.width, "Sheet width");
  const sheetHeight = positiveNumber(sheet.height, "Sheet height");
  if (scope.kind === "current-sheet") {
    return {
      kind: "current-sheet",
      x: 0,
      y: 0,
      width: sheetWidth,
      height: sheetHeight,
      padding: 0,
    };
  }

  const { selection } = scope;
  const selectionWidth = finiteNumber(selection.width, "Selection width");
  const selectionHeight = finiteNumber(selection.height, "Selection height");
  if (selectionWidth === 0 || selectionHeight === 0) {
    throw new RangeError("Selected area must have a width and height");
  }
  const startX = finiteNumber(selection.x, "Selection x");
  const startY = finiteNumber(selection.y, "Selection y");
  const left = Math.min(startX, startX + selectionWidth);
  const top = Math.min(startY, startY + selectionHeight);
  const right = Math.max(startX, startX + selectionWidth);
  const bottom = Math.max(startY, startY + selectionHeight);
  const padding = scope.padding === undefined
    ? FIELD_REDLINE_EXPORT_LIMITS.selectedAreaPadding
    : finiteNumber(scope.padding, "Crop padding");
  if (padding < 0) throw new RangeError("Crop padding cannot be negative");

  const cropLeft = Math.max(0, Math.floor(left - padding));
  const cropTop = Math.max(0, Math.floor(top - padding));
  const cropRight = Math.min(sheetWidth, Math.ceil(right + padding));
  const cropBottom = Math.min(sheetHeight, Math.ceil(bottom + padding));
  if (cropRight <= cropLeft || cropBottom <= cropTop) {
    throw new RangeError("Selected area must intersect the current sheet");
  }
  return {
    kind: "selected-area",
    x: cropLeft,
    y: cropTop,
    width: cropRight - cropLeft,
    height: cropBottom - cropTop,
    padding,
  };
}

export function resolveFieldRedlineRasterSize(
  crop: Pick<FieldRedlineRect, "width" | "height">,
  preset: FieldRedlineRasterPreset = "standard",
  requestedLongEdge?: number,
): FieldRedlineRasterSize {
  const sourceWidth = positiveNumber(crop.width, "Crop width");
  const sourceHeight = positiveNumber(crop.height, "Crop height");
  if (preset !== "standard" && preset !== "4k") {
    throw new RangeError("Raster preset must be Standard or 4K");
  }
  const defaultLongEdge = preset === "4k"
    ? FIELD_REDLINE_EXPORT_LIMITS.fourKLongEdge
    : FIELD_REDLINE_EXPORT_LIMITS.standardLongEdge;
  const requested = requestedLongEdge === undefined
    ? defaultLongEdge
    : positiveNumber(requestedLongEdge, "Requested long edge");
  const boundedRequest = Math.max(
    1,
    Math.min(FIELD_REDLINE_EXPORT_LIMITS.maxAxis, Math.round(requested)),
  );
  const landscape = sourceWidth >= sourceHeight;
  const ratio = landscape
    ? sourceWidth / sourceHeight
    : sourceHeight / sourceWidth;
  const pixelLimitedLongEdge = Math.floor(
    Math.sqrt(FIELD_REDLINE_EXPORT_LIMITS.maxPixels * ratio),
  );
  const actualLongEdge = Math.max(
    1,
    Math.min(boundedRequest, FIELD_REDLINE_EXPORT_LIMITS.maxAxis, pixelLimitedLongEdge),
  );
  let width = landscape
    ? actualLongEdge
    : Math.max(1, Math.round(actualLongEdge / ratio));
  let height = landscape
    ? Math.max(1, Math.round(actualLongEdge / ratio))
    : actualLongEdge;

  if (width * height > FIELD_REDLINE_EXPORT_LIMITS.maxPixels) {
    if (landscape) {
      height = Math.max(
        1,
        Math.floor(FIELD_REDLINE_EXPORT_LIMITS.maxPixels / width),
      );
    } else {
      width = Math.max(
        1,
        Math.floor(FIELD_REDLINE_EXPORT_LIMITS.maxPixels / height),
      );
    }
  }

  return {
    width,
    height,
    requestedLongEdge: Math.round(requested),
    actualLongEdge: Math.max(width, height),
    pixelCount: width * height,
    preset,
  };
}

export function normalizeFieldRedlineExportContent(
  requested?: readonly (FieldRedlineExportContentRole | string)[],
) {
  if (!requested) return [...FIELD_REDLINE_EXPORT_CONTENT_ALLOWLIST];
  const selected = new Set(requested);
  const normalized = FIELD_REDLINE_EXPORT_CONTENT_ALLOWLIST.filter(
    (role) => selected.has(role),
  );
  if (!normalized.length) {
    throw new RangeError("Export must include at least one committed content role");
  }
  return [...normalized];
}

export function resolveFieldRedlineArtifactStatus(input: {
  hvacRelease: FieldRedlineReleaseState;
  redlines: FieldRedlineReviewState;
}): FieldRedlineArtifactStatus {
  const visibleCount = nonNegativeInteger(
    input.redlines.visibleCount,
    "Visible redline count",
  );
  const fingerprint = boundedText(input.redlines.fingerprint, "");
  const reviewedFingerprint = boundedText(
    input.redlines.reviewedFingerprint,
    "",
  );
  const reasons: FieldRedlineArtifactStatusReason[] = [];
  if (!input.hvacRelease.current) reasons.push("hvac-release-not-current");

  let redlineReview: FieldRedlineArtifactStatus["redlineReview"] = "not-visible";
  if (visibleCount > 0 && !reviewedFingerprint) {
    redlineReview = "unreviewed";
    reasons.push("visible-redlines-unreviewed");
  } else if (visibleCount > 0 && fingerprint !== reviewedFingerprint) {
    redlineReview = "changed";
    reasons.push("visible-redlines-changed");
  } else if (visibleCount > 0) {
    redlineReview = "current";
  }

  const artifactState: FieldRedlineArtifactState = reasons.length
    ? "draft"
    : "current";
  const label = artifactState === "current"
    ? "CURRENT"
    : reasons.includes("visible-redlines-changed")
      ? "DRAFT · FIELD REDLINES CHANGED"
      : reasons.includes("visible-redlines-unreviewed")
        ? "DRAFT · FIELD REDLINES NEED REVIEW"
        : "DRAFT · HVAC RELEASE NOT CURRENT";
  const revision = boundedText(input.hvacRelease.revision, "");
  return {
    artifactState,
    label,
    reasons,
    hvacReleaseCurrent: input.hvacRelease.current,
    hvacReleaseLabel: input.hvacRelease.current
      ? `Current${revision ? ` · ${revision}` : ""}`
      : `Not current${revision ? ` · ${revision}` : ""}`,
    redlineReview,
    redlinesChanged: redlineReview === "unreviewed" || redlineReview === "changed",
  };
}

export function fieldRedlineArtifactFingerprint(
  inputs: FieldRedlineArtifactFingerprintInputs,
) {
  return `fre-v133-${stableTextHash(canonicalFieldRedlineJson(inputs))}`;
}

export function buildFieldRedlineFooterModel(input: {
  projectName: string;
  sheetLabel: string;
  systemName: string;
  revision?: string;
  reviewer?: string;
  exportedAt: string;
  artifactFingerprint: string;
  status: FieldRedlineArtifactStatus;
}): FieldRedlineFooterModel {
  const projectName = boundedText(input.projectName, "Untitled HVAC Project");
  const sheetLabel = boundedText(input.sheetLabel, "Current sheet");
  const systemName = boundedText(input.systemName, "Current system");
  const revision = boundedText(input.revision, "Working");
  const reviewer = boundedText(input.reviewer, "");
  const exportedAt = boundedText(input.exportedAt, "Unknown");
  const redlineReviewLabels: Record<
    FieldRedlineArtifactStatus["redlineReview"],
    string
  > = {
    "not-visible": "No visible field redlines",
    current: "Reviewed and current",
    unreviewed: "Review required",
    changed: "Changed after review",
  };
  const fields: FieldRedlineFooterField[] = [
    { key: "project", label: "Project", value: projectName },
    { key: "sheet", label: "Sheet", value: sheetLabel },
    { key: "system", label: "System", value: systemName },
    { key: "revision", label: "Revision", value: revision },
    {
      key: "hvac-release",
      label: "HVAC release",
      value: input.status.hvacReleaseLabel,
    },
    {
      key: "redline-review",
      label: "Field redlines",
      value: redlineReviewLabels[input.status.redlineReview],
    },
    {
      key: "exported",
      label: reviewer ? `Exported · ${reviewer}` : "Exported",
      value: exportedAt,
    },
    {
      key: "artifact",
      label: "Artifact",
      value: boundedText(input.artifactFingerprint, "Unknown", 80),
    },
  ];
  return {
    featureLabel: "Field Redline",
    artifactState: input.status.artifactState,
    statusStamp: input.status.label,
    title: `${projectName} · ${sheetLabel}`,
    fields,
    approvalNotice: FIELD_REDLINE_APPROVAL_NOTICE,
    notice: input.status.redlinesChanged && input.status.hvacReleaseCurrent
      ? "Field redline changes make this artifact a draft; the issued HVAC release remains current."
      : "Field redlines communicate coordination notes and do not modify HVAC design or release.",
  };
}

function normalizeSheet(sheet: FieldRedlineSheet): FieldRedlineSheet {
  const page = positiveNumber(sheet.page, "Sheet page");
  if (!Number.isInteger(page)) throw new RangeError("Sheet page must be an integer");
  return {
    id: boundedText(sheet.id, `page-${page}`, 120),
    page,
    label: boundedText(sheet.label, `Page ${page}`, 120),
    width: positiveNumber(sheet.width, "Sheet width"),
    height: positiveNumber(sheet.height, "Sheet height"),
  };
}

function normalizedExportedAt(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new RangeError("Exported time must be a valid date");
  }
  return parsed.toISOString();
}

export function buildFieldRedlineExportPlan(
  input: BuildFieldRedlineExportPlanInput,
): FieldRedlineExportPlan {
  const sheet = normalizeSheet(input.sheet);
  const format = normalizeFieldRedlineExportFormat(input.format);
  const crop = resolveFieldRedlineExportCrop(sheet, input.scope);
  const preset = input.preset ?? "standard";
  const raster = resolveFieldRedlineRasterSize(
    crop,
    preset,
    input.requestedLongEdge,
  );
  const includedContent = normalizeFieldRedlineExportContent(
    input.includedContent,
  );
  const excludedTransientContent = [
    ...FIELD_REDLINE_EXPORT_TRANSIENT_EXCLUSIONS,
  ];
  const status = resolveFieldRedlineArtifactStatus({
    hvacRelease: input.hvacRelease,
    redlines: input.redlines,
  });
  const exportedAt = normalizedExportedAt(input.exportedAt);
  const artifactFingerprintInputs: FieldRedlineArtifactFingerprintInputs = {
    version: FIELD_REDLINE_EXPORT_VERSION,
    sourceFingerprint: boundedText(input.sourceFingerprint, "missing", 240),
    committedSceneFingerprint: boundedText(
      input.committedSceneFingerprint,
      "missing",
      240,
    ),
    sheet: {
      id: sheet.id,
      page: sheet.page,
      label: sheet.label,
    },
    scope: {
      kind: input.scope.kind,
      crop,
    },
    raster,
    format,
    includedContent,
    excludedTransientContent,
    hvacRelease: {
      current: input.hvacRelease.current,
      revision: boundedText(input.hvacRelease.revision, ""),
      fingerprint: boundedText(input.hvacRelease.fingerprint, ""),
    },
    redlines: {
      visibleCount: input.redlines.visibleCount,
      fingerprint: boundedText(input.redlines.fingerprint, ""),
      reviewedFingerprint: boundedText(
        input.redlines.reviewedFingerprint,
        "",
      ),
    },
    artifactStatus: {
      state: status.artifactState,
      reasons: [...status.reasons],
    },
    metadata: {
      projectName: boundedText(input.projectName, "Untitled HVAC Project"),
      systemName: boundedText(input.systemName, "Current system"),
      reviewer: boundedText(input.reviewer, ""),
      exportedAt,
    },
  };
  const artifactFingerprint = fieldRedlineArtifactFingerprint(
    artifactFingerprintInputs,
  );
  const footer = buildFieldRedlineFooterModel({
    projectName: input.projectName,
    sheetLabel: sheet.label,
    systemName: input.systemName,
    revision: input.hvacRelease.revision,
    reviewer: input.reviewer,
    exportedAt,
    artifactFingerprint,
    status,
  });
  const renderRequest: FieldRedlineCommittedSceneRenderRequest = {
    version: FIELD_REDLINE_EXPORT_VERSION,
    artifactFingerprint,
    sheet,
    scope: input.scope.kind,
    crop,
    pixelSize: {
      width: raster.width,
      height: raster.height,
    },
    includedContent,
    excludedTransientContent,
    footer,
  };
  return {
    version: FIELD_REDLINE_EXPORT_VERSION,
    sheet,
    scope: input.scope.kind,
    crop,
    raster,
    format,
    mimeType: FORMAT_MIME_TYPES[format],
    filename: sanitizeFieldRedlineExportFilename(input.filename, format),
    includedContent,
    excludedTransientContent,
    status,
    artifactFingerprintInputs,
    artifactFingerprint,
    footer,
    renderRequest,
  };
}

export function canvasToFieldRedlineRasterBlob(
  canvas: FieldRedlineCanvasSource,
  requestedFormat: "png" | "jpg" | "jpeg",
  jpegQuality = FIELD_REDLINE_EXPORT_LIMITS.jpegQuality,
) {
  const format = normalizeFieldRedlineExportFormat(requestedFormat);
  if (format === "pdf") {
    throw new RangeError("Canvas raster encoding supports PNG or JPG only");
  }
  if (format === "jpg" && (
    !Number.isFinite(jpegQuality) ||
    jpegQuality < 0 ||
    jpegQuality > 1
  )) {
    throw new RangeError("JPEG quality must be between zero and one");
  }
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error(`Canvas could not encode ${format.toUpperCase()}`));
        },
        FORMAT_MIME_TYPES[format],
        format === "jpg" ? jpegQuality : undefined,
      );
    } catch (error) {
      reject(error);
    }
  });
}

function asciiBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x7f) throw new RangeError("PDF structure must contain ASCII only");
    bytes[index] = code;
  }
  return bytes;
}

function concatenateBytes(chunks: readonly Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function pdfLiteralString(value: string) {
  const normalized = boundedText(value, "", 240);
  if ([...normalized].every((character) => character.charCodeAt(0) <= 0x7f)) {
    return `(${normalized
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")})`;
  }
  const utf16Bytes = [0xfe, 0xff];
  for (const character of normalized) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0xffff) {
      utf16Bytes.push(codePoint >> 8, codePoint & 0xff);
    } else {
      const adjusted = codePoint - 0x10000;
      const high = 0xd800 + (adjusted >> 10);
      const low = 0xdc00 + (adjusted & 0x3ff);
      utf16Bytes.push(high >> 8, high & 0xff, low >> 8, low & 0xff);
    }
  }
  return `<${utf16Bytes
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}>`;
}

function pdfNumber(value: number, label: string) {
  positiveNumber(value, label);
  return Number(value.toFixed(3)).toString();
}

function pdfCreationDate(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError("PDF creation time must be a valid date");
  }
  const iso = date.toISOString();
  return `D:${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}` +
    `${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

export function resolveFieldRedlinePdfPageSize(input: {
  width: number;
  height: number;
}) {
  const width = positiveNumber(input.width, "Raster width");
  const height = positiveNumber(input.height, "Raster height");
  const landscape = width >= height;
  const maximumWidth = landscape ? 17 * 72 : 11 * 72;
  const maximumHeight = landscape ? 11 * 72 : 17 * 72;
  const scale = Math.min(maximumWidth / width, maximumHeight / height);
  return {
    widthPoints: Number((width * scale).toFixed(3)),
    heightPoints: Number((height * scale).toFixed(3)),
  };
}

/**
 * Builds a real, dependency-free, one-page PDF around a canvas-produced JPEG.
 * The caller's committed renderer must burn the supplied footer and status
 * stamp into that canvas before this function is called.
 */
export function buildSinglePageJpegPdf(
  input: SinglePageJpegPdfInput,
) {
  if (
    input.jpegBytes.length < 4 ||
    input.jpegBytes[0] !== 0xff ||
    input.jpegBytes[1] !== 0xd8 ||
    input.jpegBytes.at(-2) !== 0xff ||
    input.jpegBytes.at(-1) !== 0xd9
  ) {
    throw new RangeError("PDF image must be a complete JPEG");
  }
  const imageWidth = positiveNumber(input.imageWidth, "JPEG width");
  const imageHeight = positiveNumber(input.imageHeight, "JPEG height");
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight)) {
    throw new RangeError("JPEG dimensions must be integers");
  }
  if (
    imageWidth > FIELD_REDLINE_EXPORT_LIMITS.maxAxis ||
    imageHeight > FIELD_REDLINE_EXPORT_LIMITS.maxAxis ||
    imageWidth * imageHeight > FIELD_REDLINE_EXPORT_LIMITS.maxPixels
  ) {
    throw new RangeError("JPEG dimensions exceed the controlled export limits");
  }
  const resolvedPage = resolveFieldRedlinePdfPageSize({
    width: imageWidth,
    height: imageHeight,
  });
  const pageWidth = input.pageWidthPoints ?? resolvedPage.widthPoints;
  const pageHeight = input.pageHeightPoints ?? resolvedPage.heightPoints;
  const pageWidthText = pdfNumber(pageWidth, "PDF page width");
  const pageHeightText = pdfNumber(pageHeight, "PDF page height");
  const contentStream = asciiBytes(
    `q\n${pageWidthText} 0 0 ${pageHeightText} 0 0 cm\n/Im0 Do\nQ\n`,
  );
  const createdAt = pdfCreationDate(input.createdAt);
  const infoEntries = [
    `/Producer ${pdfLiteralString("HVAC Plan Studio")}`,
    `/Creator ${pdfLiteralString(input.creator || "HVAC Plan Studio Field Redline")}`,
    `/Title ${pdfLiteralString(input.title || "Field Redline export")}`,
    `/Subject ${pdfLiteralString(
      input.subject || "Committed HVAC scene with visible export footer",
    )}`,
    ...(createdAt ? [`/CreationDate ${pdfLiteralString(createdAt)}`] : []),
  ].join("\n");
  const objectBodies: Uint8Array[][] = [
    [asciiBytes("<< /Type /Catalog /Pages 2 0 R >>")],
    [asciiBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")],
    [asciiBytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthText} ` +
      `${pageHeightText}] /Resources << /XObject << /Im0 4 0 R >> >> ` +
      "/Contents 5 0 R >>",
    )],
    [
      asciiBytes(
        `<< /Type /XObject /Subtype /Image /Width ${imageWidth} ` +
        `/Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
        `/Filter /DCTDecode /Interpolate true /Length ${input.jpegBytes.length} >>\nstream\n`,
      ),
      input.jpegBytes,
      asciiBytes("\nendstream"),
    ],
    [
      asciiBytes(`<< /Length ${contentStream.length} >>\nstream\n`),
      contentStream,
      asciiBytes("endstream"),
    ],
    [asciiBytes(`<<\n${infoEntries}\n>>`)],
  ];

  const chunks: Uint8Array[] = [
    asciiBytes("%PDF-1.4\n"),
    new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]),
  ];
  let byteLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const offsets = [0];
  objectBodies.forEach((body, index) => {
    offsets.push(byteLength);
    const objectStart = asciiBytes(`${index + 1} 0 obj\n`);
    const objectEnd = asciiBytes("\nendobj\n");
    chunks.push(objectStart, ...body, objectEnd);
    byteLength += objectStart.length +
      body.reduce((total, chunk) => total + chunk.length, 0) +
      objectEnd.length;
  });
  const xrefOffset = byteLength;
  const xref = [
    `xref\n0 ${objectBodies.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map(
      (offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`,
    ),
    `trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R /Info 6 0 R >>\n`,
    `startxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");
  chunks.push(asciiBytes(xref));
  return concatenateBytes(chunks);
}

function blobFromBytes(bytes: Uint8Array, type: string) {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

export async function canvasToFieldRedlinePdfBlob(
  canvas: FieldRedlineCanvasSource,
  input: Omit<SinglePageJpegPdfInput, "jpegBytes" | "imageWidth" | "imageHeight"> = {},
) {
  const jpegBlob = await canvasToFieldRedlineRasterBlob(
    canvas,
    "jpg",
    FIELD_REDLINE_EXPORT_LIMITS.jpegQuality,
  );
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdfBytes = buildSinglePageJpegPdf({
    ...input,
    jpegBytes,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
  });
  return blobFromBytes(pdfBytes, FORMAT_MIME_TYPES.pdf);
}

export async function renderFieldRedlineExportArtifact(
  plan: FieldRedlineExportPlan,
  renderCommittedScene: FieldRedlineCommittedSceneRenderer,
): Promise<FieldRedlineExportArtifact> {
  const canvas = await renderCommittedScene(plan.renderRequest);
  if (
    canvas.width !== plan.raster.width ||
    canvas.height !== plan.raster.height
  ) {
    throw new RangeError(
      `Committed renderer returned ${canvas.width}×${canvas.height}; ` +
      `expected ${plan.raster.width}×${plan.raster.height}`,
    );
  }
  const blob = plan.format === "pdf"
    ? await canvasToFieldRedlinePdfBlob(canvas, {
      title: `${plan.footer.title} · ${plan.footer.statusStamp}`,
      subject: plan.footer.notice,
      creator: "HVAC Plan Studio Field Redline",
      createdAt: plan.artifactFingerprintInputs.metadata.exportedAt,
    })
    : await canvasToFieldRedlineRasterBlob(canvas, plan.format);
  return {
    blob,
    filename: plan.filename,
    mimeType: plan.mimeType,
    artifactFingerprint: plan.artifactFingerprint,
    status: plan.status,
  };
}

function browserDownloadEnvironment(): FieldRedlineDownloadEnvironment {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error("Downloads require a browser environment");
  }
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAnchor: () => {
      const anchor = document.createElement("a");
      anchor.style.display = "none";
      document.body.append(anchor);
      return anchor;
    },
    scheduleRelease: (release, delayMilliseconds) =>
      window.setTimeout(release, delayMilliseconds),
  };
}

export function downloadFieldRedlineExportArtifact(
  artifact: Pick<FieldRedlineExportArtifact, "blob" | "filename">,
  environment: FieldRedlineDownloadEnvironment = browserDownloadEnvironment(),
) {
  const objectUrl = environment.createObjectURL(artifact.blob);
  const isPdf = artifact.blob.type === FORMAT_MIME_TYPES.pdf;
  const releaseDelay = isPdf
    ? FIELD_REDLINE_PDF_DOWNLOAD_RELEASE_DELAY_MS
    : FIELD_REDLINE_DOWNLOAD_RELEASE_DELAY_MS;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    environment.revokeObjectURL(objectUrl);
  };
  let anchor: FieldRedlineDownloadAnchor | undefined;
  try {
    anchor = environment.createAnchor();
    anchor.href = objectUrl;
    anchor.download = artifact.filename;
    anchor.rel = "noopener";
    if (isPdf) anchor.target = "_blank";
    anchor.click();
    const anchorToRemove = anchor;
    let cleanupFinished = false;
    environment.scheduleRelease(() => {
      if (cleanupFinished) return;
      cleanupFinished = true;
      release();
      anchorToRemove.remove?.();
    }, releaseDelay);
    anchor = undefined;
  } catch (error) {
    release();
    anchor?.remove?.();
    throw error;
  }
}
