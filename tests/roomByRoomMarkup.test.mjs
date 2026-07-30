import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [
  page,
  studio,
  lifecycle,
  roomPlan,
  styles,
  layout,
  analytics,
  readme,
  roadmap,
] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/MarkupAssistantStudio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/roomMarkupLifecycle.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/roomMarkupPlan.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/productAnalytics.ts", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../ROADMAP.md", import.meta.url), "utf8"),
]);

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `Missing source boundary: ${start}`);
  assert.ok(endIndex > startIndex, `Missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("persists room candidates and application receipts in the version 9 project state", () => {
  assert.match(
    page,
    /type SavedProject = \{\s*version: 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8 \| 9;/,
  );
  assert.match(page, /roomMarkupCandidatesBySystem\?: Record<string, RoomMarkupCandidate\[\]>/);
  assert.match(page, /roomMarkupApplicationRecords\?: RoomMarkupApplicationRecord\[\]/);

  const snapshot = sourceBetween(
    page,
    "const buildProjectSnapshot = useCallback((): SavedProject => {",
    "const saveProject = useCallback(() => {",
  );
  assert.match(snapshot, /version: 9,/);
  assert.match(snapshot, /roomMarkupCandidatesBySystem,/);
  assert.match(snapshot, /roomMarkupApplicationRecords,/);
  assert.match(page, /setRoomMarkupCandidatesBySystem\(project\.roomMarkupCandidatesBySystem \|\| \{\}\)/);
  assert.match(
    page,
    /setRoomMarkupApplicationRecords\(\s*Array\.isArray\(project\.roomMarkupApplicationRecords\)/,
  );
});

test("keeps room review one-at-a-time with named approval, a checkbox, and one Undo", () => {
  assert.match(studio, /Review one room at a time/);
  assert.match(studio, /ROOM \{activeRoomMarkupIndex \+ 1\} OF \{roomMarkupPlan\.rooms\.length\}/);
  assert.doesNotMatch(studio, /\bAccept All\b/i);
  assert.doesNotMatch(studio, /\b(?:approve|add|confirm) all rooms\b/i);
  assert.match(studio, /Reviewer \/ initials/);
  assert.match(studio, /type="checkbox"/);
  assert.match(studio, /I confirmed this room, its HVAC system, and the locations shown\./);
  assert.match(studio, /disabled=\{!roomReviewer\.trim\(\) \|\| !roomApprovalChecked\}/);
  assert.match(studio, /Add reviewed items · one Undo/);
  assert.match(studio, /disabled=\{!canUndoRoomMarkup\} onClick=\{onUndoRoomMarkup\}/);
});

test("requires an explicit reviewed return strategy", () => {
  for (const strategy of [
    "Dedicated return",
    "Transfer grille",
    "Jump duct",
    "Approved door undercut",
    "Needs field review",
  ]) {
    assert.ok(lifecycle.includes(`"${strategy}"`), `Missing return strategy: ${strategy}`);
  }
  assert.match(studio, /Choose a return strategy/);
  assert.match(studio, /Add dedicated return/);
  assert.match(studio, /Uses another return path:/);
  assert.match(studio, /Not sure—hold room/);
  assert.match(studio, /role="group" aria-label=\{`Return-air strategy/);
  assert.match(studio, /aria-pressed=\{returnStrategy === "Dedicated return"\}/);
  assert.match(studio, /aria-pressed=\{returnStrategy === strategy\}/);
  assert.match(studio, /aria-pressed=\{returnStrategy === "Needs field review"\}/);
  assert.match(
    roomPlan,
    /if \(candidate\.kind === "supply"\) return true;\s*return returnStrategy\(candidate\) === "Dedicated return";/,
  );
});

test("renders and applies the candidate's moved review point", () => {
  const overlay = sourceBetween(
    page,
    "{showAssistantSuggestionLayer && roomMarkupPlan.overlayCandidates.length > 0 && <g",
    "{showMarkupAssistant && activeMarkupRecommendation?.preview",
  );
  assert.match(overlay, /const x = candidate\.reviewPoint\.x \* renderSize\.width;/);
  assert.match(overlay, /const y = candidate\.reviewPoint\.y \* renderSize\.height;/);
  assert.match(overlay, /transform=\{`translate\(\$\{x\} \$\{y\}\)/);

  const apply = sourceBetween(page, "function applyRoomMarkup(", "function handleDrawingClick(");
  assert.match(apply, /x: candidate\.reviewPoint\.x \* renderSize\.width/);
  assert.match(apply, /y: candidate\.reviewPoint\.y \* renderSize\.height/);
});

test("room apply creates only reviewed supply or dedicated-return terminal symbols", () => {
  const apply = sourceBetween(page, "function applyRoomMarkup(", "function handleDrawingClick(");
  assert.match(apply, /scaleStateForPage\(currentRoom\.page\)\.verified/);
  assert.match(apply, /currentRoom\.systemId !== activeSystem/);
  assert.match(apply, /!roomMarkupEvidenceIsCurrent\(candidate, binding\)/);
  assert.match(
    apply,
    /terminalCandidates = candidates\.filter\(\(candidate\) =>\s*roomMarkupCandidateCreatesTerminal\(candidate\) &&\s*!currentRoom\.appliedCandidateIds\.includes\(candidate\.id\)/,
  );
  assert.match(apply, /createdDrawingIdsByCandidate = \{\s*\.\.\.currentRoom\.createdDrawingIdsByCandidate/);
  assert.match(apply, /candidateFingerprints: Object\.fromEntries\(candidates\.map/);
  assert.match(
    apply,
    /const kind: SymbolKind = candidate\.kind === "supply" \? "diffuser" : "returnGrille";/,
  );
  assert.match(apply, /type: "symbol",/);
  assert.match(apply, /setHistory\(next\)/);

  for (const forbiddenField of [
    /\bcfm\s*:/i,
    /\bneck(?:Size)?\s*:/i,
    /\brunNumber\s*:/i,
    /\bfitting\s*:/i,
    /\bconnectedRunId\s*:/i,
    /\bconnectedTo\s*:/i,
    /\btype\s*:\s*"(?:supply|return|fresh)"/i,
    /\bequipment\s*:/i,
    /\bwall\s*:/i,
  ]) {
    assert.doesNotMatch(apply, forbiddenField);
  }

  assert.match(
    studio,
    /No duct, CFM, run size, run number, fitting, connection, equipment, wall, or room geometry will be added\./,
  );
});

test("binds approval to the exact reviewed room and shows the exact object list", () => {
  assert.match(studio, /const roomApprovalFingerprint = activeRoomMarkup/);
  assert.match(studio, /roomApprovalKey === roomApprovalFingerprint/);
  assert.match(studio, /appliedCandidateIds: activeRoomMarkup\.appliedCandidateIds/);
  assert.match(studio, /createdDrawingIdsByCandidate: activeRoomMarkup\.createdDrawingIdsByCandidate/);
  assert.match(studio, /roomName: activeRoomMarkup\.roomName/);
  assert.match(studio, /roomMarkupCandidateReviewFingerprint\(candidate\)/);
  assert.match(studio, /reviewer: roomReviewer\.trim\(\)/);
  assert.match(studio, /setRoomApprovalKey\(\s*event\.target\.checked \? roomApprovalFingerprint : ""/);
  assert.match(studio, /aria-label="Exact room markup"/);
  assert.match(studio, /alreadyApplied \? "KEEP EXISTING" : "ADD"/);
  assert.match(studio, /candidate\.terminalSelection\?\.label/);
  assert.match(studio, /candidate\.terminalSelection\?\.size/);
  assert.match(studio, /candidate\.terminalSelection\?\.elevation/);
  assert.match(studio, /Math\.round\(candidate\.reviewPoint\.x \* 100\)/);
  assert.match(studio, /Math\.round\(candidate\.reviewPoint\.y \* 100\)/);
  assert.match(studio, /Move with keyboard/);
  assert.match(studio, /Move \$\{candidate\.kind\} ghost \$\{label\.toLowerCase\(\)\} one percent/);
  assert.match(studio, /Existing reviewed icon stays unchanged/);
  assert.doesNotMatch(studio, /Â·/);
});

test("scopes room Undo and release fingerprints to immutable application receipts", () => {
  assert.match(
    page,
    /undoableRoomMarkupRecord\(\s*undefined,\s*activeRoomMarkupRoom\.latestApplication\.id/,
  );
  assert.match(page, /applicationRecords: roomMarkupApplicationRecords/);
  assert.match(
    page,
    /record\.afterDrawingFingerprint === systemDrawingSignatureFor\(drawings, record\.systemId\)/,
  );
  assert.match(
    page,
    /record\.beforeDrawingFingerprint === systemDrawingSignatureFor\(previous, record\.systemId\)/,
  );
  const roomUndo = sourceBetween(page, "function undoRoomMarkup()", "function undo()");
  assert.match(roomUndo, /const drawingRecord = undoableRoomMarkupRecord\(previous, applicationId\)/);
  assert.match(roomUndo, /setDrawings\(previous\)/);
  assert.doesNotMatch(roomUndo, /\bundo\(\)/);
  assert.match(
    page,
    /\.\.\.\(project\.roomMarkupApplicationRecords\?\.length\s*\? \{ roomMarkupApplicationRecords: project\.roomMarkupApplicationRecords \}/,
  );
  assert.doesNotMatch(
    sourceBetween(
      page,
      "const currentCloudReleaseFingerprint = useMemo(",
      "useEffect(() => {",
    ),
    /roomMarkupCandidatesBySystem/,
  );
});

test("lets touch placement reach the PDF while a ghost move is pending", () => {
  const capture = sourceBetween(
    page,
    "function handleViewportPointerDownCapture(",
    "function handleViewportPointerMoveCapture(",
  );
  assert.match(
    capture,
    /if \(pendingRoomMarkupCandidateId\) \{\s*event\.preventDefault\(\);\s*cancelTouchNavigation\(event\.currentTarget\);\s*return;/,
  );
  const drawingClick = sourceBetween(page, "function handleDrawingClick(", "function undoableAssistantRepairRecord(");
  assert.match(
    drawingClick,
    /event\.pointerType === "touch" && !planToolAcceptsDirectTouch/,
  );
  assert.match(
    page,
    /const planToolAcceptsDirectTouch =[\s\S]*?pendingRoomMarkupCandidateId/,
  );
  const placementCapture = sourceBetween(
    page,
    "function handleRoomMarkupPlacementCapture(",
    "function handleDrawingClick(",
  );
  assert.match(placementCapture, /event\.stopPropagation\(\)/);
  assert.match(placementCapture, /handleDrawingClick\(event\)/);
  assert.match(
    page,
    /onPointerDownCapture=\{\(event\) => \{[\s\S]*?latchCanvasPointerOwner\([\s\S]*?if \(!redlineOwnsCanvas\) \{[\s\S]*?handleRoomMarkupPlacementCapture\(event\)/,
  );
});

test("keeps Room Markup touch-friendly, mobile, and out of print", () => {
  assert.match(styles, /\.room-markup-workspace/);
  assert.match(
    styles,
    /\.room-markup-entry-actions > button,[\s\S]*?min-height: 44px/,
  );
  assert.match(
    styles,
    /@media \(max-width: 820px\)[\s\S]*?\.room-markup-workspace[\s\S]*?height: min\(48vh/,
  );
  assert.match(
    styles,
    /@media print[\s\S]*?\.room-markup-workspace,[\s\S]*?\.assistant-suggestion-layer,[\s\S]*?display: none !important/,
  );
});

test("keeps V131 and V132 documented beneath the current V133 release", () => {
  assert.match(layout, /HVAC Plan Studio · Field Redline Studio/);
  assert.match(
    layout,
    /Draw source-bound field redlines/,
  );
  assert.match(analytics, /app_version: "133"/);
  assert.match(readme, /## Current release — v133/);
  assert.match(readme, /There is no Accept All or bulk room approval\./);
  assert.match(
    readme,
    /Never adds or changes ductwork, CFM, run sizes, run numbers, fittings, connections, equipment, walls, or room geometry\./,
  );
  assert.match(roadmap, /\| v131 \| Room-by-Room Markup \| Shipped \|/);
  assert.match(roadmap, /\| v132 \| Finish the Job \| Shipped \|/);
  assert.match(roadmap, /\| v133 \| Field Redline Studio \| Shipped \|/);
  assert.match(roadmap, /## v131 — Room-by-Room Markup/);
  assert.match(roadmap, /## v132 — Finish the Job/);
  assert.match(roadmap, /## v133 — Field Redline Studio/);
});
