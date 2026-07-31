import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, canvas, styles] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/RedlineCanvasLayer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("HVAC action wheels and the fallback toolbar are limited to safe Select mode", () => {
  assert.match(
    page,
    /const planSelectionActionsVisible =\s*activeTool === "select"[\s\S]*?!splitMode[\s\S]*?!calibrating[\s\S]*?!pendingRoomMarkupCandidateId[\s\S]*?!fieldRedline\.open/,
  );
  assert.match(
    page,
    /const selectedSymbolWheel = selectedDrawing\?\.symbol\s*&& planSelectionActionsVisible/,
  );
  assert.match(
    page,
    /const selectedRunWheel = selectedRun &&\s*planSelectionActionsVisible/,
  );
  assert.match(
    page,
    /const selectedFittingWheel = selectedFitting &&\s*planSelectionActionsVisible/,
  );
  assert.match(
    page,
    /\{selectedId && planSelectionActionsVisible && !selectedContextWheelVisible && <div className="field-context-toolbar"/,
  );
});

test("symbol placement stays armed and does not auto-open selection actions", () => {
  const placement = page.slice(
    page.indexOf("function placeSymbol"),
    page.indexOf("function segmentIntersection"),
  );

  assert.match(placement, /setHistory\(\[\.\.\.drawings, symbol\]\)/);
  assert.match(placement, /selectOnly\(null\)/);
  assert.match(placement, /setLeftPanelView\("symbols"\)/);
  assert.match(placement, /placement stays active for the next icon/);
  assert.doesNotMatch(placement, /selectOnly\(symbol\.id\)/);
});

test("missed plan releases commit icon and run placement instead of restoring the pointer-down snapshot", () => {
  const completion = page.slice(
    page.indexOf("function completeStalePlanPointerInteraction"),
    page.indexOf("function beginEditTransaction"),
  );
  assert.match(completion, /completedEditPointerIdsRef\.current\.add\(event\.pointerId\)/);
  assert.match(completion, /endDrag\(event as unknown as PointerEvent<SVGSVGElement>\)/);
  assert.match(completion, /releasePlanPointerCapture\(event\.pointerId\)/);
  assert.match(completion, /releaseCanvasPointerOwner\(/);
  assert.doesNotMatch(completion, /restoreEditTransaction|cancelPlanPointerInteraction/);

  const pointerMoveCapture = page.slice(
    page.indexOf("function handleViewportPointerMoveCapture"),
    page.indexOf("function handleViewportPointerUpCapture"),
  );
  assert.match(pointerMoveCapture, /shouldCompleteStalePlanPointerMove\(\{/);
  assert.match(pointerMoveCapture, /completeStalePlanPointerInteraction\(event\)/);
  assert.doesNotMatch(pointerMoveCapture, /cancelPlanPointerInteraction|restoreEditTransaction/);

  const placement = page.slice(
    page.indexOf("function handleDrawingClick"),
    page.indexOf("function undoableAssistantRepairRecord"),
  );
  assert.match(placement, /placeSymbol\(activeTool as SymbolKind, rawPoint\)/);
  assert.match(placement, /setDraft\(\(points\) => \[\.\.\.points, point\]\)/);
});

test("supply-run dots are visually smaller without shrinking their edit target", () => {
  assert.match(page, /className="edit-handle-hit"[\s\S]*?r="10"/);
  assert.match(page, /r=\{runSelected \? endpoint \? 4 : 3 : 2\.5\}/);
  assert.match(page, /className="draft-point"[\s\S]*?r="2\.5"/);
  assert.match(page, /fill=\{drawingColors\[activeTool as DrawType\] \|\| drawingColors\.supply\}/);
  assert.match(styles, /\.edit-handle-hit \{[^}]*fill: transparent;[^}]*pointer-events: all;/);
  assert.match(styles, /@media \(pointer: coarse\)[\s\S]*?\.edit-handle-hit \{ r: 12px; \}/);
  assert.doesNotMatch(styles, /@media \(pointer: coarse\)[\s\S]*?\.edit-handle \{ r: 8px; \}/);
});

test("redline actions disappear while drawing, editing dialogs, or placing copies and details", () => {
  assert.match(
    page,
    /const redlineSelectionActionsVisible =\s*fieldRedline\.open[\s\S]*?fieldRedline\.activeTool === "select"[\s\S]*?!fieldRedline\.pendingDetail[\s\S]*?!fieldRedline\.pendingCopy[\s\S]*?!fieldRedline\.dialog/,
  );
  assert.match(
    page,
    /const redlineSelectionWheel =\s*redlineSelectionActionsVisible/,
  );
});

test("mouse copy placement wins over object selection and keeps previews out of output", () => {
  assert.match(
    page,
    /onPointerDownCapture=\{\(event\) => \{[\s\S]*?latchCanvasPointerOwner\([\s\S]*?if \(!redlineOwnsCanvas\) \{[\s\S]*?handleRoomMarkupPlacementCapture\(event\)/,
  );
  assert.match(
    page,
    /if \(!pendingRoomMarkupCandidateId && !copyPlacement\) return;/,
  );
  assert.match(page, /className="copy-place-hud"/);
  assert.match(page, /fieldRedline\.cancelCopyPlacement/);
  assert.match(
    canvas,
    /className="redline-transient-copy"[\s\S]*?pointerEvents="none"/,
  );
});

test("oversized desktop redline selections keep actions in a compact strip", () => {
  assert.match(
    page,
    /const redlineSelectionWheelVisible = Boolean\(\s*redlineSelectionWheel,\s*\)/,
  );
  assert.match(
    page,
    /const redlineSelectionWheelUsesStrip = Boolean\(\s*redlineSelectionWheel\?\.hidden && canvasViewportSize\.width > 900/,
  );
  assert.match(
    page,
    /layout=\{redlineSelectionWheelUsesStrip \? "strip" : "wheel"\}/,
  );
});

test("touch direct-edit routing is mode-aware instead of creating placement dead zones", () => {
  assert.match(
    page,
    /planEditControlKind === "redline"[\s\S]*?\["select", "erase"\]\.includes\(fieldRedline\.activeTool\)/,
  );
  assert.match(
    page,
    /planEditControlKind === "hvac"[\s\S]*?activeTool === "select"/,
  );
  assert.match(page, /data-plan-edit-control="hvac"/);
  assert.match(
    page,
    /className=\{artworkClass\}[\s\S]*?data-plan-edit-control=\{preview \? undefined : "hvac"\}/,
  );
  assert.match(
    page,
    /className={`measurement[\s\S]*?data-plan-edit-control=\{isCopyPreview \? undefined : "hvac"\}/,
  );
  assert.match(
    page,
    /className={`branch-fitting[\s\S]*?data-plan-edit-control="hvac"/,
  );
  assert.match(
    page,
    /return <g key=\{drawing\.id\} data-plan-edit-control="hvac" className=/,
  );
  assert.match(
    canvas,
    /data-plan-edit-control=\{operable \? "redline" : undefined\}/,
  );
  assert.match(
    page,
    /const planToolAcceptsDirectTouch =[\s\S]*?copyPlacement[\s\S]*?pendingRoomMarkupCandidateId[\s\S]*?calibrating[\s\S]*?activeTool === "measure"[\s\S]*?activeTool === "branch"[\s\S]*?symbolTools\.includes[\s\S]*?\["supply", "return", "fresh"\]/,
  );
  assert.match(
    page,
    /event\.pointerType === "touch" && !planToolAcceptsDirectTouch/,
  );
  const pointerDownCapture = page.slice(
    page.indexOf("function handleViewportPointerDownCapture"),
    page.indexOf("function handleViewportPointerMoveCapture"),
  );
  assert.match(
    pointerDownCapture,
    /if \(directTouchEdit\)[\s\S]*?beginEditTransaction\(event\.pointerId\)[\s\S]*?capturePlanPointer\(\s*planOverlayRef\.current \|\| event\.currentTarget,\s*event\.pointerId,\s*\)/,
  );
  assert.match(page, /type DirectTouchPointer =/);
  assert.match(
    pointerDownCapture,
    /directTouchPointer\.pointerId !== event\.pointerId[\s\S]*?event\.stopPropagation\(\)[\s\S]*?cancelPlanPointerInteraction\(directTouchPointer\.pointerId\)[\s\S]*?touchPointersRef\.current\.set\([\s\S]*?capturePlanPointer\([\s\S]*?beginTouchGesture\(\)/,
  );
  const pointerMoveCapture = page.slice(
    page.indexOf("function handleViewportPointerMoveCapture"),
    page.indexOf("function handleViewportPointerUpCapture"),
  );
  assert.match(
    pointerMoveCapture,
    /directTouchPointerRef\.current\.point = \{[\s\S]*?event\.clientX[\s\S]*?event\.clientY[\s\S]*?return/,
  );
  assert.match(
    page,
    /function handleViewportLostPointerCapture[\s\S]*?event\.target !== event\.currentTarget[\s\S]*?restoreEditTransaction\(event\.pointerId\)[\s\S]*?handleViewportPointerCancelCapture\(event\)/,
  );
});

test("arming any plan tool releases Redline and catalog icons arm placement immediately", () => {
  const leaveRedline = page.slice(
    page.indexOf("function leaveFieldRedlineForPlanEditing"),
    page.indexOf("function activatePlanTool"),
  );
  assert.match(leaveRedline, /fieldRedline\.resetPageInteraction\(\)/);
  assert.match(leaveRedline, /releaseCanvasPointersByOwner\([^)]*"redline"/);
  assert.match(leaveRedline, /fieldRedline\.setOpen\(false\)/);
  assert.match(leaveRedline, /fieldRedline\.setTool\("select"\)/);

  const activatePlanTool = page.slice(
    page.indexOf("function activatePlanTool"),
    page.indexOf("function armSymbolPlacement"),
  );
  assert.ok(
    activatePlanTool.indexOf("leaveFieldRedlineForPlanEditing()") <
      activatePlanTool.indexOf("setActiveTool(tool)"),
  );

  const armSymbol = page.slice(
    page.indexOf("function armSymbolPlacement"),
    page.indexOf("function closeFieldRedlineStudio"),
  );
  assert.ok(
    armSymbol.indexOf("leaveFieldRedlineForPlanEditing()") <
      armSymbol.indexOf("setActiveTool(preset.kind)"),
  );
  assert.match(
    page,
    /onPointerDown=\{\(event\) => \{\s*if \(event\.button === 0\) \{\s*armSymbolPlacement\(item, true\);/,
  );
  assert.match(page, /onClick=\{\(\) => \{\s*armSymbolPlacement\(item, true\);/);
  assert.match(page, /armSymbolPlacement\(preset\);/);
});

test("drawing modes never render Redline selection boxes over the PDF", () => {
  assert.match(
    page,
    /annotationIds: fieldRedline\.pendingCopy \|\|\s*fieldRedline\.activeTool !== "select"\s*\? \[\]/,
  );
  assert.match(
    page,
    /bounds: fieldRedline\.pendingCopy \|\|\s*fieldRedline\.activeTool !== "select"\s*\? undefined/,
  );
});

test("wheel placement uses the full icon, duct-label, and rendered redline bounds", () => {
  assert.match(page, /symbolVisualPlanBounds\(selectedDrawing\)/);
  assert.match(page, /estimateDuctLabelBox\(/);
  assert.match(page, /redlineSelectionVisualBounds\(/);
  assert.match(page, /avoidBounds: selectedSymbolAvoidBounds/);
  assert.match(page, /avoidBounds: selectedRunAvoidBounds/);
  assert.match(page, /avoidBounds: selectedRedlineAvoidBounds/);
  assert.match(page, /wheelRadius: 166/);
});

test("Port 3 routes resolve once, lock their fitting, and use the live fitting anchor", () => {
  const activatePlanTool = page.slice(
    page.indexOf("function activatePlanTool"),
    page.indexOf("function armSymbolPlacement"),
  );
  assert.match(
    activatePlanTool,
    /port3BranchDraft && tool !== "supply"[\s\S]*?!port3BranchResolvedRef\.current[\s\S]*?finishDrawing\(\)/,
  );

  const finishDrawing = page.slice(
    page.indexOf("function finishDrawing"),
    page.indexOf("function extendSelectedRun"),
  );
  assert.match(
    finishDrawing,
    /if \(port3BranchResolvedRef\.current\) return;[\s\S]*?port3BranchResolvedRef\.current = true/,
  );
  assert.match(
    finishDrawing,
    /const currentBranchPort =[\s\S]*?fittingPortPoints\(fitting\)\[2\][\s\S]*?routeStartsAtCurrentPort/,
  );
  assert.match(page, /selectedPort3FittingLocked/);
  assert.match(page, /<fieldset className="fitting-edit-fieldset" disabled=\{selectedPort3FittingLocked\}>/);
  assert.match(page, /attachExistingPort3RunInstead\(fitting\.id\)/);
});

test("T/Y preview topology comes from the same geometry as the committed fitting", () => {
  const preview = page.slice(
    page.indexOf("{branchPreview && (() => {"),
    page.indexOf("{symbolPreview && (() => {"),
  );
  assert.match(preview, /const previewFitting: Drawing =/);
  assert.match(preview, /const \[inlet, outlet, branchPort\] = fittingPortPoints\(previewFitting\)/);
  assert.match(preview, /branchPreview\.portSizes\.join\("×"\)/);
  assert.doesNotMatch(
    preview,
    /const (?:inlet|outlet|branchPort) = \{[^}]*previewScale/,
  );
});
