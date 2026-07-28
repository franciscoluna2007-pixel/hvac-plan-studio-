export type SymbolLabelOffset = {
  x: number;
  y: number;
};

export type SymbolLabelBox = {
  width: number;
  height: number;
  halfWidth: number;
  halfHeight: number;
};

export const MIN_SYMBOL_SCALE = 0.4;
export const MAX_SYMBOL_SCALE = 3;
export const MIN_SYMBOL_LABEL_SCALE = 0.65;
export const MAX_SYMBOL_LABEL_SCALE = 1.75;
export const MAX_SYMBOL_LABEL_OFFSET = 180;

export const DEFAULT_TERMINAL_SYMBOL_SCALE = 0.82;
export const DEFAULT_EQUIPMENT_SYMBOL_SCALE = 0.9;
export const DEFAULT_OTHER_SYMBOL_SCALE = 0.85;

export const DEFAULT_TERMINAL_LABEL_SCALE = 0.88;
export const DEFAULT_EQUIPMENT_LABEL_SCALE = 0.92;
export const DEFAULT_OTHER_LABEL_SCALE = 0.9;

const TERMINAL_KINDS = new Set(["diffuser", "returnGrille"]);

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Normalizes a persisted icon scale without changing legacy drawings.
 * Older symbols omitted scale values, so an absent or invalid value remains 100%.
 */
export function normalizedSymbolScale(value?: number | null) {
  return clamp(
    finiteNumber(value, 1),
    MIN_SYMBOL_SCALE,
    MAX_SYMBOL_SCALE,
  );
}

/**
 * Returns an explicit, smaller visual default for newly placed symbols.
 * Primary equipment stays larger because its scaled edges also locate plenum ports.
 */
export function defaultSymbolScale(kind: string) {
  if (kind === "equipment") return DEFAULT_EQUIPMENT_SYMBOL_SCALE;
  if (TERMINAL_KINDS.has(kind)) return DEFAULT_TERMINAL_SYMBOL_SCALE;
  return DEFAULT_OTHER_SYMBOL_SCALE;
}

/**
 * Normalizes a persisted label scale without shrinking labels from older saves.
 */
export function normalizedSymbolLabelScale(value?: number | null) {
  return clamp(
    finiteNumber(value, 1),
    MIN_SYMBOL_LABEL_SCALE,
    MAX_SYMBOL_LABEL_SCALE,
  );
}

/**
 * Returns the explicit label scale assigned to a newly placed symbol.
 */
export function defaultSymbolLabelScale(kind: string) {
  if (kind === "equipment") return DEFAULT_EQUIPMENT_LABEL_SCALE;
  if (TERMINAL_KINDS.has(kind)) return DEFAULT_TERMINAL_LABEL_SCALE;
  return DEFAULT_OTHER_LABEL_SCALE;
}

function estimatedCharacterWidth(character: string) {
  if (/\s/.test(character)) return 3.2;
  if (/[I1.,:;'|!]/.test(character)) return 3.4;
  if (/[MW@#%&]/.test(character)) return 8;
  return 6;
}

/**
 * Estimates a padded SVG label hit box in plan units.
 * The estimate is intentionally deterministic so rendering and pointer geometry agree.
 */
export function estimateSymbolLabelBox(
  text: string,
  scale?: number | null,
): SymbolLabelBox {
  const safeText = typeof text === "string" && text.length ? text : "LABEL";
  const labelScale = normalizedSymbolLabelScale(scale);
  const contentWidth = [...safeText].reduce(
    (total, character) => total + estimatedCharacterWidth(character),
    0,
  );
  const width = clamp(contentWidth + 12, 28, 420) * labelScale;
  const height = 16 * labelScale;
  return {
    width,
    height,
    halfWidth: width / 2,
    halfHeight: height / 2,
  };
}

/**
 * Keeps a symbol label associated with its icon and rejects malformed saved offsets.
 */
export function clampSymbolLabelOffset(
  offset?: Partial<SymbolLabelOffset> | null,
): SymbolLabelOffset {
  const x = finiteNumber(offset?.x, 0);
  const y = finiteNumber(offset?.y, 0);
  const distance = Math.hypot(x, y);
  if (!distance || distance <= MAX_SYMBOL_LABEL_OFFSET) return { x, y };
  const ratio = MAX_SYMBOL_LABEL_OFFSET / distance;
  return {
    x: x * ratio,
    y: y * ratio,
  };
}

/**
 * Converts a pointer coordinate on one local axis into a centered resize scale.
 * Multiplying by the corner sign prevents a pointer that crosses the center from
 * bouncing back to a large positive scale, which Math.abs-based resizing does.
 */
export function signedCornerScale(
  local: number,
  cornerSign: -1 | 1,
  halfExtent: number,
  currentScale = 1,
) {
  if (
    !Number.isFinite(local)
    || (cornerSign !== -1 && cornerSign !== 1)
    || !Number.isFinite(halfExtent)
    || halfExtent <= 0
  ) {
    return normalizedSymbolScale(currentScale);
  }
  return normalizedSymbolScale((local * cornerSign) / halfExtent);
}
