export const PDF_POINTS_PER_INCH = 72;
export const PLAN_VIEWPORT_SCALE = 1.35;

export type DetectedDrawingScale = {
  label: string;
  ratio: number | null;
};

export type ResolvedDrawingScale = {
  label: string;
  ratio: number;
  feetPerUnit: number;
};

function normalizedScaleText(label: string) {
  return label
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function scaleRatioFromLabel(label: string) {
  const normalized = normalizedScaleText(label);
  const metric = normalized.match(/^1\s*:\s*(\d+(?:\.\d+)?)$/i);
  if (metric) {
    const ratio = Number(metric[1]);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
  }

  const architectural = normalized.match(
    /(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*"\s*=\s*(\d+(?:\.\d+)?)\s*'(?:\s*-\s*(\d+(?:\.\d+)?)\s*")?/i,
  );
  if (!architectural) return null;

  const numerator = Number(architectural[1]);
  const denominator = Number(architectural[2] || 1);
  const paperInches = numerator / denominator;
  const realInches = Number(architectural[3]) * 12 + Number(architectural[4] || 0);
  if (!(paperInches > 0) || !(realInches > 0)) return null;
  return realInches / paperInches;
}

export function feetPerDrawingUnitFromRatio(
  ratio: number,
  viewportScale = PLAN_VIEWPORT_SCALE,
) {
  if (!(ratio > 0) || !(viewportScale > 0)) return null;
  return ratio / (12 * PDF_POINTS_PER_INCH * viewportScale);
}

export function resolveDetectedDrawingScale(
  candidate: DetectedDrawingScale,
): ResolvedDrawingScale | null {
  const ratio = candidate.ratio && candidate.ratio > 0
    ? candidate.ratio
    : scaleRatioFromLabel(candidate.label);
  if (!ratio) return null;
  const feetPerUnit = feetPerDrawingUnitFromRatio(ratio);
  if (!feetPerUnit) return null;
  return {
    label: normalizedScaleText(candidate.label),
    ratio,
    feetPerUnit,
  };
}
