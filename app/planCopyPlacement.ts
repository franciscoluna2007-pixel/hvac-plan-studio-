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
  rigid?: unknown;
  fitting?: {
    connectedIds: string[];
    [key: string]: unknown;
  };
  roomName?: string;
  roomType?: string;
  runNumber?: string;
  cfmSource?: string;
  systemId?: string;
  [key: string]: unknown;
};

export type PlanAssemblyCopyTemplate<
  T extends StandalonePlanCopyDrawing = StandalonePlanCopyDrawing,
> = {
  version: 2;
  sourceFingerprint: string;
  sourcePage: number;
  anchor: PlanCopyPoint;
  sources: T[];
};

export type PlanCopyTemplate<
  T extends StandalonePlanCopyDrawing = StandalonePlanCopyDrawing,
> = StandalonePlanCopyTemplate<T> | PlanAssemblyCopyTemplate<T>;

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

function assemblyDrawingIds<T extends StandalonePlanCopyDrawing>(
  drawings: readonly T[],
  seedIds: readonly string[],
) {
  const byId = new Map(drawings.map((drawing) => [drawing.id, drawing]));
  const selected = new Set(seedIds.filter((id) => byId.has(id)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const drawing of drawings) {
      if (!drawing.fitting) continue;
      const linked = [drawing.id, ...drawing.fitting.connectedIds]
        .filter((id) => byId.has(id));
      if (!linked.some((id) => selected.has(id))) continue;
      for (const id of linked) {
        if (selected.has(id)) continue;
        selected.add(id);
        changed = true;
      }
    }
  }
  for (const drawing of drawings) {
    if (!drawing.symbol) continue;
    if (
      (drawing.symbol.connectedRunId && selected.has(drawing.symbol.connectedRunId)) ||
      (drawing.symbol.returnRunId && selected.has(drawing.symbol.returnRunId))
    ) selected.add(drawing.id);
  }
  return selected;
}

export function buildPlanAssemblyCopyTemplate<
  T extends StandalonePlanCopyDrawing,
>(
  drawings: readonly T[],
  seedIds: readonly string[],
  sourceFingerprint: string,
): PlanAssemblyCopyTemplate<T> | null {
  if (!sourceFingerprint || !seedIds.length) return null;
  const sourcePage = drawings.find((drawing) => seedIds.includes(drawing.id))?.page;
  if (!sourcePage) return null;
  const ids = assemblyDrawingIds(
    drawings.filter((drawing) => drawing.page === sourcePage),
    seedIds,
  );
  const sources = drawings
    .filter((drawing) => drawing.page === sourcePage && ids.has(drawing.id))
    .filter((drawing) =>
      ["supply", "return"].includes(drawing.type) ||
      Boolean(drawing.fitting) ||
      Boolean(drawing.symbol))
    .map(clone);
  if (!sources.some((drawing) => ["supply", "return"].includes(drawing.type))) return null;
  const points = sources.flatMap((drawing) => drawing.points);
  if (!points.length) return null;
  return {
    version: 2,
    sourceFingerprint,
    sourcePage,
    anchor: boundsCenter(points),
    sources,
  };
}

export function materializePlanAssemblyCopy<
  T extends StandalonePlanCopyDrawing,
>(
  template: PlanAssemblyCopyTemplate<T>,
  destination: Omit<StandalonePlanCopyDestination, "id"> & {
    idFor: (sourceId: string, index: number) => string;
  },
): T[] | null {
  if (
    !destination.sourceFingerprint ||
    destination.sourceFingerprint !== template.sourceFingerprint ||
    !Number.isFinite(destination.point.x) ||
    !Number.isFinite(destination.point.y)
  ) return null;
  const delta = {
    x: destination.point.x - template.anchor.x,
    y: destination.point.y - template.anchor.y,
  };
  const idMap = new Map(template.sources.map((drawing, index) => [
    drawing.id,
    destination.idFor(drawing.id, index),
  ]));
  return template.sources.map((source) => {
    const drawing = clone(source);
    drawing.id = idMap.get(source.id)!;
    drawing.page = destination.page;
    drawing.systemId = destination.systemId || drawing.systemId;
    drawing.points = drawing.points.map((point) => ({
      x: point.x + delta.x,
      y: point.y + delta.y,
    }));
    if (drawing.fitting) {
      drawing.fitting.connectedIds = drawing.fitting.connectedIds.map((id) =>
        idMap.get(id) || "");
    }
    if (drawing.symbol) {
      drawing.symbol.connectedRunId = drawing.symbol.connectedRunId
        ? idMap.get(drawing.symbol.connectedRunId)
        : undefined;
      drawing.symbol.returnRunId = drawing.symbol.returnRunId
        ? idMap.get(drawing.symbol.returnRunId)
        : undefined;
      delete drawing.symbol.roomMarkup;
    }
    return drawing;
  });
}

export function isStandalonePlanCopyDrawing(
  drawing: StandalonePlanCopyDrawing,
) {
  return Boolean(
    drawing.points.length &&
    (drawing.symbol || drawing.measurement || drawing.rigid),
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
