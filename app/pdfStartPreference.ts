export const PDF_START_PREFERENCE_VERSION = 1;
export const PDF_START_PREFERENCE_STORAGE_KEY = "hvac-plan-studio:pdf-start-preference:v1";

export type PdfStartMode = "direct" | "guided";

export type PdfStartPreference = {
  version: typeof PDF_START_PREFERENCE_VERSION;
  mode: PdfStartMode;
};

export const DEFAULT_PDF_START_PREFERENCE: PdfStartPreference = {
  version: PDF_START_PREFERENCE_VERSION,
  mode: "direct",
};

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function normalizePdfStartPreference(value: unknown): PdfStartPreference {
  if (!value || typeof value !== "object") return DEFAULT_PDF_START_PREFERENCE;
  const candidate = value as { version?: unknown; mode?: unknown };
  if (
    candidate.version !== PDF_START_PREFERENCE_VERSION
    || (candidate.mode !== "direct" && candidate.mode !== "guided")
  ) {
    return DEFAULT_PDF_START_PREFERENCE;
  }
  return {
    version: PDF_START_PREFERENCE_VERSION,
    mode: candidate.mode,
  };
}

export function loadPdfStartPreference(
  storage: ReadableStorage | null = typeof window === "undefined" ? null : window.localStorage,
): PdfStartPreference {
  if (!storage) return DEFAULT_PDF_START_PREFERENCE;
  try {
    return normalizePdfStartPreference(
      JSON.parse(storage.getItem(PDF_START_PREFERENCE_STORAGE_KEY) || "null"),
    );
  } catch {
    return DEFAULT_PDF_START_PREFERENCE;
  }
}

export function savePdfStartPreference(
  preference: PdfStartPreference,
  storage: WritableStorage | null = typeof window === "undefined" ? null : window.localStorage,
) {
  if (!storage) return;
  try {
    storage.setItem(
      PDF_START_PREFERENCE_STORAGE_KEY,
      JSON.stringify(normalizePdfStartPreference(preference)),
    );
  } catch {
    // A private or full browser store should not block opening a local plan.
  }
}
