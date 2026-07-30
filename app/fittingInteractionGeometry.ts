export const FITTING_HIT_STROKE_PX = 16;
export const FITTING_COARSE_HIT_STROKE_PX = 22;

export function fittingOverlayScale(zoom: number) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return 1 / Math.max(0.25, Math.min(8, safeZoom));
}
