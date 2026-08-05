export type ViewportPoint = { x: number; y: number };

export function wheelZoomFactor({
  deltaY,
  deltaMode,
  ctrlKey,
}: {
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
}) {
  const delta = deltaMode === 1 ? deltaY * 18 : deltaY;
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
