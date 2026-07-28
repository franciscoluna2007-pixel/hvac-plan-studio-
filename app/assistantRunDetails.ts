export type RunNumberSource = {
  id: string;
  type: "supply" | "return";
  page: number;
  size: string;
  roomName?: string;
  runNumber?: string;
  terminalLinked: boolean;
  firstPoint?: { x: number; y: number };
};

export type RunNumberCandidate = {
  id: string;
  drawingId: string;
  type: "supply" | "return";
  page: number;
  room: string;
  size: string;
  currentRunNumber: string;
  proposedRunNumber: string;
  terminalLinked: true;
  duplicateExistingNumber: boolean;
  evidenceFingerprint: string;
};

export type RunNumberEdit = Pick<
  RunNumberCandidate,
  "drawingId" | "currentRunNumber" | "proposedRunNumber" | "evidenceFingerprint"
>;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizedRunNumber(value?: string) {
  return value?.trim().toUpperCase() || "";
}

function compareRuns(left: RunNumberSource, right: RunNumberSource) {
  return (
    left.page - right.page ||
    (left.firstPoint?.y || 0) - (right.firstPoint?.y || 0) ||
    (left.firstPoint?.x || 0) - (right.firstPoint?.x || 0) ||
    left.id.localeCompare(right.id)
  );
}

export function runNumberEvidenceFingerprint(source: Pick<
  RunNumberSource,
  "id" | "type" | "page" | "size" | "runNumber" | "terminalLinked"
>) {
  return stableHash(JSON.stringify({
    id: source.id,
    type: source.type,
    page: source.page,
    size: source.size,
    runNumber: normalizedRunNumber(source.runNumber),
    terminalLinked: source.terminalLinked,
  }));
}

/**
 * Produces deterministic F/R labels only for terminal-linked legs. Existing
 * labels are preserved, comparisons are case-insensitive, and duplicates are
 * surfaced for manual resolution instead of silently resequenced.
 */
export function buildRunNumberCandidates(runs: RunNumberSource[]): RunNumberCandidate[] {
  const terminalRuns = runs.filter((run): run is RunNumberSource & { terminalLinked: true } =>
    run.terminalLinked
  );
  const existingCounts = new Map<string, number>();
  runs.forEach((run) => {
    const number = normalizedRunNumber(run.runNumber);
    if (number) existingCounts.set(number, (existingCounts.get(number) || 0) + 1);
  });
  const used = new Set(existingCounts.keys());
  const candidates: RunNumberCandidate[] = [];

  (["supply", "return"] as const).forEach((type) => {
    const prefix = type === "supply" ? "F" : "R";
    let nextNumber = 1;
    terminalRuns
      .filter((run) => run.type === type)
      .slice()
      .sort(compareRuns)
      .forEach((run) => {
        const currentRunNumber = normalizedRunNumber(run.runNumber);
        const duplicateExistingNumber = Boolean(
          currentRunNumber && (existingCounts.get(currentRunNumber) || 0) > 1
        );
        let proposedRunNumber = currentRunNumber;
        if (!currentRunNumber) {
          while (used.has(`${prefix}${nextNumber}`)) nextNumber += 1;
          proposedRunNumber = `${prefix}${nextNumber}`;
          used.add(proposedRunNumber);
          nextNumber += 1;
        }
        if (!currentRunNumber || duplicateExistingNumber) {
          const evidenceFingerprint = runNumberEvidenceFingerprint(run);
          candidates.push({
            id: `run-number-${run.id}`,
            drawingId: run.id,
            type,
            page: run.page,
            room: run.roomName?.trim() || `Sheet ${run.page}`,
            size: run.size,
            currentRunNumber,
            proposedRunNumber,
            terminalLinked: true,
            duplicateExistingNumber,
            evidenceFingerprint,
          });
        }
      });
  });

  return candidates;
}

export function applyRunNumberEdits<T extends {
  id: string;
  runNumber?: string;
}>(drawings: T[], edits: RunNumberEdit[]): T[] {
  const editById = new Map(edits.map((edit) => [edit.drawingId, edit]));
  if (editById.size !== edits.length) throw new Error("A run-number edit was included more than once.");

  const used = new Map<string, string>();
  drawings.forEach((drawing) => {
    const number = normalizedRunNumber(drawing.runNumber);
    if (!number) return;
    if (!used.has(number)) used.set(number, drawing.id);
  });

  edits.forEach((edit) => {
    const drawing = drawings.find((candidate) => candidate.id === edit.drawingId);
    if (!drawing) throw new Error("A reviewed run no longer exists.");
    const current = normalizedRunNumber(drawing.runNumber);
    if (current !== normalizedRunNumber(edit.currentRunNumber) || current) {
      throw new Error("A reviewed run number is stale or would overwrite an existing label.");
    }
    const proposed = normalizedRunNumber(edit.proposedRunNumber);
    if (!proposed) throw new Error("A proposed run number is empty.");
    if (used.has(proposed)) throw new Error(`Run number already exists: ${proposed}`);
    used.set(proposed, drawing.id);
  });

  return drawings.map((drawing) => {
    const edit = editById.get(drawing.id);
    return edit ? { ...drawing, runNumber: normalizedRunNumber(edit.proposedRunNumber) } : drawing;
  });
}
