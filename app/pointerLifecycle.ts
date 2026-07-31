export type CanvasPointerOwner = "plan" | "redline";

export function latchCanvasPointerOwner(
  owners: Map<number, CanvasPointerOwner>,
  pointerId: number,
  owner: CanvasPointerOwner,
) {
  const existing = owners.get(pointerId);
  if (existing) return existing;
  owners.set(pointerId, owner);
  return owner;
}

export function canvasPointerOwner(
  owners: ReadonlyMap<number, CanvasPointerOwner>,
  pointerId: number,
  fallback: CanvasPointerOwner,
) {
  return owners.get(pointerId) || fallback;
}

export function releaseCanvasPointerOwner(
  owners: Map<number, CanvasPointerOwner>,
  pointerId: number,
) {
  const owner = owners.get(pointerId);
  owners.delete(pointerId);
  return owner;
}

export function releaseCanvasPointersByOwner(
  owners: Map<number, CanvasPointerOwner>,
  owner: CanvasPointerOwner,
) {
  for (const [pointerId, currentOwner] of owners) {
    if (currentOwner === owner) owners.delete(pointerId);
  }
}

export function shouldCancelStaleRedlinePointerMove(input: {
  activePointerId: number | null;
  eventPointerId: number;
  pointerType: string;
  buttons: number;
  pressure: number;
}) {
  return (
    input.activePointerId === input.eventPointerId &&
    input.pointerType !== "touch" &&
    input.buttons === 0 &&
    input.pressure <= 0
  );
}

export function shouldCompleteStalePlanPointerMove(input: {
  activeEditPointerId: number | null;
  eventPointerId: number;
  pointerType: string;
  buttons: number;
  pressure: number;
}) {
  return (
    input.activeEditPointerId === input.eventPointerId &&
    input.pointerType !== "touch" &&
    input.buttons === 0 &&
    input.pressure <= 0
  );
}
