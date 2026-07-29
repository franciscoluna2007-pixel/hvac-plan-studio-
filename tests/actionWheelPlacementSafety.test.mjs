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

test("redline actions disappear while drawing, editing dialogs, or placing details", () => {
  assert.match(
    page,
    /const redlineSelectionActionsVisible =\s*fieldRedline\.open[\s\S]*?fieldRedline\.activeTool === "select"[\s\S]*?!fieldRedline\.pendingDetail[\s\S]*?!fieldRedline\.dialog/,
  );
  assert.match(
    page,
    /const redlineSelectionWheel =\s*redlineSelectionActionsVisible/,
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
