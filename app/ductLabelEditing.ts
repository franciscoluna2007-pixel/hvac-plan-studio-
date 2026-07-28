export const DEFAULT_DUCT_LABEL_SCALE = 1;
export const MIN_DUCT_LABEL_SCALE = 0.4;
export const MAX_DUCT_LABEL_SCALE = 2;
export const DUCT_LABEL_SCALE_STEP = 0.05;

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Normalizes a saved duct-label scale.
 *
 * Existing plans did not store this field, so missing or malformed legacy
 * values intentionally render at 100 percent.
 */
export function normalizedDuctLabelScale(value?: number | null) {
  return clamp(
    finiteNumber(value, DEFAULT_DUCT_LABEL_SCALE),
    MIN_DUCT_LABEL_SCALE,
    MAX_DUCT_LABEL_SCALE,
  );
}

export function stepDuctLabelScale(
  value: number | null | undefined,
  direction: -1 | 1,
) {
  return normalizedDuctLabelScale(
    Number((
      normalizedDuctLabelScale(value) + direction * DUCT_LABEL_SCALE_STEP
    ).toFixed(2)),
  );
}

export function resetDuctLabelScale() {
  return DEFAULT_DUCT_LABEL_SCALE;
}
