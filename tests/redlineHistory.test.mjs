import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescriptModule } from "./load-typescript-module.mjs";

const domain = await loadTypescriptModule(
  new URL("../app/redlineDomain.ts", import.meta.url),
);
const historyApi = await loadTypescriptModule(
  new URL("../app/redlineHistory.ts", import.meta.url),
);

const {
  createRedlineDocument,
  redlineDocumentFingerprint,
} = domain;
const {
  REDLINE_HISTORY_DEFAULT_MAX_BYTES,
  createRedlineHistory,
  executeRedlineCommand,
  redoRedlineHistory,
  redlineHistoryCanRedo,
  redlineHistoryCanUndo,
  redlineHistoryRetainedBytes,
  replaceRedlineHistorySelection,
  undoRedlineHistory,
} = historyApi;

function document() {
  return createRedlineDocument({
    sourceFingerprint: "history-pdf",
    pageCount: 2,
  });
}

function textCommand(text, x = 0.1) {
  return {
    type: "add-annotation",
    draft: {
      kind: "text",
      page: 1,
      start: { x, y: 0.1 },
      end: { x: x + 0.1, y: 0.2 },
      text,
    },
  };
}

test("uses an independent immutable undo/redo timeline", () => {
  const original = document();
  let history = createRedlineHistory(original, { limit: 5 });
  const first = executeRedlineCommand(history, textCommand("FIELD VERIFY"));
  assert.equal(first.changed, true);
  history = first.history;
  assert.equal(history.present.annotations.length, 1);
  assert.equal(original.annotations.length, 0);
  assert.equal(redlineHistoryCanUndo(history), true);
  assert.equal(redlineHistoryCanRedo(history), false);

  const second = executeRedlineCommand(
    history,
    textCommand("DO NOT COVER", 0.3),
  );
  history = second.history;
  assert.equal(history.present.annotations.length, 2);
  const twoFingerprint = redlineDocumentFingerprint(history.present);

  const undone = undoRedlineHistory(history);
  assert.equal(undone.changed, true);
  history = undone.history;
  assert.equal(history.present.annotations.length, 1);
  assert.equal(redlineHistoryCanRedo(history), true);

  const redone = redoRedlineHistory(history);
  assert.equal(redone.changed, true);
  history = redone.history;
  assert.equal(history.present.annotations.length, 2);
  assert.equal(redlineDocumentFingerprint(history.present), twoFingerprint);
});

test("caps history and clears redo after a divergent edit", () => {
  let history = createRedlineHistory(document(), 2);
  history = executeRedlineCommand(history, textCommand("ONE", 0.1)).history;
  history = executeRedlineCommand(history, textCommand("TWO", 0.3)).history;
  history = executeRedlineCommand(history, textCommand("THREE", 0.5)).history;
  assert.equal(history.past.length, 2);

  history = undoRedlineHistory(history).history;
  assert.equal(history.future.length, 1);
  history = executeRedlineCommand(history, textCommand("BRANCH", 0.7)).history;
  assert.equal(history.future.length, 0);
  assert.equal(redlineHistoryCanRedo(history), false);
});

test("does not create history for rejected or no-op commands", () => {
  const history = createRedlineHistory(document());
  const rejected = executeRedlineCommand(history, {
    type: "add-annotation",
    draft: {
      kind: "arrow",
      page: 99,
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
  });
  assert.equal(rejected.changed, false);
  assert.strictEqual(rejected.history, history);
  assert.equal(rejected.history.past.length, 0);
  assert.strictEqual(undoRedlineHistory(history).history, history);
  assert.strictEqual(redoRedlineHistory(history).history, history);
});

test("selection changes do not pollute the command timeline", () => {
  let history = createRedlineHistory(document());
  history = executeRedlineCommand(history, textCommand("SELECT ME")).history;
  const beforePast = history.past;
  const id = history.present.annotations[0].id;
  history = replaceRedlineHistorySelection(history, [id, id, "missing"]);
  assert.deepEqual(history.selection, [id]);
  assert.strictEqual(history.past, beforePast);
  assert.strictEqual(
    replaceRedlineHistorySelection(history, [id]),
    history,
  );
});

test("one eraser drag can delete many redlines and Undo restores them together", () => {
  let history = createRedlineHistory(document());
  history = executeRedlineCommand(history, textCommand("ONE", 0.1)).history;
  history = executeRedlineCommand(history, textCommand("TWO", 0.4)).history;
  const beforeErase = redlineDocumentFingerprint(history.present);
  const ids = history.present.annotations.map((annotation) => annotation.id);
  const pastCount = history.past.length;

  const erased = executeRedlineCommand(history, {
    type: "delete-selection",
    annotationIds: ids,
  });
  assert.equal(erased.changed, true, erased.reason);
  assert.equal(erased.history.present.annotations.length, 0);
  assert.equal(erased.history.past.length, pastCount + 1);

  const restored = undoRedlineHistory(erased.history);
  assert.equal(restored.changed, true);
  assert.equal(
    redlineDocumentFingerprint(restored.history.present),
    beforeErase,
  );
});

test("caps retained snapshot bytes in addition to command count", () => {
  const probe = executeRedlineCommand(
    createRedlineHistory(document()),
    textCommand("PROBE"),
  ).history;
  const oneEmptyDocumentEntry = redlineHistoryRetainedBytes(probe);
  assert.ok(oneEmptyDocumentEntry > 0);

  const maxBytes = oneEmptyDocumentEntry + 256;
  let history = createRedlineHistory(document(), {
    limit: 100,
    maxBytes,
  });
  for (let index = 0; index < 8; index += 1) {
    history = executeRedlineCommand(
      history,
      textCommand(`LARGE-${index}-${"x".repeat(1_000)}`, 0.05 + index * 0.05),
    ).history;
    assert.ok(redlineHistoryRetainedBytes(history) <= maxBytes);
  }
  assert.ok(history.past.length < 8);
  assert.equal(history.maxBytes, maxBytes);

  const disabledUndo = executeRedlineCommand(
    createRedlineHistory(document(), { maxBytes: 1 }),
    textCommand("DO NOT RETAIN"),
  ).history;
  assert.equal(disabledUndo.past.length, 0);
  assert.equal(redlineHistoryCanUndo(disabledUndo), false);
});

test("history objects without a byte limit upgrade without breaking old callers", () => {
  const legacy = createRedlineHistory(document(), 5);
  delete legacy.maxBytes;
  const next = executeRedlineCommand(legacy, textCommand("LEGACY")).history;
  assert.equal(next.maxBytes, REDLINE_HISTORY_DEFAULT_MAX_BYTES);
  assert.equal(next.past.length, 1);
});

test("scale and style commands each undo every selected annotation atomically", () => {
  let history = createRedlineHistory(document(), {
    limit: 10,
    maxBytes: 2 * 1024 * 1024,
  });
  history = executeRedlineCommand(history, {
    type: "add-annotation",
    draft: {
      kind: "rectangle",
      page: 1,
      start: { x: 0.1, y: 0.1 },
      end: { x: 0.3, y: 0.3 },
    },
  }).history;
  history = executeRedlineCommand(history, textCommand("ATOMIC", 0.4)).history;
  const ids = history.present.annotations.map((annotation) => annotation.id);
  history = replaceRedlineHistorySelection(history, ids);

  const beforeScale = redlineDocumentFingerprint(history.present);
  const scalePastCount = history.past.length;
  const scaled = executeRedlineCommand(history, {
    type: "scale-selection",
    annotationIds: ids,
    factor: 1.5,
  });
  assert.equal(scaled.changed, true, scaled.reason);
  assert.equal(scaled.history.past.length, scalePastCount + 1);
  assert.deepEqual(scaled.history.selection, ids);
  const afterScale = redlineDocumentFingerprint(scaled.history.present);
  assert.notEqual(afterScale, beforeScale);
  assert.equal(
    scaled.history.present.annotations.find(
      (annotation) => annotation.kind === "text",
    ).style.textScale,
    1.5,
  );

  const scaleUndone = undoRedlineHistory(scaled.history);
  assert.equal(scaleUndone.changed, true);
  assert.equal(
    redlineDocumentFingerprint(scaleUndone.history.present),
    beforeScale,
  );
  assert.deepEqual(scaleUndone.history.selection, ids);
  const scaleRedone = redoRedlineHistory(scaleUndone.history);
  assert.equal(
    redlineDocumentFingerprint(scaleRedone.history.present),
    afterScale,
  );

  const stylePastCount = scaleRedone.history.past.length;
  const styled = executeRedlineCommand(scaleRedone.history, {
    type: "update-selection-style",
    annotationIds: ids,
    changes: {
      color: "#123456",
      opacity: 0.5,
      strokeWidth: 0.008,
      textScale: 2,
    },
  });
  assert.equal(styled.changed, true, styled.reason);
  assert.equal(styled.history.past.length, stylePastCount + 1);
  assert.ok(styled.history.present.annotations.every((annotation) =>
    annotation.style.color === "#123456" &&
    annotation.style.opacity === 0.5 &&
    annotation.style.strokeWidth === 0.008));
  assert.equal(
    styled.history.present.annotations.find(
      (annotation) => annotation.kind === "text",
    ).style.textScale,
    2,
  );

  const styleUndone = undoRedlineHistory(styled.history);
  assert.equal(styleUndone.changed, true);
  assert.equal(
    redlineDocumentFingerprint(styleUndone.history.present),
    afterScale,
  );
  assert.deepEqual(styleUndone.history.selection, ids);
});
