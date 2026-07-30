export type PlanCopyPoint = {
  x: number;
  y: number;
};

export type StandalonePlanCopyDrawing = {
  id: string;
  type: string;
  points: PlanCopyPoint[];
  page: number;
  size: string;
  symbol?: {
    connectedRunId?: string;
    connectedEnd?: "start" | "end";
    returnRunId?: string;
    returnEnd?: "start" | "end";
    roomMarkup?: unknown;
    [key: string]: unknown;
  };
  measurement?: {
    feet: number;
    [key: string]: unknown;
  };
  roomName?: string;
  roomType?: string;
  runNumber?: string;
  cfmSource?: string;
  systemId?: string;
  [key: string]: unknown;
};

export type StandalonePlanCopyTemplate<
  T extends StandalonePlanCopyDrawing = StandalonePlanCopyDrawing,
> = {
  version: 1;
  sourceFingerprint: string;
  sourcePage: number;
  anchor: PlanCopyPoint;
  source: T;
};

export type StandalonePlanCopyDestination = {
  sourceFingerprint: string;
  page: number;
  point: PlanCopyPoint;
  id: string;
  systemId?: string;
  feetPerUnit?: number;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function boundsCenter(points: readonly PlanCopyPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

export function isStandalonePlanCopyDrawing(
  drawing: StandalonePlanCopyDrawing,
) {
  return Boolean(
    drawing.points.length &&
    (drawing.symbol || drawing.measurement),
  );
}

export function buildStandalonePlanCopyTemplate<
  T extends StandalonePlanCopyDrawing,
>(
  drawing: T,
  sourceFingerprint: string,
): StandalonePlanCopyTemplate<T> | null {
  if (!sourceFingerprint || !isStandalonePlanCopyDrawing(drawing)) return null;
  const source = clone(drawing);
  return {
    version: 1,
    sourceFingerprint,
    sourcePage: source.page,
    anchor: boundsCenter(source.points),
    source,
  };
}

export function materializeStandalonePlanCopy<
  T extends StandalonePlanCopyDrawing,
>(
  template: StandalonePlanCopyTemplate<T>,
  destination: StandalonePlanCopyDestination,
): T | null {
  if (
    !destination.sourceFingerprint ||
    destination.sourceFingerprint !== template.sourceFingerprint ||
    !Number.isFinite(destination.point.x) ||
    !Number.isFinite(destination.point.y)
  ) {
    return null;
  }

  const drawing = clone(template.source);
  const delta = {
    x: destination.point.x - template.anchor.x,
    y: destination.point.y - template.anchor.y,
  };
  drawing.id = destination.id;
  drawing.page = destination.page;
  drawing.points = drawing.points.map((point) => ({
    x: point.x + delta.x,
    y: point.y + delta.y,
  }));
  drawing.systemId = destination.systemId || drawing.systemId;
  delete drawing.roomName;
  delete drawing.roomType;
  delete drawing.runNumber;

  if (drawing.symbol) {
    delete drawing.symbol.connectedRunId;
    delete drawing.symbol.connectedEnd;
    delete drawing.symbol.returnRunId;
    delete drawing.symbol.returnEnd;
    delete drawing.symbol.roomMarkup;
    if (drawing.cfmSource === "room-target") {
      drawing.cfmSource = "planning-seed";
    }
  }

  if (
    drawing.measurement &&
    Number.isFinite(destination.feetPerUnit) &&
    (destination.feetPerUnit || 0) > 0 &&
    drawing.points.length >= 2
  ) {
    const [start, end] = drawing.points;
    const feet =
      Math.hypot(end.x - start.x, end.y - start.y) *
      destination.feetPerUnit!;
    drawing.measurement.feet = feet;
    drawing.size = `${feet.toFixed(1)} FT`;
  }

  return drawing;
}
