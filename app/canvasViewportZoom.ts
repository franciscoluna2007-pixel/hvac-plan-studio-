export type ViewportPoint = { x: number; y: number };

export function normalizeWheelDelta({
  deltaX = 0,
  deltaY,
  deltaMode,
  viewportHeight = 800,
}: {
  deltaX?: number;
  deltaY: number;
  deltaMode: number;
  viewportHeight?: number;
}) {
  const vertical = Number.isFinite(deltaY) ? deltaY : 0;
  const horizontal = Number.isFinite(deltaX) ? deltaX : 0;
  const axisDelta = Math.abs(vertical) >= Math.abs(horizontal) ? vertical : horizontal;
  if (!axisDelta) return 0;
  const unit = deltaMode === 1
    ? 18
    : deltaMode === 2
      ? Math.min(180, Math.max(80, viewportHeight * 0.15))
      : 1;
  return Math.max(-360, Math.min(360, axisDelta * unit));
}

export function wheelZoomFactor({
  deltaX = 0,
  deltaY,
  deltaMode,
  ctrlKey,
  viewportHeight = 800,
}: {
  deltaX?: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  viewportHeight?: number;
}) {
  const delta = normalizeWheelDelta({ deltaX, deltaY, deltaMode, viewportHeight });
  const sensitivity = ctrlKey ? 0.004 : 0.0018;
  return Math.exp(-delta * sensitivity);
}

export function cameraForCursorZoom({
  camera,
  cursor,
  currentZoom,
  nextZoom,
}: {
  camera: ViewportPoint;
  cursor: ViewportPoint;
  currentZoom: number;
  nextZoom: number;
}) {
  const safeCurrentZoom = Number.isFinite(currentZoom) && currentZoom > 0
    ? currentZoom
    : 1;
  const safeNextZoom = Number.isFinite(nextZoom) && nextZoom > 0
    ? nextZoom
    : safeCurrentZoom;
  const planPoint = {
    x: (cursor.x - camera.x) / safeCurrentZoom,
    y: (cursor.y - camera.y) / safeCurrentZoom,
  };
  return {
    x: cursor.x - planPoint.x * safeNextZoom,
    y: cursor.y - planPoint.y * safeNextZoom,
  };
}
