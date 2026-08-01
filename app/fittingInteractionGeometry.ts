export const FITTING_HIT_STROKE_PX = 16;
export const FITTING_COARSE_HIT_STROKE_PX = 22;
export const BRANCH_PICK_RADIUS_PX = 24;
export const BRANCH_ATTACH_RADIUS_PX = 28;
export const BRANCH_AUTO_MATCH_RADIUS_PX = 18;
export const BRANCH_THREE_RUN_RADIUS_PX = 28;

export function fittingPortReach(
  size: string,
  port: 0 | 1 | 2,
  compact: boolean,
) {
  const numericSize = Number(size) || 8;
  if (!compact) {
    const legacyBase = [12, 13, 16][port];
    return Math.max(14, Math.min(27, legacyBase + numericSize * .38));
  }
  const compactBase = [7.5, 8, 9][port];
  return Math.max(9, Math.min(16, compactBase + numericSize * .25));
}

export function fittingPortReachForVersion(
  size: string,
  port: 0 | 1 | 2,
  geometryVersion?: 2 | 3,
) {
  if (geometryVersion !== 3) {
    return fittingPortReach(size, port, geometryVersion === 2);
  }
  const numericSize = Number(size) || 8;
  const directPlacementBase = [4.5, 5, 5.5][port];
  return Math.max(6, Math.min(10, directPlacementBase + numericSize * .125));
}

export function fittingOverlayScale(zoom: number) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return 1 / Math.max(0.25, Math.min(8, safeZoom));
}
