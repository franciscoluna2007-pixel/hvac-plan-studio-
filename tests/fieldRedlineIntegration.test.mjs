import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const redline = await loadTypescriptModule(
  new URL("../app/redlineDomain.ts", import.meta.url),
);

const [
  page,
  controller,
  studio,
  renderer,
  exportSource,
  layout,
  analytics,
] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/useFieldRedlineController.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/FieldRedlineStudio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/fieldRedlineRenderer.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/fieldRedlineExport.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/productAnalytics.ts", import.meta.url), "utf8"),
]);

function sourceBlock(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Missing source-block start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `Missing source-block end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function add(document, draft) {
  const result = redline.applyRedlineCommand(document, {
    type: "add-annotation",
    draft,
  });
  assert.equal(result.changed, true, result.reason);
  return result.document;
}

test("V133 snapshots restore only against the exact PDF fingerprint and page count", () => {
  let document = redline.createRedlineDocument({
    sourceFingerprint: "pdf-smith-residence-a",
    pageCount: 2,
    title: "Smith Residence",
  });
  document = add(document, {
    kind: "text",
    page: 1,
    start: { x: 0.1, y: 0.2 },
    end: { x: 0.3, y: 0.25 },
    text: "FIELD VERIFY",
  });
  document = add(document, {
    kind: "arrow",
    page: 2,
    start: { x: 0.45, y: 0.4 },
    end: { x: 0.65, y: 0.55 },
  });

  const snapshot = redline.createRedlineSnapshot(
    document,
    "2026-07-28T22:30:00Z",
  );
  const exact = redline.parseRedlineSnapshot(snapshot, {
    sourceFingerprint: "pdf-smith-residence-a",
    pageCount: 2,
  });
  assert.equal(exact.status, "ready");
  assert.equal(exact.document.annotations.length, 2);

  const changedPdf = redline.parseRedlineSnapshot(snapshot, {
    sourceFingerprint: "pdf-smith-residence-b",
    pageCount: 2,
  });
  assert.equal(changedPdf.status, "quarantined");
  assert.match(changedPdf.reason, /different PDF/i);

  const changedPageCount = redline.parseRedlineSnapshot(snapshot, {
    sourceFingerprint: "pdf-smith-residence-a",
    pageCount: 3,
  });
  assert.equal(changedPageCount.status, "quarantined");
  assert.match(changedPageCount.reason, /page count changed/i);

  assert.deepEqual(
    redline.visibleRedlineAnnotations(document, {
      sourceFingerprint: "pdf-smith-residence-a",
      page: 1,
    }).map((annotation) => annotation.kind),
    ["text"],
  );
  assert.deepEqual(
    redline.visibleRedlineAnnotations(document, {
      sourceFingerprint: "pdf-smith-residence-a",
      page: 2,
    }).map((annotation) => annotation.kind),
    ["arrow"],
  );
  assert.equal(
    redline.visibleRedlineAnnotations(document, {
      sourceFingerprint: "pdf-smith-residence-b",
      page: 1,
    }).length,
    0,
  );
});

test("project save version 9 persists valid redlines and preserves quarantined raw data", () => {
  const savedProjectType = sourceBlock(
    page,
    "type SavedProject = {",
    "function boundedPlanAnalysisSnapshot",
  );
  assert.match(savedProjectType, /version: 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8 \| 9;/);
  assert.match(savedProjectType, /fieldRedlines\?: RedlineSnapshotV1;/);
  assert.match(savedProjectType, /fieldRedlineQuarantine\?: unknown;/);

  const projectSnapshot = sourceBlock(
    page,
    "const buildProjectSnapshot = useCallback",
    "const saveProject = useCallback",
  );
  assert.match(projectSnapshot, /version: 9,/);
  assert.match(projectSnapshot, /fieldRedlines: fieldRedline\.snapshot,/);
  assert.match(
    projectSnapshot,
    /fieldRedlineQuarantine:\s*fieldRedline\.quarantinedSnapshot \|\| undefined,/,
  );

  const projectRestore = sourceBlock(
    page,
    "function applyProjectSnapshot(",
    "function resetForNewSource(",
  );
  assert.doesNotMatch(
    projectRestore,
    /project\.fieldRedlines \|\| project\.fieldRedlineQuarantine/,
  );
  assert.match(
    projectRestore,
    /const expectedRedlineSource = \{[\s\S]*?pageCount: redlinePageCount,[\s\S]*?\};[\s\S]*?fieldRedline\.restoreSnapshot\(\s*project\.fieldRedlines,\s*expectedRedlineSource,\s*project\.fieldRedlineQuarantine,\s*\)/,
  );
  assert.match(projectRestore, /sourceFingerprint: redlineSourceFingerprint/);
  assert.match(projectRestore, /pageCount: redlinePageCount/);

  const controllerRestore = sourceBlock(
    controller,
    "const restoreSnapshot = useCallback",
    "const runCommand = useCallback",
  );
  assert.match(controllerRestore, /preservedQuarantine\?: unknown/);
  assert.match(controllerRestore, /parseRedlineSnapshot\(snapshot, expected\)/);
  assert.match(controllerRestore, /setQuarantinedSnapshot\(snapshot\)/);
  assert.match(
    controllerRestore,
    /const nextHistory = createRedlineHistory\(parsed\.document\);[\s\S]*?setQuarantinedSnapshot\(preservedQuarantine \?\? null\)/,
  );
  assert.match(
    controllerRestore,
    /if \(!snapshot\) \{[\s\S]*?setQuarantinedSnapshot\(preservedQuarantine \?\? null\)/,
  );
  assert.match(
    controllerRestore,
    /original redline data was quarantined and preserved/,
  );
  assert.match(controllerRestore, /createRedlineDocument\(expected\)/);
  assert.doesNotMatch(controllerRestore, /throw parsed|JSON\.stringify\(snapshot\)/);
});

test("cloud redline restore requires the exact open PDF source and page count", () => {
  const sourceMatcher = sourceBlock(
    page,
    "function savedFieldRedlinesMatchSource(",
    "function blockedFieldRedlineRestoreData(",
  );
  assert.match(
    sourceMatcher,
    /binding\.sourceFingerprint === sourceFingerprint/,
  );
  assert.match(sourceMatcher, /binding\.pageCount === sourcePageCount/);
  assert.match(
    sourceMatcher,
    /project\.pdfFingerprint === sourceFingerprint/,
  );

  const projectRestore = sourceBlock(
    page,
    "function applyProjectSnapshot(",
    "function resetForNewSource(",
  );
  assert.match(
    projectRestore,
    /fieldRedlineRestoreMode: "restore" \| "quarantine" = "restore"/,
  );
  assert.match(
    projectRestore,
    /if \(fieldRedlineRestoreMode === "quarantine"\) \{[\s\S]*?fieldRedline\.restoreSnapshot\(\s*undefined,[\s\S]*?blockedFieldRedlineRestoreData\(project\),/,
  );

  const cloudRestore = sourceBlock(
    page,
    "async function restoreCloudRevision(",
    "function onFileChange(",
  );
  assert.match(cloudRestore, /let sourceFingerprint = pdfFingerprint \|\| "";/);
  assert.match(cloudRestore, /let sourcePageCount = pdf\?\.numPages \|\| 0;/);
  assert.match(
    cloudRestore,
    /const fieldRedlinesBlocked = Boolean\(savedProject\.fieldRedlines\) &&[\s\S]*?!savedFieldRedlinesMatchSource\(/,
  );
  assert.match(
    cloudRestore,
    /fieldRedlinesBlocked \? "quarantine" : "restore"/,
  );
  assert.match(
    cloudRestore,
    /field redlines quarantined until the matching PDF is open/,
  );
});

test("RFI and punch conversion is explicit, source-linked, and creates drafts only", () => {
  const linkType = sourceBlock(
    page,
    "type FieldRedlineSourceLink = {",
    "type PunchItem = {",
  );
  for (const contract of [
    /version: "field-redline-link-v133\.0"/,
    /sourceFingerprint: string/,
    /page: number/,
    /annotationIds: string\[\]/,
    /redlineFingerprint: string/,
    /bounds\?:/,
  ]) {
    assert.match(linkType, contract);
  }

  const issueBridge = sourceBlock(
    page,
    "function fieldRedlineSourceLink(",
    "function createPunchItem()",
  );
  assert.match(issueBridge, /annotationIds: \[\.\.\.draft\.annotationIds\]/);
  assert.match(issueBridge, /redlineFingerprint: draft\.redlineFingerprint/);
  assert.match(issueBridge, /if \(!draft\.annotationIds\.length \|\| !draft\.title\.trim\(\)\) return;/);
  assert.match(issueBridge, /const sourceRedline = fieldRedlineSourceLink\(draft\)/);
  assert.match(issueBridge, /status: "draft"[\s\S]*?sourceRedline,/);
  assert.match(issueBridge, /status: "open"[\s\S]*?sourceRedline,/);
  assert.match(issueBridge, /nothing was submitted/);
  assert.match(issueBridge, /no HVAC object changed/);
  assert.doesNotMatch(
    issueBridge,
    /setDrawings|setHistory|applyRedlineCommand|applyRepair|issueCloudFieldRelease/,
  );

  const currentPageSelection = sourceBlock(
    controller,
    "const sourceFingerprint = document",
    "const renderedDocument = previewDocument || document",
  );
  assert.match(currentPageSelection, /const binding = useMemo/);
  assert.match(
    currentPageSelection,
    /\(history\?\.selection \|\| \[\]\)\.filter/,
  );
  assert.match(
    currentPageSelection,
    /bindingMatches\(annotation, binding\)/,
  );

  const controllerDraft = sourceBlock(
    controller,
    '} else if (current.kind === "issue-draft") {',
    "const handleSelectionAction = useCallback",
  );
  assert.match(
    controllerDraft,
    /redlineSelectionBounds\(\s*history\.present,\s*selection,\s*\)/,
  );
  assert.match(controllerDraft, /annotationIds: \[\.\.\.selection\]/);
  assert.match(controllerDraft, /binding,/);
  assert.match(
    controllerDraft,
    /redlineFingerprint: redlineDocumentFingerprint\(history\.present\)/,
  );
});

test("raw redlines stay outside HVAC geometry, takeoff, and release fingerprints", () => {
  const engineeringBlocks = [
    [
      "cloud release fingerprint",
      sourceBlock(
        page,
        "function cloudReleaseFingerprintFromProject(",
        "function stableByteHash(",
      ),
    ],
    [
      "drawing signature",
      sourceBlock(
        page,
        "function systemDrawingSignatureFor(",
        "function systemDrawingSignature(",
      ),
    ],
    [
      "system release signature",
      sourceBlock(
        page,
        "function systemReleaseSignature(",
        "function latestSystemRelease(",
      ),
    ],
    [
      "takeoff",
      sourceBlock(page, "function buildTakeoff(", "function materialSummary("),
    ],
    [
      "material fingerprint",
      sourceBlock(
        page,
        "function materialReviewFingerprint(",
        "function activeTakeoffSignature(",
      ),
    ],
    [
      "field package gate",
      sourceBlock(page, "function fieldPackageSummary(", "async function issueSystemRelease("),
    ],
    [
      "field release issue",
      sourceBlock(
        page,
        "async function issueSystemRelease(",
        "function exportReleaseManifestCsv(",
      ),
    ],
  ];
  for (const [name, block] of engineeringBlocks) {
    assert.doesNotMatch(
      block,
      /\bfieldRedline(?:s|Quarantine)?\b|redlineFingerprint/,
      `${name} must not read raw Field Redline Studio state`,
    );
  }

  const exportBridge = sourceBlock(
    page,
    "async function exportFieldRedlines(",
    "function createPunchItem()",
  );
  assert.match(
    exportBridge,
    /const committedSceneFingerprint = stableTextHash\(JSON\.stringify\(\s*canonicalReleaseValue\(\{/,
  );
  for (const committedInput of [
    /releaseFingerprint: currentCloudReleaseFingerprint/,
    /page: pageNumber/,
    /drawings: drawings[\s\S]*?\.filter\(\(drawing\) => drawing\.page === pageNumber\)[\s\S]*?\.sort\(\(left, right\) => left\.id\.localeCompare\(right\.id\)\)/,
    /visibleLayers,/,
    /showCfmLabels,/,
    /showLengthLabels,/,
    /showFittingLabels,/,
    /backgroundOpacity,/,
    /redlines: fieldRedline\.fingerprint/,
  ]) {
    assert.match(exportBridge, committedInput);
  }
  assert.match(
    exportBridge,
    /sourceFingerprint: pdfFingerprint,[\s\S]*?committedSceneFingerprint,/,
  );
  assert.doesNotMatch(
    exportBridge,
    /committedSceneFingerprint:\s*`\$\{currentCloudReleaseFingerprint\}:\$\{fieldRedline\.fingerprint\}`/,
  );
  assert.match(
    exportBridge,
    /hvacRelease:\s*\{[\s\S]*?fingerprint: activeFieldPackage\.releaseSignature,/,
  );
  assert.match(
    exportBridge,
    /redlines:\s*\{[\s\S]*?fingerprint: fieldRedline\.fingerprint,/,
  );
  assert.doesNotMatch(
    exportBridge,
    /activeFieldPackage\.releaseSignature\s*[:=]\s*fieldRedline/,
  );
});

test("redline export blocks a stale rendered sheet and renders the PDF crop at output resolution", () => {
  const exportBridge = sourceBlock(
    page,
    "async function exportFieldRedlines(",
    "function createPunchItem()",
  );
  const stalePageGuard = exportBridge.indexOf(
    "if (renderedPageNumberRef.current !== pageNumber)",
  );
  const transientGuard = exportBridge.indexOf("fieldRedline.transient ||");
  const planBuild = exportBridge.indexOf(
    "const exportPlan = buildFieldRedlineExportPlan",
  );
  const pdfRender = exportBridge.indexOf(
    "const pdfPage = await pdf.getPage(pageNumber)",
  );
  assert.ok(stalePageGuard >= 0);
  assert.ok(transientGuard > stalePageGuard);
  assert.ok(planBuild > transientGuard);
  assert.ok(pdfRender > planBuild);
  assert.match(
    exportBridge,
    /Wait for PDF sheet \$\{pageNumber\} to finish rendering before export\./,
  );
  assert.match(
    exportBridge,
    /fieldRedline\.renderedDocument !== fieldRedline\.document/,
  );
  assert.match(
    exportBridge,
    /redlineDocument\.binding\.sourceFingerprint !== pdfFingerprint/,
  );
  assert.match(
    exportBridge,
    /redlineDocument\.binding\.pageCount !== pdf\.numPages/,
  );
  const overlaySnapshot = exportBridge.indexOf(
    "const committedOverlaySvg =",
  );
  assert.ok(overlaySnapshot > planBuild);
  assert.ok(overlaySnapshot < pdfRender);
  assert.match(
    exportBridge,
    /const committedOverlaySvg =\s*overlaySvg\.cloneNode\(true\) as SVGSVGElement;/,
  );

  assert.match(
    page,
    /async function replacePdfDocument\([\s\S]*?renderedPageNumberRef\.current = 0;/,
  );
  assert.match(
    page,
    /visibleContext\.drawImage\(buffer, 0, 0\);[\s\S]*?renderedPageNumberRef\.current = pageNumber;/,
  );

  assert.match(
    exportBridge,
    /const renderLayout = resolveFieldRedlineRenderLayout\(\s*exportPlan\.renderRequest,\s*\)/,
  );
  assert.match(
    exportBridge,
    /exportSourceCanvas\.width = Math\.max\(\s*1,\s*Math\.round\(renderLayout\.plan\.width\),\s*\)/,
  );
  assert.match(
    exportBridge,
    /exportSourceCanvas\.height = Math\.max\(\s*1,\s*Math\.round\(renderLayout\.plan\.height\),\s*\)/,
  );
  assert.match(
    exportBridge,
    /const baseViewport = pdfPage\.getViewport\(\{ scale: 1 \}\)/,
  );
  assert.match(
    exportBridge,
    /const editorScale = renderSize\.width \/ Math\.max\(1, baseViewport\.width\)/,
  );
  assert.match(
    exportBridge,
    /const cropScale = Math\.max\(\s*exportSourceCanvas\.width \/ exportPlan\.crop\.width,\s*exportSourceCanvas\.height \/ exportPlan\.crop\.height,\s*\)/,
  );
  assert.match(
    exportBridge,
    /const exportViewport = pdfPage\.getViewport\(\{\s*scale: editorScale \* cropScale,\s*\}\)/,
  );
  assert.match(
    exportBridge,
    /transform: \[\s*1,\s*0,\s*0,\s*1,\s*-exportPlan\.crop\.x \* cropScale,\s*-exportPlan\.crop\.y \* cropScale,\s*\]/,
  );
  assert.match(exportBridge, /await pdfPage\.render\(\{[\s\S]*?\}\)\.promise/);
  assert.match(exportBridge, /sourceCanvas: exportSourceCanvas/);
  assert.match(exportBridge, /sourceCanvasCoversCrop: true/);
  assert.match(exportBridge, /overlaySvg: committedOverlaySvg/);
  assert.doesNotMatch(
    exportBridge,
    /sourceCanvasCoversCrop: true,\s*overlaySvg,\s*\}/,
  );
});

test("committed export removes selection chrome and every temporary preview", () => {
  const selectors = sourceBlock(
    renderer,
    "const TRANSIENT_SELECTORS = [",
    "] as const;",
  );
  for (const transient of [
    ".draft-drawing",
    ".measure-preview",
    ".branch-preview",
    ".symbol-preview",
    ".snap-marker",
    ".selection-box",
    ".assistant-suggestion-layer",
    ".redline-selection-overlay",
    ".redline-transient-draft",
    ".redline-transient-lasso",
    ".redline-transient-selection-box",
    ".edit-handle",
    ".rotation-ring",
  ]) {
    assert.match(selectors, new RegExp(transient.replaceAll(".", "\\.")));
  }
  assert.doesNotMatch(selectors, /redline-canvas-committed/);
  assert.match(
    renderer,
    /TRANSIENT_SELECTORS\.forEach\(\(selector\) => \{[\s\S]*?clone\.querySelectorAll\(selector\)\.forEach\(\(node\) => node\.remove\(\)\)/,
  );
  assert.match(renderer, /const clone = source\.cloneNode\(true\)/);
  assert.match(exportSource, /"selection-handles"/);
  assert.match(exportSource, /"action-wheel"/);
  assert.match(exportSource, /"placement-ghosts"/);
  assert.match(exportSource, /"in-progress-strokes"/);
  assert.match(exportSource, /"measure-previews"/);
  assert.match(exportSource, /"assistant-suggestions"/);
  assert.match(exportSource, /"repair-previews"/);
});

test("Redline failures stay isolated and never fall through to HVAC drawing handlers", () => {
  assert.match(
    page,
    /class RedlineCanvasErrorBoundary extends Component/,
  );
  assert.match(
    page,
    /Field Redline Studio recovered without closing the PDF/,
  );
  assert.match(
    page,
    /The PDF stayed open; close and reopen Redline to continue\./,
  );

  const canvasHandlers = sourceBlock(
    page,
    "onPointerDownCapture={redlineOwnsCanvas ? undefined : handleRoomMarkupPlacementCapture}",
    "onPointerLeave={() =>",
  );
  for (const handler of [
    "handlePointerDown",
    "handlePointerMove",
    "finishPointer",
  ]) {
    assert.match(
      canvasHandlers,
      new RegExp(
        `if \\(redlineOwnsCanvas\\) \\{[\\s\\S]*?fieldRedline\\.${handler}\\(event`,
      ),
    );
  }
  assert.match(
    canvasHandlers,
    /if \(redlineOwnsCanvas\) \{[\s\S]*?return;[\s\S]*?\}\s*handleDrawingClick\(event\)/,
  );
  assert.match(
    canvasHandlers,
    /if \(redlineOwnsCanvas\) \{[\s\S]*?return;[\s\S]*?\}\s*handlePointerMove\(event\)/,
  );
  assert.match(
    canvasHandlers,
    /if \(redlineOwnsCanvas\) \{[\s\S]*?return;[\s\S]*?\}\s*endDrag\(event\)/,
  );
  assert.match(
    controller,
    /redlinePointerCanDraw\(event\.nativeEvent, \{\s*allowTouch: true,/,
  );
  assert.match(
    page,
    /const redlineDrawsWithOneTouch =\s*redlineOwnsCanvas &&\s*!\["select", "erase"\]\.includes\(fieldRedline\.activeTool\)/,
  );
});

test("Redline drawing, shape, and text-edit lifecycles stay direct and uncluttered", () => {
  const setTool = sourceBlock(
    controller,
    "const setTool = useCallback",
    "const updateLayer = useCallback",
  );
  assert.match(setTool, /if \(tool !== "select"\) select\(\[\]\)/);
  assert.match(setTool, /isRedlineDragShapeTool\(tool\)/);

  const finishPointer = sourceBlock(
    controller,
    "const finishPointer = useCallback",
    "const handleDialogConfirm = useCallback",
  );
  assert.match(
    finishPointer,
    /runCommand\(\{ type: "add-annotation", draft \}\);\s*select\(\[\]\)/,
  );
  assert.match(
    finishPointer,
    /isRedlineDragShapeTool\(active\.tool\)[\s\S]*?redlineDragShapeBounds/,
  );
  assert.match(
    finishPointer,
    /if \(!bounds\) \{[\s\S]*?Press and drag to draw a circle or square[\s\S]*?return true;/,
  );

  const textConfirm = sourceBlock(
    controller,
    "const handleDialogConfirm = useCallback",
    "const handleSelectionAction = useCallback",
  );
  assert.match(
    textConfirm,
    /if \(textSaved\) \{[\s\S]*?setActiveTool\("select"\)[\s\S]*?drag it to move[\s\S]*?corner to resize/,
  );
  assert.match(controller, /const handleTextResizePointerDown = useCallback/);
  assert.match(
    controller,
    /type: "update-selection-style"[\s\S]*?changes: \{ textScale: active\.currentTextScale \}/,
  );
  assert.match(
    page,
    /setSelectionBox\(null\);[\s\S]*?setAlignmentGuides\(\[\]\);[\s\S]*?fieldRedline\.setOpen\(true\)/,
  );
});

test("V133 metadata and user-facing naming publish Field Redline Studio with Area select", () => {
  assert.match(analytics, /app_version: "133"/);
  assert.match(layout, /HVAC Plan Studio · Field Redline Studio/);
  assert.match(
    layout,
    /Draw source-bound field redlines[\s\S]*?without changing the approved HVAC design\./,
  );
  assert.match(studio, /Field Redline Studio/);
  assert.match(studio, /\{ id: "lasso", label: "Area select", icon: Lasso \}/);
  assert.doesNotMatch(studio, /label: "Lasso"/);
  assert.doesNotMatch(studio, /Notebook(?: Pro|-style| style)/i);
});
