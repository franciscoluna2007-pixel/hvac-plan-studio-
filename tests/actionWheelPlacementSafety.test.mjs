import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, canvas] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/RedlineCanvasLayer.tsx", import.meta.url), "utf8"),
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
