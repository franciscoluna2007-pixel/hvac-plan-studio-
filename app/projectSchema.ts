import {
  normalizeRigidStraightMeta,
  rigidSizeLabel,
} from "./rigidDuct";
import {
  normalizeRigidElbowMeta,
  normalizeRigidStraightTopology,
} from "./rigidTopology";

export const CURRENT_PROJECT_SCHEMA_VERSION = 11 as const;
export const SUPPORTED_LEGACY_PROJECT_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type ProjectEnvelope = {
  version: number;
  drawings: unknown[];
  rigidDrawingQuarantine?: unknown[];
  [key: string]: unknown;
};

export type ProjectMigrationResult =
  | {
      ok: true;
      project: ProjectEnvelope & { version: typeof CURRENT_PROJECT_SCHEMA_VERSION };
      migratedFrom: number;
      warnings: string[];
    }
  | {
      ok: false;
      reason: "malformed-project" | "unsupported-version";
    };

function finitePoint(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const point = value as { x?: unknown; y?: unknown };
  return Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
}

export function migrateSavedProject(input: unknown): ProjectMigrationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "malformed-project" };
  }
  const source = input as Partial<ProjectEnvelope>;
  const version = Number(source.version);
  if (
    version !== CURRENT_PROJECT_SCHEMA_VERSION &&
    !SUPPORTED_LEGACY_PROJECT_VERSIONS.includes(version as (typeof SUPPORTED_LEGACY_PROJECT_VERSIONS)[number])
  ) return { ok: false, reason: "unsupported-version" };
  if (!Array.isArray(source.drawings)) return { ok: false, reason: "malformed-project" };

  const cloned = structuredClone(source) as ProjectEnvelope;
  const drawings: unknown[] = [];
  const quarantined: unknown[] = Array.isArray(cloned.rigidDrawingQuarantine)
    ? cloned.rigidDrawingQuarantine.slice(0, 50)
    : [];
  let rejectedRigid = 0;

  for (const raw of cloned.drawings) {
    if (!raw || typeof raw !== "object") {
      drawings.push(raw);
      continue;
    }
    const drawing = raw as Record<string, unknown>;
    if (drawing.type === "rigid-fitting") {
      const rigidFitting = normalizeRigidElbowMeta(drawing.rigidFitting);
      const points = Array.isArray(drawing.points) ? drawing.points : [];
      if (!rigidFitting || points.length !== 1 || !points.every(finitePoint)) {
        rejectedRigid += 1;
        if (quarantined.length < 50) quarantined.push(raw);
        continue;
      }
      drawings.push({ ...drawing, type: "rigid-fitting", rigidFitting });
      continue;
    }
    if (drawing.type !== "rigid") {
      drawings.push(raw);
      continue;
    }
    const rigid = normalizeRigidStraightMeta(drawing.rigid);
    const points = Array.isArray(drawing.points) ? drawing.points : [];
    if (!rigid || points.length !== 2 || !points.every(finitePoint)) {
      rejectedRigid += 1;
      if (quarantined.length < 50) quarantined.push(raw);
      continue;
    }
    drawings.push({
      ...drawing,
      type: "rigid",
      size: rigidSizeLabel(rigid),
      rigid,
      rigidTopology: normalizeRigidStraightTopology(drawing.rigidTopology),
    });
  }

  const warnings = rejectedRigid
    ? [`${rejectedRigid} invalid rigid drawing${rejectedRigid === 1 ? " was" : "s were"} quarantined.`]
    : [];
  return {
    ok: true,
    project: {
      ...cloned,
      version: CURRENT_PROJECT_SCHEMA_VERSION,
      drawings,
      ...(quarantined.length ? { rigidDrawingQuarantine: quarantined } : {}),
    },
    migratedFrom: version,
    warnings,
  };
}
