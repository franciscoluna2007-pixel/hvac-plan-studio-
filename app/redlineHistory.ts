import {
  applyRedlineCommand,
  redlineDocumentFingerprint,
  type RedlineCommand,
  type RedlineDocument,
  type RedlineOperationResult,
} from "./redlineDomain";

export const REDLINE_HISTORY_DEFAULT_LIMIT = 100;
export const REDLINE_HISTORY_MAX_LIMIT = 200;
export const REDLINE_HISTORY_DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
export const REDLINE_HISTORY_MAX_BYTES = 64 * 1024 * 1024;

export type RedlineHistoryEntry = {
  document: RedlineDocument;
  selection: string[];
  fingerprint: string;
  commandType: RedlineCommand["type"] | "initial";
  label: string;
};

export type RedlineHistory = {
  present: RedlineDocument;
  selection: string[];
  past: RedlineHistoryEntry[];
  future: RedlineHistoryEntry[];
  limit: number;
  /** Optional so history objects created before the byte cap remain compatible. */
  maxBytes?: number;
};

export type RedlineHistoryTransition = {
  history: RedlineHistory;
  changed: boolean;
  reason: string;
  operation?: RedlineOperationResult;
};

function normalizedLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) return REDLINE_HISTORY_DEFAULT_LIMIT;
  return Math.max(
    1,
    Math.min(REDLINE_HISTORY_MAX_LIMIT, Math.trunc(limit!)),
  );
}

function normalizedMaxBytes(maxBytes: number | undefined) {
  if (!Number.isFinite(maxBytes)) return REDLINE_HISTORY_DEFAULT_MAX_BYTES;
  return Math.max(
    1,
    Math.min(REDLINE_HISTORY_MAX_BYTES, Math.trunc(maxBytes!)),
  );
}

function approximateUtf8Bytes(value: unknown) {
  let serialized = "";
  try {
    serialized = JSON.stringify(value) || "";
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
  let bytes = 0;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = serialized.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

const entryByteCache = new WeakMap<RedlineHistoryEntry, number>();

function approximateEntryBytes(item: RedlineHistoryEntry) {
  const cached = entryByteCache.get(item);
  if (cached != null) return cached;
  const bytes = approximateUtf8Bytes({
    document: item.document,
    selection: item.selection,
    fingerprint: item.fingerprint,
    commandType: item.commandType,
    label: item.label,
  });
  entryByteCache.set(item, bytes);
  return bytes;
}

function boundedTimeline(
  past: readonly RedlineHistoryEntry[],
  future: readonly RedlineHistoryEntry[],
  limit: number,
  maxBytes: number,
) {
  const nextPast = past.slice(-limit);
  const nextFuture = future.slice(0, limit);
  const pastSizes = nextPast.map(approximateEntryBytes);
  const futureSizes = nextFuture.map(approximateEntryBytes);
  let retainedBytes = [...pastSizes, ...futureSizes].reduce(
    (total, size) => total + size,
    0,
  );

  while (retainedBytes > maxBytes && (nextPast.length || nextFuture.length)) {
    // Keep the closest undo and redo snapshots. The oldest past entry and the
    // furthest future entry are the least useful candidates to discard.
    if (!nextFuture.length || nextPast.length >= nextFuture.length) {
      nextPast.shift();
      retainedBytes -= pastSizes.shift() || 0;
    } else {
      nextFuture.pop();
      retainedBytes -= futureSizes.pop() || 0;
    }
  }
  return { past: nextPast, future: nextFuture };
}

function entry(
  document: RedlineDocument,
  selection: readonly string[],
  commandType: RedlineHistoryEntry["commandType"],
  label: string,
): RedlineHistoryEntry {
  return {
    document,
    selection: [...selection],
    fingerprint: redlineDocumentFingerprint(document),
    commandType,
    label,
  };
}

export function createRedlineHistory(
  document: RedlineDocument,
  options: number | {
    limit?: number;
    maxBytes?: number;
    selection?: readonly string[];
  } = {},
): RedlineHistory {
  const resolved = typeof options === "number" ? { limit: options } : options;
  return {
    present: document,
    selection: [...(resolved.selection || [])],
    past: [],
    future: [],
    limit: normalizedLimit(resolved.limit),
    maxBytes: normalizedMaxBytes(resolved.maxBytes),
  };
}

export function executeRedlineCommand(
  history: RedlineHistory,
  command: RedlineCommand,
): RedlineHistoryTransition {
  const operation = applyRedlineCommand(history.present, command);
  if (!operation.changed) {
    return {
      history,
      changed: false,
      reason: operation.reason,
      operation,
    };
  }
  const previous = entry(
    history.present,
    history.selection,
    command.type,
    operation.reason,
  );
  const limit = normalizedLimit(history.limit);
  const maxBytes = normalizedMaxBytes(history.maxBytes);
  const timeline = boundedTimeline(
    [...history.past, previous],
    [],
    limit,
    maxBytes,
  );
  return {
    history: {
      ...history,
      present: operation.document,
      selection: [...operation.selection],
      past: timeline.past,
      future: timeline.future,
      limit,
      maxBytes,
    },
    changed: true,
    reason: operation.reason,
    operation,
  };
}

export const commitRedlineCommand = executeRedlineCommand;

export function undoRedlineHistory(
  history: RedlineHistory,
): RedlineHistoryTransition {
  const previous = history.past.at(-1);
  if (!previous) {
    return {
      history,
      changed: false,
      reason: "No Field Redline Studio change to undo.",
    };
  }
  const current = entry(
    history.present,
    history.selection,
    previous.commandType,
    previous.label,
  );
  const limit = normalizedLimit(history.limit);
  const maxBytes = normalizedMaxBytes(history.maxBytes);
  const timeline = boundedTimeline(
    history.past.slice(0, -1),
    [current, ...history.future],
    limit,
    maxBytes,
  );
  return {
    history: {
      ...history,
      present: previous.document,
      selection: [...previous.selection],
      past: timeline.past,
      future: timeline.future,
      limit,
      maxBytes,
    },
    changed: true,
    reason: `Undid: ${previous.label}`,
  };
}

export function redoRedlineHistory(
  history: RedlineHistory,
): RedlineHistoryTransition {
  const next = history.future[0];
  if (!next) {
    return {
      history,
      changed: false,
      reason: "No Field Redline Studio change to redo.",
    };
  }
  const current = entry(
    history.present,
    history.selection,
    next.commandType,
    next.label,
  );
  const limit = normalizedLimit(history.limit);
  const maxBytes = normalizedMaxBytes(history.maxBytes);
  const timeline = boundedTimeline(
    [...history.past, current],
    history.future.slice(1),
    limit,
    maxBytes,
  );
  return {
    history: {
      ...history,
      present: next.document,
      selection: [...next.selection],
      past: timeline.past,
      future: timeline.future,
      limit,
      maxBytes,
    },
    changed: true,
    reason: `Redid: ${next.label}`,
  };
}

export const undoRedline = undoRedlineHistory;
export const redoRedline = redoRedlineHistory;

export function redlineHistoryCanUndo(history: RedlineHistory) {
  return history.past.length > 0;
}

export function redlineHistoryCanRedo(history: RedlineHistory) {
  return history.future.length > 0;
}

export function redlineHistoryRetainedBytes(history: RedlineHistory) {
  return [...history.past, ...history.future].reduce(
    (total, item) => total + approximateEntryBytes(item),
    0,
  );
}

export function replaceRedlineHistorySelection(
  history: RedlineHistory,
  annotationIds: readonly string[],
): RedlineHistory {
  const existingIds = new Set(
    history.present.annotations.map((annotation) => annotation.id),
  );
  const seen = new Set<string>();
  const selection = annotationIds.filter((id) => {
    if (!existingIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (
    selection.length === history.selection.length &&
    selection.every((id, index) => id === history.selection[index])
  ) {
    return history;
  }
  return { ...history, selection };
}
