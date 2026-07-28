export type RepairMutationAction = {
  id?: string;
  kind: "terminal-cfm" | "run-size" | "run-number";
  drawingId: string;
  affectedFittingIds?: string[];
};

export type DescribedRepairChange = {
  actionId: string;
  objectId: string;
  field: string;
  before: string;
  after: string;
};

export type RepairMutationViolation = {
  objectId: string;
  field: string;
  reason: string;
};

function valueChanged(left: unknown, right: unknown) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function fittingTopology(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const topology = { ...(value as Record<string, unknown>) };
  delete topology.upstreamSize;
  delete topology.downstreamSize;
  delete topology.branchSize;
  return topology;
}

function displayValue(value: unknown) {
  if (value == null || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Confirmed" : "Needs confirmation";
  return String(value);
}

function addDescribedChange(
  changes: DescribedRepairChange[],
  action: RepairMutationAction,
  objectId: string,
  field: string,
  before: unknown,
  after: unknown,
  suffix = "",
) {
  if (!valueChanged(before, after)) return;
  changes.push({
    actionId: action.id || `${action.kind}-${action.drawingId}`,
    objectId,
    field,
    before: `${displayValue(before)}${suffix}`,
    after: `${displayValue(after)}${suffix}`,
  });
}

/**
 * Describes the exact allowlisted fields changed by a completed simulation.
 * Receipt generation uses this output rather than trusting planned UI copy.
 */
export function describeRepairMutationChanges<T extends { id: string }>(
  before: T[],
  after: T[],
  actions: RepairMutationAction[],
): DescribedRepairChange[] {
  const beforeById = new Map(before.map((drawing) => [drawing.id, drawing as Record<string, unknown>]));
  const afterById = new Map(after.map((drawing) => [drawing.id, drawing as Record<string, unknown>]));
  const changes: DescribedRepairChange[] = [];

  actions.forEach((action) => {
    const left = beforeById.get(action.drawingId);
    const right = afterById.get(action.drawingId);
    if (!left || !right) return;
    if (action.kind === "terminal-cfm") {
      addDescribedChange(changes, action, action.drawingId, "CFM", left.cfm ?? 0, right.cfm ?? 0, " CFM");
      addDescribedChange(changes, action, action.drawingId, "CFM source", left.cfmSource, right.cfmSource);
      return;
    }
    if (action.kind === "run-number") {
      addDescribedChange(changes, action, action.drawingId, "Run number", left.runNumber, right.runNumber);
      return;
    }

    addDescribedChange(changes, action, action.drawingId, "Run size", left.size, right.size, '"');
    addDescribedChange(changes, action, action.drawingId, "Size review", left.sizeReviewed, right.sizeReviewed);
    (action.affectedFittingIds || []).forEach((fittingId) => {
      const beforeFittingDrawing = beforeById.get(fittingId);
      const afterFittingDrawing = afterById.get(fittingId);
      if (!beforeFittingDrawing || !afterFittingDrawing) return;
      addDescribedChange(
        changes,
        action,
        fittingId,
        "Fitting size label",
        beforeFittingDrawing.size,
        afterFittingDrawing.size,
      );
      const beforeFitting = beforeFittingDrawing.fitting as Record<string, unknown> | undefined;
      const afterFitting = afterFittingDrawing.fitting as Record<string, unknown> | undefined;
      ([
        ["upstreamSize", "Fitting upstream size"],
        ["downstreamSize", "Fitting downstream size"],
        ["branchSize", "Fitting branch size"],
      ] as const).forEach(([key, label]) => {
        addDescribedChange(
          changes,
          action,
          fittingId,
          label,
          beforeFitting?.[key],
          afterFitting?.[key],
          '"',
        );
      });
    });
  });

  return changes;
}

/**
 * Enforces a field-level allowlist after a repair batch is simulated. This is
 * deliberately independent of the UI and rejects the whole batch when any
 * object or field falls outside the reviewed effect.
 */
export function validateRepairMutationScope<T extends { id: string }>(
  before: T[],
  after: T[],
  actions: RepairMutationAction[],
): RepairMutationViolation[] {
  const beforeById = new Map(before.map((drawing) => [drawing.id, drawing]));
  const afterById = new Map(after.map((drawing) => [drawing.id, drawing]));
  const allowed = new Map<string, Set<string>>();

  actions.forEach((action) => {
    const fields = allowed.get(action.drawingId) || new Set<string>();
    if (action.kind === "terminal-cfm") {
      fields.add("cfm");
      fields.add("cfmSource");
    } else if (action.kind === "run-size") {
      fields.add("size");
      fields.add("sizeReviewed");
    } else {
      fields.add("runNumber");
    }
    allowed.set(action.drawingId, fields);
    if (action.kind === "run-size") {
      (action.affectedFittingIds || []).forEach((fittingId) => {
        const fittingFields = allowed.get(fittingId) || new Set<string>();
        fittingFields.add("size");
        fittingFields.add("fitting");
        allowed.set(fittingId, fittingFields);
      });
    }
  });

  const violations: RepairMutationViolation[] = [];
  const allIds = new Set([...beforeById.keys(), ...afterById.keys()]);
  allIds.forEach((id) => {
    const left = beforeById.get(id);
    const right = afterById.get(id);
    if (!left || !right) {
      violations.push({
        objectId: id,
        field: "object",
        reason: left ? "A repair removed a plan object." : "A repair created a plan object.",
      });
      return;
    }
    const allowedFields = allowed.get(id) || new Set<string>();
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const fields = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
    fields.delete("id");
    fields.forEach((field) => {
      const beforeValue = leftRecord[field];
      const afterValue = rightRecord[field];
      if (
        field === "fitting" &&
        allowedFields.has(field) &&
        valueChanged(fittingTopology(beforeValue), fittingTopology(afterValue))
      ) {
        violations.push({
          objectId: id,
          field: "fitting topology",
          reason: "A size fix attempted to change fitting connections or geometry.",
        });
        return;
      }
      if (valueChanged(beforeValue, afterValue) && !allowedFields.has(field)) {
        violations.push({
          objectId: id,
          field,
          reason: `The batch attempted an unreviewed ${field} change.`,
        });
      }
    });
  });
  return violations;
}
