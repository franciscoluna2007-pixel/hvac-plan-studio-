export const REDLINE_DOCUMENT_SCHEMA = "field-redline-v133.0" as const;
export const REDLINE_SNAPSHOT_VERSION = 1 as const;
export const REDLINE_DEFAULT_LAYER_ID = "field-redlines";

export const REDLINE_POLICY_LIMITS = Object.freeze({
  maxSnapshotBytes: 8 * 1024 * 1024,
  maxPages: 2_000,
  maxLayers: 32,
  maxAnnotations: 5_000,
  maxGroups: 1_000,
  maxFavorites: 4,
  maxMyDetails: 100,
  maxAnnotationsPerDetail: 64,
  maxPointsPerStroke: 2_048,
  maxTextLength: 2_000,
  maxNameLength: 80,
  maxSourceFingerprintLength: 256,
  minStrokeWidth: 0.00025,
  maxStrokeWidth: 0.08,
});

export const REDLINE_ANNOTATION_KINDS = [
  "ink",
  "highlighter",
  "arrow",
  "rectangle",
  "circle",
  "cloud",
  "text",
] as const;

export const REDLINE_CALLOUT_KINDS = [
  "arrow",
  "rectangle",
  "circle",
  "cloud",
  "text",
] as const;

export type RedlineAnnotationKind = typeof REDLINE_ANNOTATION_KINDS[number];
export type RedlineStrokeKind = "ink" | "highlighter";
export type RedlineCalloutKind = typeof REDLINE_CALLOUT_KINDS[number];

export type RedlinePoint = {
  x: number;
  y: number;
};

export type RedlineStrokePoint = RedlinePoint & {
  pressure?: number;
  t?: number;
};

export type RedlinePageBinding = {
  sourceFingerprint: string;
  page: number;
};

export type RedlineDocumentBinding = {
  sourceFingerprint: string;
  pageCount: number;
};

export type RedlineStyle = {
  color: string;
  strokeWidth: number;
  opacity: number;
  fillColor?: string;
  textScale?: number;
};

type RedlineAnnotationBase = {
  id: string;
  layerId: string;
  binding: RedlinePageBinding;
  style: RedlineStyle;
};

export type RedlineStrokeAnnotation = RedlineAnnotationBase & {
  kind: RedlineStrokeKind;
  points: RedlineStrokePoint[];
};

export type RedlineCalloutAnnotation = RedlineAnnotationBase & {
  kind: RedlineCalloutKind;
  start: RedlinePoint;
  end: RedlinePoint;
  text?: string;
};

export type RedlineAnnotation =
  | RedlineStrokeAnnotation
  | RedlineCalloutAnnotation;

export function isRedlineStrokeAnnotation(
  annotation: RedlineAnnotation,
): annotation is RedlineStrokeAnnotation {
  return annotation.kind === "ink" || annotation.kind === "highlighter";
}

export type RedlineLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
};

export type RedlineGroup = {
  id: string;
  name?: string;
  annotationIds: string[];
};

export type RedlineFavorite = {
  id: string;
  label: string;
  kind: RedlineAnnotationKind;
  style: RedlineStyle;
};

type RedlineTemplateBase = {
  localId: string;
  style: RedlineStyle;
};

export type RedlineStrokeTemplate = RedlineTemplateBase & {
  kind: RedlineStrokeKind;
  points: RedlineStrokePoint[];
};

export type RedlineCalloutTemplate = RedlineTemplateBase & {
  kind: RedlineCalloutKind;
  start: RedlinePoint;
  end: RedlinePoint;
  text?: string;
};

export type RedlineTemplateAnnotation =
  | RedlineStrokeTemplate
  | RedlineCalloutTemplate;

function isRedlineStrokeTemplate(
  annotation: RedlineTemplateAnnotation,
): annotation is RedlineStrokeTemplate {
  return annotation.kind === "ink" || annotation.kind === "highlighter";
}

export type RedlineTemplateGroup = {
  localId: string;
  annotationLocalIds: string[];
};

export type RedlineMyDetail = {
  id: string;
  name: string;
  defaultExtent: {
    width: number;
    height: number;
  };
  annotations: RedlineTemplateAnnotation[];
  groups: RedlineTemplateGroup[];
};

export type RedlineDocument = {
  schema: typeof REDLINE_DOCUMENT_SCHEMA;
  id: string;
  title?: string;
  binding: RedlineDocumentBinding;
  layers: RedlineLayer[];
  annotations: RedlineAnnotation[];
  groups: RedlineGroup[];
  favorites: RedlineFavorite[];
  myDetails: RedlineMyDetail[];
  nextSequence: number;
};

export type RedlineSnapshotV1 = {
  version: typeof REDLINE_SNAPSHOT_VERSION;
  schema: typeof REDLINE_DOCUMENT_SCHEMA;
  fingerprint: string;
  savedAt?: string;
  document: RedlineDocument;
};

export type RedlineSanitizeIssue = {
  path: string;
  message: string;
};

export type RedlineDocumentSanitizeResult =
  | {
    ok: true;
    document: RedlineDocument;
    issues: RedlineSanitizeIssue[];
  }
  | {
    ok: false;
    reason: string;
    issues: RedlineSanitizeIssue[];
  };

export type RedlineSnapshotParseResult =
  | {
    status: "ready";
    document: RedlineDocument;
    fingerprint: string;
    sanitized: boolean;
    issues: RedlineSanitizeIssue[];
  }
  | {
    status: "quarantined";
    reason: string;
    issues: RedlineSanitizeIssue[];
  };

export type RedlineBounds = {
  binding: RedlinePageBinding;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type RedlineAlignment =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

export type RedlineDistribution = "horizontal" | "vertical";

export type RedlineStrokeDraft = {
  kind: RedlineStrokeKind;
  page: number;
  layerId?: string;
  style?: Partial<RedlineStyle>;
  points: RedlineStrokePoint[];
};

export type RedlineCalloutDraft = {
  kind: RedlineCalloutKind;
  page: number;
  layerId?: string;
  style?: Partial<RedlineStyle>;
  start: RedlinePoint;
  end: RedlinePoint;
  text?: string;
};

export type RedlineAnnotationDraft =
  | RedlineStrokeDraft
  | RedlineCalloutDraft;

function isRedlineStrokeDraft(
  draft: RedlineAnnotationDraft,
): draft is RedlineStrokeDraft {
  return draft.kind === "ink" || draft.kind === "highlighter";
}

export type RedlineOperationResult = {
  document: RedlineDocument;
  selection: string[];
  changed: boolean;
  reason: string;
  createdIds: string[];
};

export type RedlineCommand =
  | { type: "add-annotation"; draft: RedlineAnnotationDraft }
  | { type: "replace-annotation"; annotation: RedlineAnnotation }
  | {
    type: "move-selection";
    annotationIds: string[];
    delta: RedlinePoint;
  }
  | {
    type: "align-selection";
    annotationIds: string[];
    alignment: RedlineAlignment;
  }
  | {
    type: "distribute-selection";
    annotationIds: string[];
    direction: RedlineDistribution;
  }
  | {
    type: "rotate-selection";
    annotationIds: string[];
    degrees: number;
    pageAspectRatio?: number;
  }
  | {
    type: "scale-selection";
    annotationIds: string[];
    factor: number;
  }
  | {
    type: "update-selection-style";
    annotationIds: string[];
    changes: Partial<RedlineStyle>;
  }
  | {
    type: "group-selection";
    annotationIds: string[];
    name?: string;
  }
  | { type: "ungroup-selection"; annotationIds: string[] }
  | {
    type: "duplicate-selection";
    annotationIds: string[];
    offset?: RedlinePoint;
  }
  | { type: "delete-selection"; annotationIds: string[] }
  | {
    type: "save-detail";
    annotationIds: string[];
    name: string;
  }
  | {
    type: "place-detail";
    detailId: string;
    binding: RedlinePageBinding;
    origin: RedlinePoint;
    extent?: { width: number; height: number };
    targetLayerId?: string;
  }
  | { type: "add-layer"; name: string }
  | {
    type: "update-layer";
    layerId: string;
    changes: Partial<Pick<RedlineLayer, "name" | "visible" | "locked" | "opacity" | "order">>;
  }
  | { type: "remove-layer"; layerId: string }
  | { type: "upsert-favorite"; favorite: RedlineFavorite }
  | { type: "remove-favorite"; favoriteId: string };

type UnknownRecord = Record<string, unknown>;

const FORBIDDEN_ENGINEERING_KEYS = new Set([
  "airflow",
  "cfm",
  "connection",
  "connections",
  "connectionid",
  "connectedto",
  "ductid",
  "equipmentid",
  "runid",
  "size",
  "systemid",
]);

const KIND_SET = new Set<string>(REDLINE_ANNOTATION_KINDS);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SAFE_COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maximum);
}

function cleanId(value: unknown) {
  const id = cleanText(value, REDLINE_POLICY_LIMITS.maxNameLength);
  return SAFE_ID.test(id) ? id : "";
}

function cleanSourceFingerprint(value: unknown) {
  return cleanText(value, REDLINE_POLICY_LIMITS.maxSourceFingerprintLength);
}

function safeColor(value: unknown, fallback: string) {
  return typeof value === "string" && SAFE_COLOR.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
}

function defaultStyle(kind: RedlineAnnotationKind): RedlineStyle {
  if (kind === "highlighter") {
    return {
      color: "#facc15",
      strokeWidth: 0.014,
      opacity: 0.35,
    };
  }
  if (kind === "ink") {
    return {
      color: "#1d4ed8",
      strokeWidth: 0.002,
      opacity: 1,
    };
  }
  return {
    color: "#dc2626",
    strokeWidth: 0.002,
    opacity: 1,
    ...(kind === "text" ? { textScale: 1 } : {}),
  };
}

export function normalizeRedlineStyle(
  kind: RedlineAnnotationKind,
  value: unknown,
): RedlineStyle {
  const fallback = defaultStyle(kind);
  const record = isRecord(value) ? value : {};
  const width = finiteNumber(record.strokeWidth);
  const opacity = finiteNumber(record.opacity);
  const textScale = finiteNumber(record.textScale);
  const fillColor = typeof record.fillColor === "string" &&
    SAFE_COLOR.test(record.fillColor.trim())
    ? record.fillColor.trim().toLowerCase()
    : undefined;
  return {
    color: safeColor(record.color, fallback.color),
    strokeWidth: clamp(
      width ?? fallback.strokeWidth,
      REDLINE_POLICY_LIMITS.minStrokeWidth,
      REDLINE_POLICY_LIMITS.maxStrokeWidth,
    ),
    opacity: clamp(opacity ?? fallback.opacity),
    ...(fillColor ? { fillColor } : {}),
    ...(kind === "text"
      ? { textScale: clamp(textScale ?? fallback.textScale ?? 1, 0.5, 4) }
      : {}),
  };
}

function engineeringFieldPath(value: unknown): string | null {
  const seen = new Set<object>();
  const visit = (current: unknown, path: string): string | null => {
    if (!current || typeof current !== "object") return null;
    if (seen.has(current as object)) return null;
    seen.add(current as object);
    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) {
        const found = visit(current[index], `${path}[${index}]`);
        if (found) return found;
      }
      return null;
    }
    for (const [key, child] of Object.entries(current as UnknownRecord)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (FORBIDDEN_ENGINEERING_KEYS.has(normalizedKey)) {
        return `${path}.${key}`;
      }
      const found = visit(child, `${path}.${key}`);
      if (found) return found;
    }
    return null;
  };
  return visit(value, "$");
}

function normalizedPoint(
  value: unknown,
  path: string,
  issues: RedlineSanitizeIssue[],
): RedlinePoint | null {
  if (!isRecord(value)) return null;
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  if (x == null || y == null) return null;
  const point = { x: clamp(x), y: clamp(y) };
  if (point.x !== x || point.y !== y) {
    issues.push({
      path,
      message: "Coordinate was clamped to the normalized PDF page.",
    });
  }
  return point;
}

function normalizedStrokePoint(
  value: unknown,
  path: string,
  issues: RedlineSanitizeIssue[],
): RedlineStrokePoint | null {
  const point = normalizedPoint(value, path, issues);
  if (!point || !isRecord(value)) return null;
  const pressure = finiteNumber(value.pressure);
  const t = finiteNumber(value.t);
  return {
    ...point,
    ...(pressure == null ? {} : { pressure: clamp(pressure) }),
    ...(t == null ? {} : { t: Math.max(0, t) }),
  };
}

function bindingFromUnknown(
  value: unknown,
  documentBinding: RedlineDocumentBinding,
): RedlinePageBinding | null {
  if (!isRecord(value)) return null;
  const sourceFingerprint = cleanSourceFingerprint(value.sourceFingerprint);
  const page = finiteNumber(value.page);
  if (
    sourceFingerprint !== documentBinding.sourceFingerprint ||
    page == null ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > documentBinding.pageCount
  ) {
    return null;
  }
  return { sourceFingerprint, page };
}

function annotationFromUnknown(
  value: unknown,
  documentBinding: RedlineDocumentBinding,
  layerIds: Set<string>,
  path: string,
  issues: RedlineSanitizeIssue[],
): RedlineAnnotation | null {
  if (!isRecord(value)) return null;
  const id = cleanId(value.id);
  const layerId = cleanId(value.layerId);
  const kind = typeof value.kind === "string" && KIND_SET.has(value.kind)
    ? value.kind as RedlineAnnotationKind
    : null;
  const binding = bindingFromUnknown(value.binding, documentBinding);
  if (!id || !layerIds.has(layerId) || !kind || !binding) return null;
  const style = normalizeRedlineStyle(kind, value.style);
  if (kind === "ink" || kind === "highlighter") {
    if (!Array.isArray(value.points)) return null;
    const points = value.points
      .slice(0, REDLINE_POLICY_LIMITS.maxPointsPerStroke)
      .map((point, index) =>
        normalizedStrokePoint(point, `${path}.points[${index}]`, issues))
      .filter((point): point is RedlineStrokePoint => Boolean(point));
    if (value.points.length > REDLINE_POLICY_LIMITS.maxPointsPerStroke) {
      issues.push({
        path: `${path}.points`,
        message: "Stroke point count was capped by policy.",
      });
    }
    if (!points.length) return null;
    return { id, kind, layerId, binding, style, points };
  }
  const start = normalizedPoint(value.start, `${path}.start`, issues);
  const end = normalizedPoint(value.end, `${path}.end`, issues);
  if (!start || !end) return null;
  const text = cleanText(value.text, REDLINE_POLICY_LIMITS.maxTextLength);
  if (kind === "text" && !text) return null;
  return {
    id,
    kind,
    layerId,
    binding,
    style,
    start,
    end,
    ...(text ? { text } : {}),
  };
}

function templateAnnotationFromUnknown(
  value: unknown,
  path: string,
  issues: RedlineSanitizeIssue[],
): RedlineTemplateAnnotation | null {
  if (!isRecord(value)) return null;
  const localId = cleanId(value.localId);
  const kind = typeof value.kind === "string" && KIND_SET.has(value.kind)
    ? value.kind as RedlineAnnotationKind
    : null;
  if (!localId || !kind) return null;
  const style = normalizeRedlineStyle(kind, value.style);
  if (kind === "ink" || kind === "highlighter") {
    if (!Array.isArray(value.points)) return null;
    const points = value.points
      .slice(0, REDLINE_POLICY_LIMITS.maxPointsPerStroke)
      .map((point, index) =>
        normalizedStrokePoint(point, `${path}.points[${index}]`, issues))
      .filter((point): point is RedlineStrokePoint => Boolean(point));
    if (!points.length) return null;
    return { localId, kind, style, points };
  }
  const start = normalizedPoint(value.start, `${path}.start`, issues);
  const end = normalizedPoint(value.end, `${path}.end`, issues);
  if (!start || !end) return null;
  const text = cleanText(value.text, REDLINE_POLICY_LIMITS.maxTextLength);
  if (kind === "text" && !text) return null;
  return {
    localId,
    kind,
    style,
    start,
    end,
    ...(text ? { text } : {}),
  };
}

function exactPageBinding(
  left: RedlinePageBinding,
  right: RedlinePageBinding,
) {
  return (
    left.sourceFingerprint === right.sourceFingerprint &&
    left.page === right.page
  );
}

function uniqueExistingIds(ids: readonly string[], existing: Set<string>) {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (!existing.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function createRedlineDocument(input: {
  sourceFingerprint: string;
  pageCount: number;
  id?: string;
  title?: string;
}): RedlineDocument {
  const sourceFingerprint = cleanSourceFingerprint(input.sourceFingerprint);
  if (!sourceFingerprint) {
    throw new Error("Field Redline Studio requires a PDF fingerprint.");
  }
  if (
    !Number.isInteger(input.pageCount) ||
    input.pageCount < 1 ||
    input.pageCount > REDLINE_POLICY_LIMITS.maxPages
  ) {
    throw new Error("Field Redline Studio requires a valid PDF page count.");
  }
  const requestedId = cleanId(input.id);
  const title = cleanText(input.title, REDLINE_POLICY_LIMITS.maxNameLength);
  return {
    schema: REDLINE_DOCUMENT_SCHEMA,
    id: requestedId || `redline-${stableHash(sourceFingerprint)}`,
    ...(title ? { title } : {}),
    binding: {
      sourceFingerprint,
      pageCount: input.pageCount,
    },
    layers: [{
      id: REDLINE_DEFAULT_LAYER_ID,
      name: "Field Redlines",
      visible: true,
      locked: false,
      opacity: 1,
      order: 0,
    }],
    annotations: [],
    groups: [],
    favorites: [],
    myDetails: [],
    nextSequence: 1,
  };
}

export function sanitizeRedlineDocument(
  value: unknown,
  expected?: Partial<RedlineDocumentBinding>,
): RedlineDocumentSanitizeResult {
  const issues: RedlineSanitizeIssue[] = [];
  if (!isRecord(value) || value.schema !== REDLINE_DOCUMENT_SCHEMA) {
    return {
      ok: false,
      reason: "This is not a Field Redline Studio V133 document.",
      issues,
    };
  }
  const unsafePath = engineeringFieldPath(value);
  if (unsafePath) {
    return {
      ok: false,
      reason: "Engineering data was found in an annotation-only document.",
      issues: [{
        path: unsafePath,
        message: "Engineering fields are never accepted by Field Redline Studio.",
      }],
    };
  }
  if (!isRecord(value.binding)) {
    return {
      ok: false,
      reason: "The redline document has no PDF binding.",
      issues,
    };
  }
  const sourceFingerprint = cleanSourceFingerprint(
    value.binding.sourceFingerprint,
  );
  const pageCount = finiteNumber(value.binding.pageCount);
  if (
    !sourceFingerprint ||
    pageCount == null ||
    !Number.isInteger(pageCount) ||
    pageCount < 1 ||
    pageCount > REDLINE_POLICY_LIMITS.maxPages
  ) {
    return {
      ok: false,
      reason: "The redline document has an invalid PDF binding.",
      issues,
    };
  }
  if (
    expected?.sourceFingerprint &&
    sourceFingerprint !== expected.sourceFingerprint
  ) {
    return {
      ok: false,
      reason: "This redline document belongs to a different PDF.",
      issues,
    };
  }
  if (
    expected?.pageCount != null &&
    pageCount !== expected.pageCount
  ) {
    return {
      ok: false,
      reason: "The PDF page count changed; the redline document was quarantined.",
      issues,
    };
  }
  const binding: RedlineDocumentBinding = { sourceFingerprint, pageCount };
  const id = cleanId(value.id);
  if (!id) {
    return {
      ok: false,
      reason: "The redline document has no stable ID.",
      issues,
    };
  }

  const rawLayers = Array.isArray(value.layers) ? value.layers : [];
  const layers: RedlineLayer[] = [];
  const layerIds = new Set<string>();
  for (
    let index = 0;
    index < Math.min(rawLayers.length, REDLINE_POLICY_LIMITS.maxLayers);
    index += 1
  ) {
    const rawLayer = rawLayers[index];
    if (!isRecord(rawLayer)) continue;
    const layerId = cleanId(rawLayer.id);
    const name = cleanText(rawLayer.name, REDLINE_POLICY_LIMITS.maxNameLength);
    if (!layerId || !name || layerIds.has(layerId)) continue;
    const opacity = finiteNumber(rawLayer.opacity);
    const order = finiteNumber(rawLayer.order);
    layers.push({
      id: layerId,
      name,
      visible: rawLayer.visible !== false,
      locked: rawLayer.locked === true,
      opacity: clamp(opacity ?? 1),
      order: order == null ? index : Math.trunc(order),
    });
    layerIds.add(layerId);
  }
  if (!layers.length) {
    layers.push({
      id: REDLINE_DEFAULT_LAYER_ID,
      name: "Field Redlines",
      visible: true,
      locked: false,
      opacity: 1,
      order: 0,
    });
    layerIds.add(REDLINE_DEFAULT_LAYER_ID);
    issues.push({
      path: "$.layers",
      message: "A safe Field Redlines layer was restored.",
    });
  }
  if (rawLayers.length > REDLINE_POLICY_LIMITS.maxLayers) {
    issues.push({
      path: "$.layers",
      message: "Layer count was capped by policy.",
    });
  }

  const rawAnnotations = Array.isArray(value.annotations)
    ? value.annotations
    : [];
  for (let index = 0; index < rawAnnotations.length; index += 1) {
    const rawAnnotation = rawAnnotations[index];
    if (
      isRecord(rawAnnotation) &&
      !bindingFromUnknown(rawAnnotation.binding, binding)
    ) {
      return {
        ok: false,
        reason: "A field redline is bound to a different PDF or page.",
        issues: [{
          path: `$.annotations[${index}].binding`,
          message: "Annotation bindings must exactly match the document PDF and page range.",
        }],
      };
    }
  }
  const annotations: RedlineAnnotation[] = [];
  const annotationIds = new Set<string>();
  for (
    let index = 0;
    index < Math.min(
      rawAnnotations.length,
      REDLINE_POLICY_LIMITS.maxAnnotations,
    );
    index += 1
  ) {
    const annotation = annotationFromUnknown(
      rawAnnotations[index],
      binding,
      layerIds,
      `$.annotations[${index}]`,
      issues,
    );
    if (!annotation || annotationIds.has(annotation.id)) {
      issues.push({
        path: `$.annotations[${index}]`,
        message: "Invalid or duplicate annotation was omitted.",
      });
      continue;
    }
    annotations.push(annotation);
    annotationIds.add(annotation.id);
  }
  if (rawAnnotations.length > REDLINE_POLICY_LIMITS.maxAnnotations) {
    issues.push({
      path: "$.annotations",
      message: "Annotation count was capped by policy.",
    });
  }

  const rawGroups = Array.isArray(value.groups) ? value.groups : [];
  const groups: RedlineGroup[] = [];
  const groupIds = new Set<string>();
  const alreadyGrouped = new Set<string>();
  for (
    let index = 0;
    index < Math.min(rawGroups.length, REDLINE_POLICY_LIMITS.maxGroups);
    index += 1
  ) {
    const rawGroup = rawGroups[index];
    if (!isRecord(rawGroup)) continue;
    const groupId = cleanId(rawGroup.id);
    if (!groupId || groupIds.has(groupId)) continue;
    const requestedIds = Array.isArray(rawGroup.annotationIds)
      ? rawGroup.annotationIds.map(cleanId).filter(Boolean)
      : [];
    const ids = uniqueExistingIds(requestedIds, annotationIds)
      .filter((annotationId) => !alreadyGrouped.has(annotationId));
    const first = annotations.find((annotation) => annotation.id === ids[0]);
    const samePageIds = first
      ? ids.filter((annotationId) => {
        const annotation = annotations.find((item) => item.id === annotationId);
        return annotation && exactPageBinding(annotation.binding, first.binding);
      })
      : [];
    if (samePageIds.length < 2) continue;
    samePageIds.forEach((annotationId) => alreadyGrouped.add(annotationId));
    groups.push({
      id: groupId,
      ...(cleanText(rawGroup.name, REDLINE_POLICY_LIMITS.maxNameLength)
        ? {
          name: cleanText(
            rawGroup.name,
            REDLINE_POLICY_LIMITS.maxNameLength,
          ),
        }
        : {}),
      annotationIds: samePageIds,
    });
    groupIds.add(groupId);
  }

  const rawFavorites = Array.isArray(value.favorites) ? value.favorites : [];
  const favorites: RedlineFavorite[] = [];
  const favoriteIds = new Set<string>();
  for (
    let index = 0;
    index < Math.min(
      rawFavorites.length,
      REDLINE_POLICY_LIMITS.maxFavorites,
    );
    index += 1
  ) {
    const rawFavorite = rawFavorites[index];
    if (!isRecord(rawFavorite)) continue;
    const favoriteId = cleanId(rawFavorite.id);
    const label = cleanText(
      rawFavorite.label,
      REDLINE_POLICY_LIMITS.maxNameLength,
    );
    const kind = typeof rawFavorite.kind === "string" &&
      KIND_SET.has(rawFavorite.kind)
      ? rawFavorite.kind as RedlineAnnotationKind
      : null;
    if (!favoriteId || !label || !kind || favoriteIds.has(favoriteId)) continue;
    favorites.push({
      id: favoriteId,
      label,
      kind,
      style: normalizeRedlineStyle(kind, rawFavorite.style),
    });
    favoriteIds.add(favoriteId);
  }

  const rawMyDetails = Array.isArray(value.myDetails) ? value.myDetails : [];
  const myDetails: RedlineMyDetail[] = [];
  const detailIds = new Set<string>();
  for (
    let index = 0;
    index < Math.min(
      rawMyDetails.length,
      REDLINE_POLICY_LIMITS.maxMyDetails,
    );
    index += 1
  ) {
    const rawDetail = rawMyDetails[index];
    if (!isRecord(rawDetail)) continue;
    const detailId = cleanId(rawDetail.id);
    const name = cleanText(
      rawDetail.name,
      REDLINE_POLICY_LIMITS.maxNameLength,
    );
    if (!detailId || !name || detailIds.has(detailId)) continue;
    const rawTemplateAnnotations = Array.isArray(rawDetail.annotations)
      ? rawDetail.annotations
      : [];
    const templateAnnotations: RedlineTemplateAnnotation[] = [];
    const localIds = new Set<string>();
    for (
      let itemIndex = 0;
      itemIndex < Math.min(
        rawTemplateAnnotations.length,
        REDLINE_POLICY_LIMITS.maxAnnotationsPerDetail,
      );
      itemIndex += 1
    ) {
      const template = templateAnnotationFromUnknown(
        rawTemplateAnnotations[itemIndex],
        `$.myDetails[${index}].annotations[${itemIndex}]`,
        issues,
      );
      if (!template || localIds.has(template.localId)) continue;
      templateAnnotations.push(template);
      localIds.add(template.localId);
    }
    if (!templateAnnotations.length) continue;
    const extent = isRecord(rawDetail.defaultExtent)
      ? rawDetail.defaultExtent
      : {};
    const width = finiteNumber(extent.width);
    const height = finiteNumber(extent.height);
    const templateGroups: RedlineTemplateGroup[] = [];
    const rawTemplateGroups = Array.isArray(rawDetail.groups)
      ? rawDetail.groups
      : [];
    for (let groupIndex = 0; groupIndex < rawTemplateGroups.length; groupIndex += 1) {
      const rawGroup = rawTemplateGroups[groupIndex];
      if (!isRecord(rawGroup)) continue;
      const localId = cleanId(rawGroup.localId);
      const annotationLocalIds = Array.isArray(rawGroup.annotationLocalIds)
        ? uniqueExistingIds(
          rawGroup.annotationLocalIds.map(cleanId).filter(Boolean),
          localIds,
        )
        : [];
      if (localId && annotationLocalIds.length >= 2) {
        templateGroups.push({ localId, annotationLocalIds });
      }
    }
    myDetails.push({
      id: detailId,
      name,
      defaultExtent: {
        width: clamp(width ?? 0.12, 0.005, 1),
        height: clamp(height ?? 0.08, 0.005, 1),
      },
      annotations: templateAnnotations,
      groups: templateGroups,
    });
    detailIds.add(detailId);
  }

  const title = cleanText(value.title, REDLINE_POLICY_LIMITS.maxNameLength);
  const rawNextSequence = finiteNumber(value.nextSequence);
  return {
    ok: true,
    document: {
      schema: REDLINE_DOCUMENT_SCHEMA,
      id,
      ...(title ? { title } : {}),
      binding,
      layers: layers
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
        .map((layer, order) => ({ ...layer, order })),
      annotations,
      groups,
      favorites,
      myDetails,
      nextSequence: Math.max(
        1,
        rawNextSequence == null ? 1 : Math.trunc(rawNextSequence),
      ),
    },
    issues,
  };
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const child = value[key];
        if (child !== undefined) result[key] = canonicalValue(child);
        return result;
      }, {});
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Number(value.toFixed(8));
  }
  return value;
}

export function canonicalRedlineJson(value: unknown) {
  return JSON.stringify(canonicalValue(value));
}

export function redlineAnnotationFingerprint(annotation: RedlineAnnotation) {
  return `annotation-${stableHash(canonicalRedlineJson(annotation))}`;
}

export function redlineDocumentFingerprint(document: RedlineDocument) {
  return `redline-${stableHash(canonicalRedlineJson(document))}`;
}

export function createRedlineSnapshot(
  document: RedlineDocument,
  savedAt?: string,
): RedlineSnapshotV1 {
  const sanitized = sanitizeRedlineDocument(document, document.binding);
  if (!sanitized.ok) throw new Error(sanitized.reason);
  const safeSavedAt = cleanText(savedAt, 64);
  return {
    version: REDLINE_SNAPSHOT_VERSION,
    schema: REDLINE_DOCUMENT_SCHEMA,
    fingerprint: redlineDocumentFingerprint(sanitized.document),
    ...(safeSavedAt ? { savedAt: safeSavedAt } : {}),
    document: sanitized.document,
  };
}

export function serializeRedlineSnapshot(
  document: RedlineDocument,
  savedAt?: string,
) {
  return canonicalRedlineJson(createRedlineSnapshot(document, savedAt));
}

function inputByteLength(value: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
}

export function parseRedlineSnapshot(
  input: string | unknown,
  expected: RedlineDocumentBinding,
): RedlineSnapshotParseResult {
  let value: unknown = input;
  if (typeof input === "string") {
    if (inputByteLength(input) > REDLINE_POLICY_LIMITS.maxSnapshotBytes) {
      return {
        status: "quarantined",
        reason: "The saved redline file exceeds the safe recovery limit.",
        issues: [],
      };
    }
    try {
      value = JSON.parse(input);
    } catch {
      return {
        status: "quarantined",
        reason: "The saved redline file is not valid JSON.",
        issues: [],
      };
    }
  } else {
    try {
      const serializedInput = JSON.stringify(input);
      if (
        typeof serializedInput !== "string" ||
        inputByteLength(serializedInput) >
        REDLINE_POLICY_LIMITS.maxSnapshotBytes
      ) {
        return {
          status: "quarantined",
          reason: "The saved redline file exceeds the safe recovery limit.",
          issues: [],
        };
      }
    } catch {
      return {
        status: "quarantined",
        reason: "The saved redline file has an unsafe object structure.",
        issues: [],
      };
    }
  }
  if (!isRecord(value)) {
    return {
      status: "quarantined",
      reason: "The saved redline file has an invalid envelope.",
      issues: [],
    };
  }
  if (
    value.version !== REDLINE_SNAPSHOT_VERSION ||
    value.schema !== REDLINE_DOCUMENT_SCHEMA
  ) {
    return {
      status: "quarantined",
      reason: "Only Field Redline Studio V133 snapshot version 1 can be restored.",
      issues: [],
    };
  }
  const sanitized = sanitizeRedlineDocument(value.document, expected);
  if (!sanitized.ok) {
    return {
      status: "quarantined",
      reason: sanitized.reason,
      issues: sanitized.issues,
    };
  }
  const fingerprint = redlineDocumentFingerprint(sanitized.document);
  if (typeof value.fingerprint !== "string" || value.fingerprint !== fingerprint) {
    return {
      status: "quarantined",
      reason: "The saved redline fingerprint does not match its contents.",
      issues: sanitized.issues,
    };
  }
  return {
    status: "ready",
    document: sanitized.document,
    fingerprint,
    sanitized: sanitized.issues.length > 0,
    issues: sanitized.issues,
  };
}

function annotationGeometryPoints(annotation: RedlineAnnotation) {
  return isRedlineStrokeAnnotation(annotation)
    ? annotation.points
    : [annotation.start, annotation.end];
}

function boundsForAnnotations(
  annotations: readonly RedlineAnnotation[],
): RedlineBounds | null {
  if (!annotations.length) return null;
  const binding = annotations[0].binding;
  if (!annotations.every((annotation) =>
    exactPageBinding(annotation.binding, binding))) {
    return null;
  }
  const points = annotations.flatMap(annotationGeometryPoints);
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    binding: { ...binding },
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

export function redlineSelectionBounds(
  document: RedlineDocument,
  annotationIds: readonly string[],
): RedlineBounds | null {
  const ids = new Set(annotationIds);
  return boundsForAnnotations(
    document.annotations.filter((annotation) => ids.has(annotation.id)),
  );
}

function noChange(
  document: RedlineDocument,
  selection: readonly string[],
  reason: string,
): RedlineOperationResult {
  return {
    document,
    selection: [...selection],
    changed: false,
    reason,
    createdIds: [],
  };
}

function changed(
  document: RedlineDocument,
  selection: readonly string[],
  reason: string,
  createdIds: readonly string[] = [],
): RedlineOperationResult {
  return {
    document,
    selection: [...selection],
    changed: true,
    reason,
    createdIds: [...createdIds],
  };
}

function selectedAnnotations(
  document: RedlineDocument,
  annotationIds: readonly string[],
) {
  const ids = new Set(annotationIds);
  return document.annotations.filter((annotation) => ids.has(annotation.id));
}

function selectionCanChange(
  document: RedlineDocument,
  annotationIds: readonly string[],
) {
  const annotations = selectedAnnotations(document, annotationIds);
  if (!annotations.length) {
    return { annotations, reason: "Select at least one redline." };
  }
  const layerById = new Map(document.layers.map((layer) => [layer.id, layer]));
  if (annotations.some((annotation) => layerById.get(annotation.layerId)?.locked)) {
    return {
      annotations,
      reason: "Unlock every selected redline layer before editing.",
    };
  }
  return { annotations, reason: "" };
}

function allocateId(document: RedlineDocument, prefix: string) {
  const occupied = new Set([
    ...document.annotations.map((annotation) => annotation.id),
    ...document.groups.map((group) => group.id),
    ...document.layers.map((layer) => layer.id),
    ...document.myDetails.map((detail) => detail.id),
  ]);
  let sequence = Math.max(1, document.nextSequence);
  let id = `${prefix}-${sequence}`;
  while (occupied.has(id)) {
    sequence += 1;
    id = `${prefix}-${sequence}`;
  }
  return { id, nextSequence: sequence + 1 };
}

function translatePoint(point: RedlinePoint, delta: RedlinePoint) {
  return {
    x: Number((point.x + delta.x).toFixed(8)),
    y: Number((point.y + delta.y).toFixed(8)),
  };
}

function translateAnnotation(
  annotation: RedlineAnnotation,
  delta: RedlinePoint,
): RedlineAnnotation {
  if (isRedlineStrokeAnnotation(annotation)) {
    return {
      ...annotation,
      points: annotation.points.map((point) => ({
        ...point,
        ...translatePoint(point, delta),
      })),
    };
  }
  return {
    ...annotation,
    start: translatePoint(annotation.start, delta),
    end: translatePoint(annotation.end, delta),
  };
}

function fittedDelta(bounds: RedlineBounds, delta: RedlinePoint) {
  const x = clamp(delta.x, -bounds.left, 1 - bounds.right);
  const y = clamp(delta.y, -bounds.top, 1 - bounds.bottom);
  return { x, y };
}

export function moveRedlineSelection(
  document: RedlineDocument,
  annotationIds: readonly string[],
  delta: RedlinePoint,
): RedlineOperationResult {
  const editable = selectionCanChange(document, annotationIds);
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  const bounds = boundsForAnnotations(editable.annotations);
  if (!bounds) {
    return noChange(
      document,
      annotationIds,
      "Selected redlines must belong to one PDF page.",
    );
  }
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
    return noChange(document, annotationIds, "Movement must use finite coordinates.");
  }
  const safeDelta = fittedDelta(bounds, delta);
  if (safeDelta.x === 0 && safeDelta.y === 0) {
    return noChange(document, annotationIds, "The selection is already at that position.");
  }
  const ids = new Set(editable.annotations.map((annotation) => annotation.id));
  return changed({
    ...document,
    annotations: document.annotations.map((annotation) =>
      ids.has(annotation.id)
        ? translateAnnotation(annotation, safeDelta)
        : annotation),
  }, annotationIds, "Selected field redlines moved.");
}

export function alignRedlineSelection(
  document: RedlineDocument,
  annotationIds: readonly string[],
  alignment: RedlineAlignment,
): RedlineOperationResult {
  const editable = selectionCanChange(document, annotationIds);
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  if (editable.annotations.length < 2) {
    return noChange(document, annotationIds, "Select at least two redlines to align.");
  }
  const selectionBounds = boundsForAnnotations(editable.annotations);
  if (!selectionBounds) {
    return noChange(
      document,
      annotationIds,
      "Redlines can only be aligned together on the same PDF page.",
    );
  }
  const targets = {
    left: selectionBounds.left,
    "center-x": (selectionBounds.left + selectionBounds.right) / 2,
    right: selectionBounds.right,
    top: selectionBounds.top,
    "center-y": (selectionBounds.top + selectionBounds.bottom) / 2,
    bottom: selectionBounds.bottom,
  };
  const selectedById = new Map(
    editable.annotations.map((annotation) => [annotation.id, annotation]),
  );
  let didChange = false;
  const annotations = document.annotations.map((annotation) => {
    if (!selectedById.has(annotation.id)) return annotation;
    const bounds = boundsForAnnotations([annotation])!;
    const delta = { x: 0, y: 0 };
    if (alignment === "left") delta.x = targets.left - bounds.left;
    if (alignment === "center-x") {
      delta.x = targets["center-x"] - (bounds.left + bounds.right) / 2;
    }
    if (alignment === "right") delta.x = targets.right - bounds.right;
    if (alignment === "top") delta.y = targets.top - bounds.top;
    if (alignment === "center-y") {
      delta.y = targets["center-y"] - (bounds.top + bounds.bottom) / 2;
    }
    if (alignment === "bottom") delta.y = targets.bottom - bounds.bottom;
    if (delta.x === 0 && delta.y === 0) return annotation;
    didChange = true;
    return translateAnnotation(annotation, fittedDelta(bounds, delta));
  });
  return didChange
    ? changed({ ...document, annotations }, annotationIds, "Selected field redlines aligned.")
    : noChange(document, annotationIds, "Selected redlines are already aligned.");
}

export function distributeRedlineSelection(
  document: RedlineDocument,
  annotationIds: readonly string[],
  direction: RedlineDistribution,
): RedlineOperationResult {
  if (direction !== "horizontal" && direction !== "vertical") {
    return noChange(document, annotationIds, "Choose a valid distribution direction.");
  }
  const editable = selectionCanChange(document, annotationIds);
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  if (editable.annotations.length < 3) {
    return noChange(
      document,
      annotationIds,
      "Select at least three redlines to distribute.",
    );
  }
  if (!boundsForAnnotations(editable.annotations)) {
    return noChange(
      document,
      annotationIds,
      "Redlines can only be distributed together on the same PDF page.",
    );
  }
  const rows = editable.annotations
    .map((annotation) => {
      const bounds = boundsForAnnotations([annotation])!;
      return {
        annotation,
        bounds,
        center: direction === "horizontal"
          ? (bounds.left + bounds.right) / 2
          : (bounds.top + bounds.bottom) / 2,
      };
    })
    .sort((left, right) =>
      left.center - right.center ||
      left.annotation.id.localeCompare(right.annotation.id));
  const firstCenter = rows[0].center;
  const lastCenter = rows.at(-1)!.center;
  if (firstCenter === lastCenter) {
    return noChange(
      document,
      annotationIds,
      `Selected redlines need different ${direction} positions first.`,
    );
  }
  const interval = (lastCenter - firstCenter) / (rows.length - 1);
  const deltaById = new Map<string, RedlinePoint>();
  rows.forEach((row, index) => {
    const target = firstCenter + interval * index;
    const delta = direction === "horizontal"
      ? { x: target - row.center, y: 0 }
      : { x: 0, y: target - row.center };
    deltaById.set(row.annotation.id, fittedDelta(row.bounds, delta));
  });
  let didChange = false;
  const annotations = document.annotations.map((annotation) => {
    const delta = deltaById.get(annotation.id);
    if (!delta || (delta.x === 0 && delta.y === 0)) return annotation;
    didChange = true;
    return translateAnnotation(annotation, delta);
  });
  return didChange
    ? changed(
      { ...document, annotations },
      annotationIds,
      `Selected field redlines distributed ${direction === "horizontal" ? "horizontally" : "vertically"}.`,
    )
    : noChange(document, annotationIds, "Selected redlines are already evenly distributed.");
}

function rotatedPoint(
  point: RedlinePoint,
  center: RedlinePoint,
  cosine: number,
  sine: number,
  pageAspectRatio: number,
) {
  const x = (point.x - center.x) * pageAspectRatio;
  const y = point.y - center.y;
  return {
    x: Number(
      (center.x + (x * cosine - y * sine) / pageAspectRatio).toFixed(8),
    ),
    y: Number((center.y + x * sine + y * cosine).toFixed(8)),
  };
}

function rotateAnnotation(
  annotation: RedlineAnnotation,
  center: RedlinePoint,
  cosine: number,
  sine: number,
  pageAspectRatio: number,
): RedlineAnnotation {
  if (isRedlineStrokeAnnotation(annotation)) {
    return {
      ...annotation,
      points: annotation.points.map((point) => ({
        ...point,
        ...rotatedPoint(point, center, cosine, sine, pageAspectRatio),
      })),
    };
  }
  return {
    ...annotation,
    start: rotatedPoint(
      annotation.start,
      center,
      cosine,
      sine,
      pageAspectRatio,
    ),
    end: rotatedPoint(
      annotation.end,
      center,
      cosine,
      sine,
      pageAspectRatio,
    ),
  };
}

function scaledPoint(
  point: RedlinePoint,
  center: RedlinePoint,
  factor: number,
) {
  return {
    x: Number((center.x + (point.x - center.x) * factor).toFixed(8)),
    y: Number((center.y + (point.y - center.y) * factor).toFixed(8)),
  };
}

function scaleAnnotation(
  annotation: RedlineAnnotation,
  center: RedlinePoint,
  factor: number,
): RedlineAnnotation {
  const style = annotation.kind === "text"
    ? normalizeRedlineStyle(annotation.kind, {
      ...annotation.style,
      textScale: (annotation.style.textScale ?? 1) * factor,
    })
    : annotation.style;
  if (isRedlineStrokeAnnotation(annotation)) {
    return {
      ...annotation,
      points: annotation.points.map((point) => ({
        ...point,
        ...scaledPoint(point, center, factor),
      })),
    };
  }
  return {
    ...annotation,
    style,
    start: scaledPoint(annotation.start, center, factor),
    end: scaledPoint(annotation.end, center, factor),
  };
}

export function scaleRedlineSelection(
  document: RedlineDocument,
  annotationIds: readonly string[],
  factor: number,
): RedlineOperationResult {
  const editable = selectionCanChange(document, annotationIds);
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  const bounds = boundsForAnnotations(editable.annotations);
  if (!bounds) {
    return noChange(
      document,
      annotationIds,
      "Redlines can only be resized together on the same PDF page.",
    );
  }
  if (!Number.isFinite(factor) || factor < 0.25 || factor > 4) {
    return noChange(
      document,
      annotationIds,
      "Choose a redline resize factor from 0.25 to 4.",
    );
  }
  if (Math.abs(factor - 1) < 0.0001) {
    return noChange(document, annotationIds, "Choose a different redline size.");
  }
  const center = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
  const ids = new Set(editable.annotations.map((annotation) => annotation.id));
  let annotations = document.annotations.map((annotation) =>
    ids.has(annotation.id)
      ? scaleAnnotation(annotation, center, factor)
      : annotation);
  const scaled = annotations.filter((annotation) => ids.has(annotation.id));
  const scaledBounds = boundsForAnnotations(scaled);
  if (!scaledBounds || scaledBounds.width > 1 || scaledBounds.height > 1) {
    return noChange(
      document,
      annotationIds,
      "That redline size would not fit within the PDF page.",
    );
  }
  const correction = fittedDelta(scaledBounds, { x: 0, y: 0 });
  if (correction.x !== 0 || correction.y !== 0) {
    annotations = annotations.map((annotation) =>
      ids.has(annotation.id)
        ? translateAnnotation(annotation, correction)
        : annotation);
  }
  return changed(
    { ...document, annotations },
    annotationIds,
    `Selected field redlines resized to ${Math.round(factor * 100)}%.`,
  );
}

export function updateRedlineSelectionStyle(
  document: RedlineDocument,
  annotationIds: readonly string[],
  changes: Partial<RedlineStyle>,
): RedlineOperationResult {
  const editable = selectionCanChange(document, annotationIds);
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  if (!boundsForAnnotations(editable.annotations)) {
    return noChange(
      document,
      annotationIds,
      "Redline styles can only be updated together on the same PDF page.",
    );
  }
  const ids = new Set(editable.annotations.map((annotation) => annotation.id));
  let didChange = false;
  const annotations = document.annotations.map((annotation) => {
    if (!ids.has(annotation.id)) return annotation;
    const style = normalizeRedlineStyle(annotation.kind, {
      ...annotation.style,
      ...changes,
    });
    if (canonicalRedlineJson(style) === canonicalRedlineJson(annotation.style)) {
      return annotation;
    }
    didChange = true;
    return { ...annotation, style };
  });
  return didChange
    ? changed(
      { ...document, annotations },
      annotationIds,
      "Selected field redline style updated.",
    )
    : noChange(document, annotationIds, "No field redline style changes to save.");
}

export function rotateRedlineSelection(
  document: RedlineDocument,
  annotationIds: readonly string[],
  degrees: number,
  pageAspectRatio = 1,
): RedlineOperationResult {
  const editable = selectionCanChange(document, annotationIds);
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  const bounds = boundsForAnnotations(editable.annotations);
  if (!bounds) {
    return noChange(
      document,
      annotationIds,
      "Redlines can only be rotated together on the same PDF page.",
    );
  }
  if (!Number.isFinite(degrees)) {
    return noChange(document, annotationIds, "Rotation must be a finite angle.");
  }
  if (
    !Number.isFinite(pageAspectRatio) ||
    pageAspectRatio <= 0 ||
    pageAspectRatio > 100
  ) {
    return noChange(
      document,
      annotationIds,
      "Rotation requires a valid PDF page aspect ratio.",
    );
  }
  const normalizedDegrees = (
    ((Number(degrees.toFixed(4)) % 360) + 540) % 360
  ) - 180;
  if (Math.abs(normalizedDegrees) < 0.0001) {
    return noChange(
      document,
      annotationIds,
      "Choose a non-zero redline rotation.",
    );
  }
  const radians = normalizedDegrees * Math.PI / 180;
  const cosine = Number(Math.cos(radians).toFixed(12));
  const sine = Number(Math.sin(radians).toFixed(12));
  const center = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
  const ids = new Set(editable.annotations.map((annotation) => annotation.id));
  let annotations = document.annotations.map((annotation) =>
    ids.has(annotation.id)
      ? rotateAnnotation(
        annotation,
        center,
        cosine,
        sine,
        pageAspectRatio,
      )
      : annotation);
  const rotated = annotations.filter((annotation) => ids.has(annotation.id));
  const rotatedBounds = boundsForAnnotations(rotated)!;
  if (rotatedBounds.width > 1 || rotatedBounds.height > 1) {
    return noChange(
      document,
      annotationIds,
      "That rotation would not fit within the PDF page.",
    );
  }
  const correction = fittedDelta(rotatedBounds, { x: 0, y: 0 });
  if (correction.x !== 0 || correction.y !== 0) {
    annotations = annotations.map((annotation) =>
      ids.has(annotation.id)
        ? translateAnnotation(annotation, correction)
        : annotation);
  }
  return changed(
    { ...document, annotations },
    annotationIds,
    `Selected field redlines rotated ${normalizedDegrees} degrees.`,
  );
}

export function groupRedlineSelection(
  document: RedlineDocument,
  annotationIds: readonly string[],
  name?: string,
): RedlineOperationResult {
  const editable = selectionCanChange(document, annotationIds);
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  if (editable.annotations.length < 2) {
    return noChange(document, annotationIds, "Select at least two redlines to group.");
  }
  if (!boundsForAnnotations(editable.annotations)) {
    return noChange(
      document,
      annotationIds,
      "A group must stay on one PDF page.",
    );
  }
  const ids = editable.annotations.map((annotation) => annotation.id);
  const selected = new Set(ids);
  const retainedGroups = document.groups
    .map((group) => ({
      ...group,
      annotationIds: group.annotationIds.filter((id) => !selected.has(id)),
    }))
    .filter((group) => group.annotationIds.length >= 2);
  const allocated = allocateId(document, "redline-group");
  const groupName = cleanText(name, REDLINE_POLICY_LIMITS.maxNameLength);
  return changed({
    ...document,
    groups: [...retainedGroups, {
      id: allocated.id,
      ...(groupName ? { name: groupName } : {}),
      annotationIds: ids,
    }],
    nextSequence: allocated.nextSequence,
  }, ids, "Selected field redlines grouped.", [allocated.id]);
}

export function ungroupRedlineSelection(
  document: RedlineDocument,
  annotationIds: readonly string[],
): RedlineOperationResult {
  const selected = new Set(annotationIds);
  const removed = document.groups.filter((group) =>
    group.annotationIds.some((id) => selected.has(id)));
  if (!removed.length) {
    return noChange(document, annotationIds, "The selection is not grouped.");
  }
  const editable = selectionCanChange(
    document,
    removed.flatMap((group) => group.annotationIds),
  );
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  return changed({
    ...document,
    groups: document.groups.filter((group) => !removed.includes(group)),
  }, annotationIds, "Selected field redlines ungrouped.");
}

export function duplicateRedlineSelection(
  document: RedlineDocument,
  annotationIds: readonly string[],
  offset: RedlinePoint = { x: 0.02, y: 0.02 },
): RedlineOperationResult {
  const editable = selectionCanChange(document, annotationIds);
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  const bounds = boundsForAnnotations(editable.annotations);
  if (!bounds) {
    return noChange(
      document,
      annotationIds,
      "Redlines can only be duplicated together on one PDF page.",
    );
  }
  if (
    document.annotations.length + editable.annotations.length >
    REDLINE_POLICY_LIMITS.maxAnnotations
  ) {
    return noChange(document, annotationIds, "The annotation safety limit was reached.");
  }
  const delta = fittedDelta(bounds, {
    x: Number.isFinite(offset.x) ? offset.x : 0.02,
    y: Number.isFinite(offset.y) ? offset.y : 0.02,
  });
  let nextSequence = document.nextSequence;
  const idMap = new Map<string, string>();
  const copies = editable.annotations.map((annotation) => {
    const allocated = allocateId({ ...document, nextSequence }, "redline");
    nextSequence = allocated.nextSequence;
    idMap.set(annotation.id, allocated.id);
    return {
      ...translateAnnotation(annotation, delta),
      id: allocated.id,
    };
  });
  const copiedGroups: RedlineGroup[] = [];
  for (const group of document.groups) {
    const copiedIds = group.annotationIds
      .map((id) => idMap.get(id))
      .filter((id): id is string => Boolean(id));
    if (copiedIds.length < 2) continue;
    const allocated = allocateId({ ...document, nextSequence }, "redline-group");
    nextSequence = allocated.nextSequence;
    copiedGroups.push({
      id: allocated.id,
      ...(group.name ? { name: `${group.name} copy`.slice(0, REDLINE_POLICY_LIMITS.maxNameLength) } : {}),
      annotationIds: copiedIds,
    });
  }
  const createdIds = copies.map((annotation) => annotation.id);
  return changed({
    ...document,
    annotations: [...document.annotations, ...copies],
    groups: [...document.groups, ...copiedGroups],
    nextSequence,
  }, createdIds, "Selected field redlines duplicated.", [
    ...createdIds,
    ...copiedGroups.map((group) => group.id),
  ]);
}

export function deleteRedlineSelection(
  document: RedlineDocument,
  annotationIds: readonly string[],
): RedlineOperationResult {
  const editable = selectionCanChange(document, annotationIds);
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  const ids = new Set(editable.annotations.map((annotation) => annotation.id));
  return changed({
    ...document,
    annotations: document.annotations.filter((annotation) => !ids.has(annotation.id)),
    groups: document.groups
      .map((group) => ({
        ...group,
        annotationIds: group.annotationIds.filter((id) => !ids.has(id)),
      }))
      .filter((group) => group.annotationIds.length >= 2),
  }, [], `${ids.size} field redline${ids.size === 1 ? "" : "s"} deleted.`);
}

function localPoint(point: RedlineStrokePoint, bounds: RedlineBounds) {
  const width = Math.max(bounds.width, 0.000001);
  const height = Math.max(bounds.height, 0.000001);
  return {
    x: clamp((point.x - bounds.left) / width),
    y: clamp((point.y - bounds.top) / height),
    ...(point.pressure == null ? {} : { pressure: point.pressure }),
    ...(point.t == null ? {} : { t: point.t }),
  };
}

export function saveRedlineMyDetail(
  document: RedlineDocument,
  annotationIds: readonly string[],
  name: string,
): RedlineOperationResult {
  if (document.myDetails.length >= REDLINE_POLICY_LIMITS.maxMyDetails) {
    return noChange(document, annotationIds, "The My Details safety limit was reached.");
  }
  const editable = selectionCanChange(document, annotationIds);
  if (editable.reason) return noChange(document, annotationIds, editable.reason);
  if (
    editable.annotations.length >
    REDLINE_POLICY_LIMITS.maxAnnotationsPerDetail
  ) {
    return noChange(document, annotationIds, "Select fewer annotations for one My Detail.");
  }
  const detailName = cleanText(name, REDLINE_POLICY_LIMITS.maxNameLength);
  if (!detailName) return noChange(document, annotationIds, "Name this My Detail first.");
  const bounds = boundsForAnnotations(editable.annotations);
  if (!bounds) {
    return noChange(
      document,
      annotationIds,
      "A My Detail must come from one PDF page.",
    );
  }
  const localIdByAnnotationId = new Map<string, string>();
  const templates = editable.annotations.map((annotation, index) => {
    const localId = `item-${index + 1}`;
    localIdByAnnotationId.set(annotation.id, localId);
    if (isRedlineStrokeAnnotation(annotation)) {
      return {
        localId,
        kind: annotation.kind,
        style: { ...annotation.style },
        points: annotation.points.map((point) => localPoint(point, bounds)),
      } satisfies RedlineStrokeTemplate;
    }
    return {
      localId,
      kind: annotation.kind,
      style: { ...annotation.style },
      start: localPoint(annotation.start, bounds),
      end: localPoint(annotation.end, bounds),
      ...(annotation.text ? { text: annotation.text } : {}),
    } satisfies RedlineCalloutTemplate;
  });
  const templateGroups = document.groups
    .map((group, index) => ({
      localId: `group-${index + 1}`,
      annotationLocalIds: group.annotationIds
        .map((id) => localIdByAnnotationId.get(id))
        .filter((id): id is string => Boolean(id)),
    }))
    .filter((group) => group.annotationLocalIds.length >= 2);
  const allocated = allocateId(document, "my-detail");
  return changed({
    ...document,
    myDetails: [...document.myDetails, {
      id: allocated.id,
      name: detailName,
      defaultExtent: {
        width: clamp(Math.max(bounds.width, 0.02), 0.005, 1),
        height: clamp(Math.max(bounds.height, 0.02), 0.005, 1),
      },
      annotations: templates,
      groups: templateGroups,
    }],
    nextSequence: allocated.nextSequence,
  }, annotationIds, `${detailName} saved to My Details.`, [allocated.id]);
}

function placedPoint(
  point: RedlineStrokePoint,
  origin: RedlinePoint,
  extent: { width: number; height: number },
) {
  return {
    x: origin.x + point.x * extent.width,
    y: origin.y + point.y * extent.height,
    ...(point.pressure == null ? {} : { pressure: point.pressure }),
    ...(point.t == null ? {} : { t: point.t }),
  };
}

export function placeRedlineMyDetail(
  document: RedlineDocument,
  detailId: string,
  binding: RedlinePageBinding,
  origin: RedlinePoint,
  extent?: { width: number; height: number },
  targetLayerId?: string,
): RedlineOperationResult {
  const detail = document.myDetails.find((item) => item.id === detailId);
  if (!detail) return noChange(document, [], "Choose a saved My Detail.");
  if (
    binding.sourceFingerprint !== document.binding.sourceFingerprint ||
    !Number.isInteger(binding.page) ||
    binding.page < 1 ||
    binding.page > document.binding.pageCount
  ) {
    return noChange(document, [], "My Details can only be placed on their bound PDF.");
  }
  const layer = targetLayerId
    ? document.layers.find((item) => item.id === targetLayerId)
    : document.layers.find((item) =>
      item.id === REDLINE_DEFAULT_LAYER_ID && !item.locked) ||
      document.layers.find((item) => !item.locked);
  if (!layer || layer.locked) {
    return noChange(document, [], "Choose an unlocked redline layer.");
  }
  const resolvedLayerId = layer.id;
  if (
    document.annotations.length + detail.annotations.length >
    REDLINE_POLICY_LIMITS.maxAnnotations
  ) {
    return noChange(document, [], "The annotation safety limit was reached.");
  }
  const requestedWidth = extent?.width ?? detail.defaultExtent.width;
  const requestedHeight = extent?.height ?? detail.defaultExtent.height;
  const safeExtent = {
    width: clamp(
      Number.isFinite(requestedWidth) ? requestedWidth : detail.defaultExtent.width,
      0.005,
      1,
    ),
    height: clamp(
      Number.isFinite(requestedHeight) ? requestedHeight : detail.defaultExtent.height,
      0.005,
      1,
    ),
  };
  const safeOrigin = {
    x: clamp(Number.isFinite(origin.x) ? origin.x : 0, 0, 1 - safeExtent.width),
    y: clamp(Number.isFinite(origin.y) ? origin.y : 0, 0, 1 - safeExtent.height),
  };
  let nextSequence = document.nextSequence;
  const idByLocalId = new Map<string, string>();
  const annotations: RedlineAnnotation[] = detail.annotations.map((template) => {
    const allocated = allocateId({ ...document, nextSequence }, "redline");
    nextSequence = allocated.nextSequence;
    idByLocalId.set(template.localId, allocated.id);
    const base = {
      id: allocated.id,
      layerId: resolvedLayerId,
      binding: { ...binding },
      style: { ...template.style },
    };
    if (isRedlineStrokeTemplate(template)) {
      return {
        ...base,
        kind: template.kind,
        points: template.points.map((point) =>
          placedPoint(point, safeOrigin, safeExtent)),
      };
    }
    return {
      ...base,
      kind: template.kind,
      start: placedPoint(template.start, safeOrigin, safeExtent),
      end: placedPoint(template.end, safeOrigin, safeExtent),
      ...(template.text ? { text: template.text } : {}),
    };
  });
  const groups: RedlineGroup[] = [];
  for (const templateGroup of detail.groups) {
    const annotationIds = templateGroup.annotationLocalIds
      .map((localId) => idByLocalId.get(localId))
      .filter((id): id is string => Boolean(id));
    if (annotationIds.length < 2) continue;
    const allocated = allocateId({ ...document, nextSequence }, "redline-group");
    nextSequence = allocated.nextSequence;
    groups.push({ id: allocated.id, annotationIds });
  }
  const createdIds = annotations.map((annotation) => annotation.id);
  return changed({
    ...document,
    annotations: [...document.annotations, ...annotations],
    groups: [...document.groups, ...groups],
    nextSequence,
  }, createdIds, `${detail.name} placed as editable field redlines.`, [
    ...createdIds,
    ...groups.map((group) => group.id),
  ]);
}

function addRedlineAnnotation(
  document: RedlineDocument,
  draft: RedlineAnnotationDraft,
): RedlineOperationResult {
  if (document.annotations.length >= REDLINE_POLICY_LIMITS.maxAnnotations) {
    return noChange(document, [], "The annotation safety limit was reached.");
  }
  if (
    !Number.isInteger(draft.page) ||
    draft.page < 1 ||
    draft.page > document.binding.pageCount
  ) {
    return noChange(document, [], "Choose a valid PDF page.");
  }
  const layer = draft.layerId
    ? document.layers.find((item) => item.id === draft.layerId)
    : document.layers.find((item) =>
      item.id === REDLINE_DEFAULT_LAYER_ID && !item.locked) ||
      document.layers.find((item) => !item.locked);
  if (!layer || layer.locked) {
    return noChange(document, [], "Choose an unlocked redline layer.");
  }
  const layerId = layer.id;
  const allocated = allocateId(document, "redline");
  const binding = {
    sourceFingerprint: document.binding.sourceFingerprint,
    page: draft.page,
  };
  const raw = isRedlineStrokeDraft(draft)
    ? {
      id: allocated.id,
      layerId,
      binding,
      kind: draft.kind,
      style: normalizeRedlineStyle(draft.kind, draft.style),
      points: draft.points,
    }
    : {
      id: allocated.id,
      layerId,
      binding,
      kind: draft.kind,
      style: normalizeRedlineStyle(draft.kind, draft.style),
      start: draft.start,
      end: draft.end,
      text: draft.text,
    };
  const issues: RedlineSanitizeIssue[] = [];
  const annotation = annotationFromUnknown(
    raw,
    document.binding,
    new Set(document.layers.map((item) => item.id)),
    "$.draft",
    issues,
  );
  if (!annotation) return noChange(document, [], "The field redline is incomplete.");
  return changed({
    ...document,
    annotations: [...document.annotations, annotation],
    nextSequence: allocated.nextSequence,
  }, [annotation.id], "Field redline added.", [annotation.id]);
}

function replaceRedlineAnnotation(
  document: RedlineDocument,
  replacement: RedlineAnnotation,
): RedlineOperationResult {
  const current = document.annotations.find((item) => item.id === replacement.id);
  if (!current) return noChange(document, [], "The field redline no longer exists.");
  const editable = selectionCanChange(document, [current.id]);
  if (editable.reason) return noChange(document, [current.id], editable.reason);
  if (!exactPageBinding(current.binding, replacement.binding)) {
    return noChange(
      document,
      [current.id],
      "A field redline cannot move to another PDF or page during editing.",
    );
  }
  const issues: RedlineSanitizeIssue[] = [];
  const annotation = annotationFromUnknown(
    replacement,
    document.binding,
    new Set(document.layers.map((item) => item.id)),
    "$.replacement",
    issues,
  );
  if (!annotation) return noChange(document, [current.id], "The edited field redline is invalid.");
  if (canonicalRedlineJson(annotation) === canonicalRedlineJson(current)) {
    return noChange(document, [current.id], "No field redline changes to save.");
  }
  return changed({
    ...document,
    annotations: document.annotations.map((item) =>
      item.id === annotation.id ? annotation : item),
  }, [annotation.id], "Field redline updated.");
}

function addLayer(
  document: RedlineDocument,
  name: string,
): RedlineOperationResult {
  if (document.layers.length >= REDLINE_POLICY_LIMITS.maxLayers) {
    return noChange(document, [], "The layer safety limit was reached.");
  }
  const layerName = cleanText(name, REDLINE_POLICY_LIMITS.maxNameLength);
  if (!layerName) return noChange(document, [], "Name the redline layer first.");
  const allocated = allocateId(document, "redline-layer");
  return changed({
    ...document,
    layers: [...document.layers, {
      id: allocated.id,
      name: layerName,
      visible: true,
      locked: false,
      opacity: 1,
      order: document.layers.length,
    }],
    nextSequence: allocated.nextSequence,
  }, [], `${layerName} layer added.`, [allocated.id]);
}

function updateLayer(
  document: RedlineDocument,
  layerId: string,
  changes: Partial<Pick<RedlineLayer, "name" | "visible" | "locked" | "opacity" | "order">>,
): RedlineOperationResult {
  const layer = document.layers.find((item) => item.id === layerId);
  if (!layer) return noChange(document, [], "The redline layer no longer exists.");
  const name = changes.name == null
    ? layer.name
    : cleanText(changes.name, REDLINE_POLICY_LIMITS.maxNameLength);
  if (!name) return noChange(document, [], "A redline layer needs a name.");
  const opacity = changes.opacity == null
    ? layer.opacity
    : clamp(Number.isFinite(changes.opacity) ? changes.opacity : layer.opacity);
  const order = changes.order == null
    ? layer.order
    : Math.trunc(Number.isFinite(changes.order) ? changes.order : layer.order);
  const updated = {
    ...layer,
    name,
    visible: changes.visible == null ? layer.visible : Boolean(changes.visible),
    locked: changes.locked == null ? layer.locked : Boolean(changes.locked),
    opacity,
    order,
  };
  if (canonicalRedlineJson(updated) === canonicalRedlineJson(layer)) {
    return noChange(document, [], "No layer changes to save.");
  }
  const layers = document.layers
    .map((item) => item.id === layerId ? updated : item)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((item, index) => ({ ...item, order: index }));
  return changed({ ...document, layers }, [], "Redline layer updated.");
}

function removeLayer(
  document: RedlineDocument,
  layerId: string,
): RedlineOperationResult {
  if (document.layers.length <= 1) {
    return noChange(document, [], "Keep at least one redline layer.");
  }
  const layer = document.layers.find((item) => item.id === layerId);
  if (!layer) return noChange(document, [], "The redline layer no longer exists.");
  const fallback = document.layers.find((item) =>
    item.id !== layerId && !item.locked);
  if (!fallback) {
    return noChange(document, [], "Unlock another layer before removing this one.");
  }
  const layers = document.layers
    .filter((item) => item.id !== layerId)
    .map((item, order) => ({ ...item, order }));
  return changed({
    ...document,
    layers,
    annotations: document.annotations.map((annotation) =>
      annotation.layerId === layerId
        ? { ...annotation, layerId: fallback.id }
        : annotation),
  }, [], `${layer.name} removed; its redlines moved to ${fallback.name}.`);
}

function upsertFavorite(
  document: RedlineDocument,
  favorite: RedlineFavorite,
): RedlineOperationResult {
  const id = cleanId(favorite.id);
  const label = cleanText(favorite.label, REDLINE_POLICY_LIMITS.maxNameLength);
  if (!id || !label || !KIND_SET.has(favorite.kind)) {
    return noChange(document, [], "The favorite tool is incomplete.");
  }
  const next: RedlineFavorite = {
    id,
    label,
    kind: favorite.kind,
    style: normalizeRedlineStyle(favorite.kind, favorite.style),
  };
  const existingIndex = document.favorites.findIndex((item) => item.id === id);
  if (
    existingIndex < 0 &&
    document.favorites.length >= REDLINE_POLICY_LIMITS.maxFavorites
  ) {
    return noChange(document, [], "You can pin up to four favorite redline tools.");
  }
  const favorites = existingIndex < 0
    ? [...document.favorites, next]
    : document.favorites.map((item) => item.id === id ? next : item);
  if (canonicalRedlineJson(favorites) === canonicalRedlineJson(document.favorites)) {
    return noChange(document, [], "That favorite is already pinned.");
  }
  return changed({ ...document, favorites }, [], `${label} pinned to favorites.`);
}

export function applyRedlineCommand(
  document: RedlineDocument,
  command: RedlineCommand,
): RedlineOperationResult {
  if (command.type === "add-annotation") {
    return addRedlineAnnotation(document, command.draft);
  }
  if (command.type === "replace-annotation") {
    return replaceRedlineAnnotation(document, command.annotation);
  }
  if (command.type === "move-selection") {
    return moveRedlineSelection(document, command.annotationIds, command.delta);
  }
  if (command.type === "align-selection") {
    return alignRedlineSelection(
      document,
      command.annotationIds,
      command.alignment,
    );
  }
  if (command.type === "distribute-selection") {
    return distributeRedlineSelection(
      document,
      command.annotationIds,
      command.direction,
    );
  }
  if (command.type === "rotate-selection") {
    return rotateRedlineSelection(
      document,
      command.annotationIds,
      command.degrees,
      command.pageAspectRatio,
    );
  }
  if (command.type === "scale-selection") {
    return scaleRedlineSelection(
      document,
      command.annotationIds,
      command.factor,
    );
  }
  if (command.type === "update-selection-style") {
    return updateRedlineSelectionStyle(
      document,
      command.annotationIds,
      command.changes,
    );
  }
  if (command.type === "group-selection") {
    return groupRedlineSelection(document, command.annotationIds, command.name);
  }
  if (command.type === "ungroup-selection") {
    return ungroupRedlineSelection(document, command.annotationIds);
  }
  if (command.type === "duplicate-selection") {
    return duplicateRedlineSelection(
      document,
      command.annotationIds,
      command.offset,
    );
  }
  if (command.type === "delete-selection") {
    return deleteRedlineSelection(document, command.annotationIds);
  }
  if (command.type === "save-detail") {
    return saveRedlineMyDetail(document, command.annotationIds, command.name);
  }
  if (command.type === "place-detail") {
    return placeRedlineMyDetail(
      document,
      command.detailId,
      command.binding,
      command.origin,
      command.extent,
      command.targetLayerId,
    );
  }
  if (command.type === "add-layer") return addLayer(document, command.name);
  if (command.type === "update-layer") {
    return updateLayer(
      document,
      command.layerId,
      command.changes,
    );
  }
  if (command.type === "remove-layer") {
    return removeLayer(document, command.layerId);
  }
  if (command.type === "upsert-favorite") {
    return upsertFavorite(document, command.favorite);
  }
  const favorite = document.favorites.find((item) =>
    item.id === command.favoriteId);
  if (!favorite) return noChange(document, [], "The favorite is not pinned.");
  return changed({
    ...document,
    favorites: document.favorites.filter((item) =>
      item.id !== command.favoriteId),
  }, [], `${favorite.label} removed from favorites.`);
}

export function redlineAnnotationIsOnPage(
  annotation: RedlineAnnotation,
  binding: RedlinePageBinding,
) {
  return exactPageBinding(annotation.binding, binding);
}

export function visibleRedlineAnnotations(
  document: RedlineDocument,
  binding: RedlinePageBinding,
) {
  if (
    binding.sourceFingerprint !== document.binding.sourceFingerprint ||
    binding.page < 1 ||
    binding.page > document.binding.pageCount
  ) {
    return [];
  }
  const visibleLayerIds = new Set(
    document.layers
      .filter((layer) => layer.visible && layer.opacity > 0)
      .map((layer) => layer.id),
  );
  return document.annotations.filter((annotation) =>
    visibleLayerIds.has(annotation.layerId) &&
    exactPageBinding(annotation.binding, binding));
}
