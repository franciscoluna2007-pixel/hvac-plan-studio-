export type RotationPoint = { x: number; y: number };

export type RotatableFittingMeta = {
  angle: number;
  branchAngle?: number;
  side: 1 | -1;
  style?: "wye45" | "tee90";
  connectedIds: string[];
};

export type RotatableFittingDrawing = {
  id: string;
  points: RotationPoint[];
  fitting?: RotatableFittingMeta;
};

function normalizedAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function freeFittingRotationAngle(
  center: RotationPoint,
  pointer: RotationPoint,
  fallback: number,
) {
  const dx = pointer.x - center.x;
  const dy = pointer.y - center.y;
  return Math.hypot(dx, dy) < 0.001 ? fallback : Math.atan2(dy, dx);
}

export function fittingMainAngleForBranchHandle({
  center,
  pointer,
  mainAngle,
  branchAngle,
}: {
  center: RotationPoint;
  pointer: RotationPoint;
  mainAngle: number;
  branchAngle: number;
}) {
  const desiredBranchAngle = freeFittingRotationAngle(center, pointer, branchAngle);
  return mainAngle + normalizedAngle(desiredBranchAngle - branchAngle);
}

export function rotateFittingNetwork<T extends RotatableFittingDrawing>({
  drawings,
  fittingId,
  nextAngle,
  portsFor,
}: {
  drawings: readonly T[];
  fittingId: string;
  nextAngle: number;
  portsFor: (drawing: T) => readonly RotationPoint[];
}): T[] {
  const fitting = drawings.find((drawing) => drawing.id === fittingId);
  if (!fitting?.fitting || !Number.isFinite(nextAngle)) return [...drawings];
  const previousPorts = portsFor(fitting);
  const delta = normalizedAngle(nextAngle - fitting.fitting.angle);
  const currentBranchAngle = fitting.fitting.branchAngle ??
    fitting.fitting.angle + fitting.fitting.side *
      (fitting.fitting.style === "tee90" ? Math.PI / 2 : Math.PI / 4);
  const rotated = {
    ...fitting,
    fitting: {
      ...fitting.fitting,
      angle: nextAngle,
      branchAngle: currentBranchAngle + delta,
    },
  } as T;
  const nextPorts = portsFor(rotated);

  return drawings.map((drawing) => {
    if (drawing.id === fittingId) return rotated;
    const port = fitting.fitting!.connectedIds.indexOf(drawing.id);
    if (port < 0 || drawing.points.length < 2 || !previousPorts[port] || !nextPorts[port]) {
      return drawing;
    }
    const lastIndex = drawing.points.length - 1;
    const startDistance = Math.hypot(
      drawing.points[0].x - previousPorts[port].x,
      drawing.points[0].y - previousPorts[port].y,
    );
    const endDistance = Math.hypot(
      drawing.points[lastIndex].x - previousPorts[port].x,
      drawing.points[lastIndex].y - previousPorts[port].y,
    );
    const endpointIndex = startDistance <= endDistance ? 0 : lastIndex;
    return {
      ...drawing,
      points: drawing.points.map((point, index) =>
        index === endpointIndex ? { ...nextPorts[port] } : point),
    } as T;
  });
}
