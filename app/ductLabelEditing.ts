export const DEFAULT_DUCT_LABEL_SCALE = 1;
export const MIN_DUCT_LABEL_SCALE = 0.4;
export const MAX_DUCT_LABEL_SCALE = 2;
export const DUCT_LABEL_SCALE_STEP = 0.05;

export type DuctLabelBox = {
  width: number;
  height: number;
};

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

function estimatedCharacterWidth(character: string) {
  if (/\s/.test(character)) return 4;
  if (/[I1.,:;'|!]/.test(character)) return 4.5;
  if (/[MW@#%&]/.test(character)) return 10;
  return 7.4;
}

/**
 * Estimates the rendered SVG duct-label footprint in plan units.
 * The result intentionally includes a small painted-stroke allowance.
 */
export function estimateDuctLabelBox(
  text: string,
  scale?: number | null,
): DuctLabelBox {
  const safeText = typeof text === "string" && text.length ? text : "DUCT";
  const labelScale = normalizedDuctLabelScale(scale);
  const contentWidth = [...safeText].reduce(
    (total, character) => total + estimatedCharacterWidth(character),
    0,
  );
  return {
    width: clamp(contentWidth + 12, 28, 640) * labelScale,
    height: 20 * labelScale,
  };
}
