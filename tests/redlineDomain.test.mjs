import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescriptModule } from "./load-typescript-module.mjs";

const redline = await loadTypescriptModule(
  new URL("../app/redlineDomain.ts", import.meta.url),
);

const {
  REDLINE_DOCUMENT_SCHEMA,
  REDLINE_POLICY_LIMITS,
  alignRedlineSelection,
  applyRedlineCommand,
  canonicalRedlineJson,
  createRedlineDocument,
  createRedlineSnapshot,
  deleteRedlineSelection,
  distributeRedlineSelection,
  duplicateRedlineSelection,
  groupRedlineSelection,
  parseRedlineSnapshot,
  redlineDocumentFingerprint,
  redlineSelectionBounds,
  rotateRedlineSelection,
  saveRedlineMyDetail,
  placeRedlineMyDetail,
  sanitizeRedlineDocument,
  serializeRedlineSnapshot,
  visibleRedlineAnnotations,
} = redline;

function fresh() {
  return createRedlineDocument({
    sourceFingerprint: "pdf-fingerprint-a",
    pageCount: 3,
    title: "Smith Residence",
  });
}

function add(document, draft) {
  const result = applyRedlineCommand(document, {
    type: "add-annotation",
    draft,
  });
  assert.equal(result.changed, true, result.reason);
  return result;
}

test("creates a separate annotation-only document with strict PDF binding", () => {
  const document = fresh();
  assert.equal(document.schema, REDLINE_DOCUMENT_SCHEMA);
  assert.deepEqual(document.binding, {
    sourceFingerprint: "pdf-fingerprint-a",
    pageCount: 3,
  });
  assert.equal(document.layers[0].name, "Field Redlines");
  assert.equal(document.annotations.length, 0);
  assert.doesNotMatch(
    canonicalRedlineJson(document),
    /"(?:cfm|size|connection|systemId|equipmentId)":/i,
  );
  assert.throws(
    () => createRedlineDocument({ sourceFingerprint: "", pageCount: 1 }),
    /fingerprint/i,
  );
});

test("adds every ink and callout kind in normalized page coordinates", () => {
  let document = fresh();
  const drafts = [
    {
      kind: "ink",
      page: 1,
      points: [{ x: -0.2, y: 0.2, pressure: 2 }, { x: 0.4, y: 1.2 }],
    },
    {
      kind: "highlighter",
      page: 1,
      points: [{ x: 0.1, y: 0.3 }, { x: 0.8, y: 0.3 }],
    },
    ...["arrow", "rectangle", "circle", "cloud", "text"].map((kind) => ({
      kind,
      page: 1,
      start: { x: 0.2, y: 0.2 },
      end: { x: 0.4, y: 0.4 },
      ...(kind === "text" ? { text: "FIELD VERIFY" } : {}),
    })),
  ];
  for (const draft of drafts) document = add(document, draft).document;
  assert.deepEqual(
    document.annotations.map((annotation) => annotation.kind),
    ["ink", "highlighter", "arrow", "rectangle", "circle", "cloud", "text"],
  );
  assert.deepEqual(document.annotations[0].points[0], {
    x: 0,
    y: 0.2,
    pressure: 1,
  });
  assert.ok(document.annotations.every((annotation) =>
    annotation.binding.sourceFingerprint === "pdf-fingerprint-a" &&
    annotation.binding.page === 1));

  const invalidPage = applyRedlineCommand(document, {
    type: "add-annotation",
    draft: {
      kind: "arrow",
      page: 4,
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
  });
  assert.equal(invalidPage.changed, false);
  assert.strictEqual(invalidPage.document, document);
});

test("canonical fingerprints ignore property insertion order and detect edits", () => {
  const document = add(fresh(), {
    kind: "text",
    page: 2,
    start: { x: 0.2, y: 0.3 },
    end: { x: 0.5, y: 0.4 },
    text: "COORDINATE ABOVE CEILING",
  }).document;
  const reordered = JSON.parse(JSON.stringify(document));
  reordered.binding = {
    pageCount: document.binding.pageCount,
    sourceFingerprint: document.binding.sourceFingerprint,
  };
  assert.equal(
    redlineDocumentFingerprint(document),
    redlineDocumentFingerprint(reordered),
  );
  reordered.annotations[0].text = "REVISED";
  assert.notEqual(
    redlineDocumentFingerprint(document),
    redlineDocumentFingerprint(reordered),
  );
});

test("v1 snapshots restore only on the exact PDF and quarantine unsafe data", () => {
  const document = add(fresh(), {
    kind: "arrow",
    page: 1,
    start: { x: 0.1, y: 0.1 },
    end: { x: 0.2, y: 0.2 },
  }).document;
  const serialized = serializeRedlineSnapshot(document, "2026-07-28T20:00:00Z");
  const restored = parseRedlineSnapshot(serialized, document.binding);
  assert.equal(restored.status, "ready");
  assert.equal(restored.fingerprint, redlineDocumentFingerprint(document));

  const otherPdf = parseRedlineSnapshot(serialized, {
    sourceFingerprint: "pdf-fingerprint-b",
    pageCount: 3,
  });
  assert.equal(otherPdf.status, "quarantined");
  assert.match(otherPdf.reason, /different PDF/i);

  const badBinding = createRedlineSnapshot(document);
  badBinding.document.annotations[0].binding.page = 99;
  badBinding.fingerprint = redlineDocumentFingerprint(badBinding.document);
  const pageLeak = parseRedlineSnapshot(badBinding, document.binding);
  assert.equal(pageLeak.status, "quarantined");
  assert.match(pageLeak.reason, /different PDF or page/i);

  const engineeringLeak = createRedlineSnapshot(document);
  engineeringLeak.document.annotations[0].cfm = 500;
  engineeringLeak.fingerprint = redlineDocumentFingerprint(engineeringLeak.document);
  const quarantined = parseRedlineSnapshot(engineeringLeak, document.binding);
  assert.equal(quarantined.status, "quarantined");
  assert.match(quarantined.reason, /Engineering data/i);

  const tampered = JSON.parse(serialized);
  tampered.document.annotations[0].style.color = "#000000";
  assert.equal(
    parseRedlineSnapshot(tampered, document.binding).status,
    "quarantined",
  );
});

test("sanitization applies hard policy caps and strips unknown presentation data", () => {
  const document = fresh();
  document.favorites = Array.from(
    { length: REDLINE_POLICY_LIMITS.maxFavorites + 3 },
    (_, index) => ({
      id: `favorite-${index}`,
      label: `Favorite ${index}`,
      kind: "ink",
      style: {
        color: "#123456",
        strokeWidth: 0.002,
        opacity: 1,
      },
      harmlessUnknown: "removed",
    }),
  );
  const result = sanitizeRedlineDocument(document, document.binding);
  assert.equal(result.ok, true);
  assert.equal(result.document.favorites.length, REDLINE_POLICY_LIMITS.maxFavorites);
  assert.equal("harmlessUnknown" in result.document.favorites[0], false);
});

test("selection bounds, alignment, grouping, duplication, and deletion are immutable", () => {
  let document = fresh();
  document = add(document, {
    kind: "rectangle",
    page: 1,
    start: { x: 0.1, y: 0.2 },
    end: { x: 0.2, y: 0.3 },
  }).document;
  document = add(document, {
    kind: "circle",
    page: 1,
    start: { x: 0.4, y: 0.5 },
    end: { x: 0.6, y: 0.7 },
  }).document;
  const ids = document.annotations.map((annotation) => annotation.id);
  const originalJson = JSON.stringify(document);
  assert.deepEqual(redlineSelectionBounds(document, ids), {
    binding: { sourceFingerprint: "pdf-fingerprint-a", page: 1 },
    left: 0.1,
    top: 0.2,
    right: 0.6,
    bottom: 0.7,
    width: 0.5,
    height: 0.49999999999999994,
  });

  const aligned = alignRedlineSelection(document, ids, "left");
  assert.equal(aligned.changed, true);
  assert.equal(
    redlineSelectionBounds(aligned.document, [ids[1]]).left,
    0.1,
  );
  assert.equal(JSON.stringify(document), originalJson);

  const grouped = groupRedlineSelection(aligned.document, ids, "RFI");
  assert.equal(grouped.document.groups.length, 1);
  const duplicated = duplicateRedlineSelection(grouped.document, ids);
  assert.equal(duplicated.selection.length, 2);
  assert.equal(duplicated.document.annotations.length, 4);
  assert.equal(duplicated.document.groups.length, 2);

  const deleted = deleteRedlineSelection(
    duplicated.document,
    duplicated.selection,
  );
  assert.equal(deleted.document.annotations.length, 2);
  assert.equal(deleted.document.groups.length, 1);
  assert.equal(deleted.selection.length, 0);
});

test("rotation and distribution stay bounded, immutable, and on one page", () => {
  let document = fresh();
  for (const [x, y] of [[0.05, 0.1], [0.2, 0.5], [0.75, 0.2]]) {
    document = add(document, {
      kind: "arrow",
      page: 1,
      start: { x, y },
      end: { x: x + 0.1, y: y + 0.05 },
    }).document;
  }
  const ids = document.annotations.map((annotation) => annotation.id);
  const original = JSON.stringify(document);
  const distributed = distributeRedlineSelection(
    document,
    ids,
    "horizontal",
  );
  assert.equal(distributed.changed, true);
  const centers = distributed.document.annotations.map((annotation) =>
    (annotation.start.x + annotation.end.x) / 2);
  assert.equal(
    Number((centers[1] - centers[0]).toFixed(8)),
    Number((centers[2] - centers[1]).toFixed(8)),
  );
  assert.equal(JSON.stringify(document), original);

  const rotated = rotateRedlineSelection(
    distributed.document,
    ids,
    15,
  );
  assert.equal(rotated.changed, true);
  const bounds = redlineSelectionBounds(rotated.document, ids);
  assert.ok(bounds.left >= 0 && bounds.top >= 0);
  assert.ok(bounds.right <= 1 && bounds.bottom <= 1);

  let crossPage = add(document, {
    kind: "circle",
    page: 2,
    start: { x: 0.1, y: 0.1 },
    end: { x: 0.2, y: 0.2 },
  }).document;
  const crossPageIds = [
    crossPage.annotations[0].id,
    crossPage.annotations.at(-1).id,
  ];
  assert.equal(
    rotateRedlineSelection(crossPage, crossPageIds, 90).changed,
    false,
  );
  assert.equal(
    distributeRedlineSelection(crossPage, crossPageIds, "vertical").changed,
    false,
  );
});

test("rotation respects the rendered PDF page aspect ratio", () => {
  const document = add(fresh(), {
    kind: "arrow",
    page: 1,
    start: { x: 0.4, y: 0.5 },
    end: { x: 0.6, y: 0.5 },
  }).document;
  const id = document.annotations[0].id;
  const rotated = rotateRedlineSelection(document, [id], 90, 2);

  assert.equal(rotated.changed, true, rotated.reason);
  const annotation = rotated.document.annotations[0];
  assert.deepEqual(annotation.start, { x: 0.5, y: 0.3 });
  assert.deepEqual(annotation.end, { x: 0.5, y: 0.7 });
  assert.deepEqual(document.annotations[0].start, { x: 0.4, y: 0.5 });
});

test("scale-selection is bounded, exact-page, lock-aware, and scales text atomically", () => {
  let document = fresh();
  document = add(document, {
    kind: "rectangle",
    page: 1,
    start: { x: 0.8, y: 0.78 },
    end: { x: 0.95, y: 0.94 },
  }).document;
  document = add(document, {
    kind: "text",
    page: 1,
    start: { x: 0.82, y: 0.82 },
    end: { x: 0.9, y: 0.88 },
    text: "FIELD VERIFY",
  }).document;
  const pageOneIds = document.annotations.map((annotation) => annotation.id);
  const original = JSON.stringify(document);
  const scaled = applyRedlineCommand(document, {
    type: "scale-selection",
    annotationIds: pageOneIds,
    factor: 2,
  });

  assert.equal(scaled.changed, true, scaled.reason);
  assert.deepEqual(scaled.selection, pageOneIds);
  assert.equal(JSON.stringify(document), original);
  const bounds = redlineSelectionBounds(scaled.document, pageOneIds);
  assert.ok(bounds.left >= 0 && bounds.top >= 0);
  assert.ok(bounds.right <= 1 && bounds.bottom <= 1);
  const scaledText = scaled.document.annotations.find(
    (annotation) => annotation.kind === "text",
  );
  assert.equal(scaledText.style.textScale, 2);
  assert.equal(
    document.annotations.find((annotation) => annotation.kind === "text")
      .style.textScale,
    1,
  );

  const tooLarge = applyRedlineCommand(document, {
    type: "scale-selection",
    annotationIds: pageOneIds,
    factor: 8,
  });
  assert.equal(tooLarge.changed, false);
  assert.strictEqual(tooLarge.document, document);

  const withOtherPage = add(document, {
    kind: "arrow",
    page: 2,
    start: { x: 0.1, y: 0.1 },
    end: { x: 0.2, y: 0.2 },
  }).document;
  const mixedPages = applyRedlineCommand(withOtherPage, {
    type: "scale-selection",
    annotationIds: [
      withOtherPage.annotations[0].id,
      withOtherPage.annotations.at(-1).id,
    ],
    factor: 1.25,
  });
  assert.equal(mixedPages.changed, false);
  assert.match(mixedPages.reason, /same PDF page/i);
  assert.strictEqual(mixedPages.document, withOtherPage);

  const locked = applyRedlineCommand(document, {
    type: "update-layer",
    layerId: document.layers[0].id,
    changes: { locked: true },
  });
  assert.equal(locked.changed, true);
  const lockedScale = applyRedlineCommand(locked.document, {
    type: "scale-selection",
    annotationIds: pageOneIds,
    factor: 1.25,
  });
  assert.equal(lockedScale.changed, false);
  assert.match(lockedScale.reason, /Unlock every selected/i);
  assert.strictEqual(lockedScale.document, locked.document);
});

test("update-selection-style is normalized, exact-page, immutable, and lock-aware", () => {
  let document = fresh();
  document = add(document, {
    kind: "rectangle",
    page: 1,
    start: { x: 0.1, y: 0.1 },
    end: { x: 0.2, y: 0.2 },
  }).document;
  document = add(document, {
    kind: "text",
    page: 1,
    start: { x: 0.25, y: 0.2 },
    end: { x: 0.4, y: 0.3 },
    text: "COORDINATE",
  }).document;
  document = add(document, {
    kind: "circle",
    page: 2,
    start: { x: 0.5, y: 0.5 },
    end: { x: 0.6, y: 0.6 },
  }).document;
  const pageOneIds = document.annotations
    .filter((annotation) => annotation.binding.page === 1)
    .map((annotation) => annotation.id);
  const pageTwo = document.annotations.find(
    (annotation) => annotation.binding.page === 2,
  );
  const pageTwoStyle = JSON.stringify(pageTwo.style);
  const original = JSON.stringify(document);
  const styled = applyRedlineCommand(document, {
    type: "update-selection-style",
    annotationIds: pageOneIds,
    changes: {
      color: "#12ABEF",
      fillColor: "#00FF00",
      opacity: -2,
      strokeWidth: 999,
      textScale: 99,
    },
  });

  assert.equal(styled.changed, true, styled.reason);
  assert.deepEqual(styled.selection, pageOneIds);
  assert.equal(JSON.stringify(document), original);
  const styledPageOne = styled.document.annotations.filter((annotation) =>
    pageOneIds.includes(annotation.id));
  assert.ok(styledPageOne.every((annotation) =>
    annotation.style.color === "#12abef" &&
    annotation.style.fillColor === "#00ff00" &&
    annotation.style.opacity === 0 &&
    annotation.style.strokeWidth === REDLINE_POLICY_LIMITS.maxStrokeWidth));
  assert.equal(
    styledPageOne.find((annotation) => annotation.kind === "text")
      .style.textScale,
    4,
  );
  assert.equal(
    "textScale" in styledPageOne.find(
      (annotation) => annotation.kind === "rectangle",
    ).style,
    false,
  );
  assert.equal(
    JSON.stringify(
      styled.document.annotations.find((annotation) => annotation.id === pageTwo.id)
        .style,
    ),
    pageTwoStyle,
  );

  const mixedPages = applyRedlineCommand(document, {
    type: "update-selection-style",
    annotationIds: [pageOneIds[0], pageTwo.id],
    changes: { color: "#123456" },
  });
  assert.equal(mixedPages.changed, false);
  assert.match(mixedPages.reason, /same PDF page/i);
  assert.strictEqual(mixedPages.document, document);

  const locked = applyRedlineCommand(document, {
    type: "update-layer",
    layerId: document.layers[0].id,
    changes: { locked: true },
  });
  assert.equal(locked.changed, true);
  const lockedStyle = applyRedlineCommand(locked.document, {
    type: "update-selection-style",
    annotationIds: pageOneIds,
    changes: { color: "#123456" },
  });
  assert.equal(lockedStyle.changed, false);
  assert.match(lockedStyle.reason, /Unlock every selected/i);
  assert.strictEqual(lockedStyle.document, locked.document);
});

test("My Details save relative annotation templates and place editable bound copies", () => {
  let document = fresh();
  document = add(document, {
    kind: "cloud",
    page: 1,
    start: { x: 0.2, y: 0.2 },
    end: { x: 0.4, y: 0.4 },
  }).document;
  document = add(document, {
    kind: "text",
    page: 1,
    start: { x: 0.24, y: 0.27 },
    end: { x: 0.36, y: 0.34 },
    text: "FIELD VERIFY",
  }).document;
  const ids = document.annotations.map((annotation) => annotation.id);
  document = groupRedlineSelection(document, ids).document;
  const saved = saveRedlineMyDetail(document, ids, "Field verify cloud");
  assert.equal(saved.changed, true);
  const detail = saved.document.myDetails[0];
  assert.equal(detail.annotations.length, 2);
  assert.equal("binding" in detail.annotations[0], false);
  assert.equal("layerId" in detail.annotations[0], false);

  const placed = placeRedlineMyDetail(
    saved.document,
    detail.id,
    { sourceFingerprint: "pdf-fingerprint-a", page: 3 },
    { x: 0.75, y: 0.8 },
  );
  assert.equal(placed.changed, true);
  assert.equal(placed.selection.length, 2);
  const copies = placed.document.annotations.filter((annotation) =>
    placed.selection.includes(annotation.id));
  assert.ok(copies.every((annotation) => annotation.binding.page === 3));
  assert.ok(copies.every((annotation) =>
    annotation.binding.sourceFingerprint === "pdf-fingerprint-a"));
  assert.ok(redlineSelectionBounds(placed.document, placed.selection).right <= 1);
  assert.ok(redlineSelectionBounds(placed.document, placed.selection).bottom <= 1);

  const wrongPdf = placeRedlineMyDetail(
    saved.document,
    detail.id,
    { sourceFingerprint: "other", page: 1 },
    { x: 0.1, y: 0.1 },
  );
  assert.equal(wrongPdf.changed, false);
});

test("visible annotations are filtered by exact source, page, and layer state", () => {
  let document = add(fresh(), {
    kind: "ink",
    page: 2,
    points: [{ x: 0.1, y: 0.1 }],
  }).document;
  assert.equal(visibleRedlineAnnotations(document, {
    sourceFingerprint: "pdf-fingerprint-a",
    page: 2,
  }).length, 1);
  assert.equal(visibleRedlineAnnotations(document, {
    sourceFingerprint: "other",
    page: 2,
  }).length, 0);
  document = {
    ...document,
    layers: document.layers.map((layer) => ({ ...layer, visible: false })),
  };
  assert.equal(visibleRedlineAnnotations(document, {
    sourceFingerprint: "pdf-fingerprint-a",
    page: 2,
  }).length, 0);
});
