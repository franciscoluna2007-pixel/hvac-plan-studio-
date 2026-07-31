const STORAGE_PREFIX = "hvac-plan-studio:";

export type StoredPdfProject = {
  pdfFingerprint?: string;
};

export type ProjectRestoreDecision<T extends StoredPdfProject> =
  | { status: "new"; project: null }
  | { status: "source-mismatch"; project: null }
  | { status: "restored"; project: T };

export type ProjectSaveState = "saved" | "saving" | "limited" | "error";

type ProjectStorageWriter = {
  setItem(key: string, value: string): void;
};

export function projectStorageKey(name: string, sourceFingerprint?: string) {
  const baseKey = `${STORAGE_PREFIX}${name.toLowerCase()}`;
  return sourceFingerprint ? `${baseKey}:${sourceFingerprint}` : baseKey;
}

export function persistProjectSnapshot<T extends object>(
  storage: ProjectStorageWriter,
  storageKey: string,
  project: T,
): Exclude<ProjectSaveState, "saving"> {
  try {
    storage.setItem(storageKey, JSON.stringify(project));
    return "saved";
  } catch {
    try {
      storage.setItem(
        storageKey,
        JSON.stringify({ ...project, activePlanAnalysis: null }),
      );
      return "limited";
    } catch {
      return "error";
    }
  }
}

export function resolveProjectRestore<T extends StoredPdfProject>(
  exactStored: string | null,
  legacyStored: string | null,
  sourceFingerprint: string,
): ProjectRestoreDecision<T> {
  const stored = exactStored || legacyStored;
  if (!stored) return { status: "new", project: null };
  try {
    const project = JSON.parse(stored) as T;
    if (project.pdfFingerprint !== sourceFingerprint) {
      return { status: "source-mismatch", project: null };
    }
    return { status: "restored", project };
  } catch {
    return { status: "new", project: null };
  }
}
