export const TAKEOFF_INTELLIGENCE_VERSION = "takeoff-intelligence-v114.0";

export type TakeoffRunQuantity = {
  id: string;
  type: "supply" | "return" | "fresh";
  size: string;
  measuredLengthFeet: number;
};

export type TakeoffSizeChange = {
  drawingId: string;
  proposedSize: string;
};

export type TakeoffDeltaRow = {
  key: string;
  type: TakeoffRunQuantity["type"];
  size: string;
  beforeMeasuredFeet: number;
  afterMeasuredFeet: number;
  deltaMeasuredFeet: number;
  beforeOrderFeet: number;
  afterOrderFeet: number;
  beforeBoxes: number;
  afterBoxes: number;
  deltaBoxes: number;
};

export type TakeoffImpact = {
  version: typeof TAKEOFF_INTELLIGENCE_VERSION;
  wastePercent: number;
  boxLengthFeet: number;
  rows: TakeoffDeltaRow[];
  changedRows: number;
  boxesBefore: number;
  boxesAfter: number;
  measuredLengthBefore: number;
  measuredLengthAfter: number;
  affectedFittings: number;
  holds: string[];
};

function normalizeLength(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function orderFeet(measuredFeet: number, wastePercent: number) {
  return measuredFeet * (1 + Math.max(0, wastePercent) / 100);
}

function boxes(measuredFeet: number, wastePercent: number, boxLengthFeet: number) {
  const ordered = orderFeet(measuredFeet, wastePercent);
  return ordered > 0 ? Math.ceil(ordered / boxLengthFeet) : 0;
}

export function buildTakeoffImpact(input: {
  runs: TakeoffRunQuantity[];
  afterRuns?: TakeoffRunQuantity[];
  sizeChanges: TakeoffSizeChange[];
  wastePercent: number;
  boxLengthFeet?: number;
  affectedFittingIds?: string[];
  holds?: string[];
}): TakeoffImpact {
  const boxLengthFeet = Math.max(1, input.boxLengthFeet || 25);
  const changes = new Map(input.sizeChanges.map((change) => [change.drawingId, change.proposedSize]));
  const before = new Map<string, { type: TakeoffRunQuantity["type"]; size: string; length: number }>();
  const after = new Map<string, { type: TakeoffRunQuantity["type"]; size: string; length: number }>();
  const add = (
    target: Map<string, { type: TakeoffRunQuantity["type"]; size: string; length: number }>,
    type: TakeoffRunQuantity["type"],
    size: string,
    length: number,
  ) => {
    const key = `${type}:${size}`;
    const current = target.get(key) || { type, size, length: 0 };
    current.length += normalizeLength(length);
    target.set(key, current);
  };
  input.runs.forEach((run) => {
    add(before, run.type, run.size, run.measuredLengthFeet);
  });
  (input.afterRuns || input.runs).forEach((run) => {
    add(after, run.type, changes.get(run.id) || run.size, run.measuredLengthFeet);
  });
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort((left, right) => {
    const [leftType, leftSize] = left.split(":");
    const [rightType, rightSize] = right.split(":");
    return leftType.localeCompare(rightType) || Number(rightSize) - Number(leftSize);
  });
  const rows = keys.map((key) => {
    const beforeRow = before.get(key);
    const afterRow = after.get(key);
    const type = (beforeRow?.type || afterRow?.type || "supply") as TakeoffRunQuantity["type"];
    const size = beforeRow?.size || afterRow?.size || "";
    const beforeMeasuredFeet = beforeRow?.length || 0;
    const afterMeasuredFeet = afterRow?.length || 0;
    const beforeOrderFeet = orderFeet(beforeMeasuredFeet, input.wastePercent);
    const afterOrderFeet = orderFeet(afterMeasuredFeet, input.wastePercent);
    const beforeBoxes = boxes(beforeMeasuredFeet, input.wastePercent, boxLengthFeet);
    const afterBoxes = boxes(afterMeasuredFeet, input.wastePercent, boxLengthFeet);
    return {
      key,
      type,
      size,
      beforeMeasuredFeet,
      afterMeasuredFeet,
      deltaMeasuredFeet: afterMeasuredFeet - beforeMeasuredFeet,
      beforeOrderFeet,
      afterOrderFeet,
      beforeBoxes,
      afterBoxes,
      deltaBoxes: afterBoxes - beforeBoxes,
    };
  });
  return {
    version: TAKEOFF_INTELLIGENCE_VERSION,
    wastePercent: input.wastePercent,
    boxLengthFeet,
    rows,
    changedRows: rows.filter((row) =>
      Math.abs(row.deltaMeasuredFeet) > .01 || row.deltaBoxes !== 0
    ).length,
    boxesBefore: rows.reduce((total, row) => total + row.beforeBoxes, 0),
    boxesAfter: rows.reduce((total, row) => total + row.afterBoxes, 0),
    measuredLengthBefore: input.runs.reduce((total, run) => total + normalizeLength(run.measuredLengthFeet), 0),
    measuredLengthAfter: (input.afterRuns || input.runs).reduce((total, run) => total + normalizeLength(run.measuredLengthFeet), 0),
    affectedFittings: new Set(input.affectedFittingIds || []).size,
    holds: [...new Set(input.holds || [])],
  };
}
