import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

function bodyBetween(start, end) {
  return page.slice(page.indexOf(start), page.indexOf(end));
}

test("mouse editing leaves pointer capture with the visible SVG target", () => {
  const viewportDown = bodyBetween(
    "function handleViewportPointerDownCapture",
    "function handleViewportPointerMoveCapture",
  );
  assert.match(viewportDown, /if \(event\.button === 0\) return/);
  assert.doesNotMatch(
    viewportDown.slice(viewportDown.lastIndexOf("if (event.button === 2)")),
    /capturePlanPointer\(event\.currentTarget, event\.pointerId\)/,
  );

  for (const [start, end] of [
    ["function startLineDrag", "function startRunLabelDrag"],
    ["function startFittingDrag", "function startFittingRotation"],
    ["function startSymbolDrag", "function displayedSymbolLabel"],
  ]) {
    const drag = bodyBetween(start, end);
    assert.match(drag, /beginEditTransaction\(event\.pointerId\)/);
    assert.match(drag, /ownerSVGElement\?\.setPointerCapture\(event\.pointerId\)/);
  }
});

test("plain wheel zoom uses a native capture-phase non-passive listener on the plan canvas", () => {
  assert.match(
    page,
    /viewport\.addEventListener\("wheel", onWheel, \{ capture: true, passive: false \}\)/,
  );
  assert.match(page, /viewport\.focus\(\{ preventScroll: true \}\)/);
  assert.match(page, /wheelHandlerRef\.current\(event\)/);
  assert.match(page, /return \(\) => viewport\.removeEventListener\("wheel", onWheel, true\)/);
  assert.match(page, /deltaX: event\.deltaX/);
  assert.match(page, /viewportHeight: viewport\.clientHeight/);
  assert.match(page, /tabIndex=\{0\}/);
  assert.match(page, /aria-label="Plan canvas workspace"/);
  assert.match(page, /const editIsActive = Boolean\([\s\S]*?dragRef\.current[\s\S]*?selectionBox[\s\S]*?directBranchPlacementGestureRef\.current/);
  assert.match(page, /activeEditPointerIdRef\.current = null;[\s\S]*?editTransactionRef\.current = null;/);
  assert.doesNotMatch(page, /onWheel=\{handleWheelZoom\}/);
});

test("T Branch release commits once in capture phase and exits the pointer transaction", () => {
  const pointerUp = bodyBetween(
    "function handleViewportPointerUpCapture",
    "function handleViewportPointerCancelCapture",
  );
  assert.match(pointerUp, /if \(finishDirectBranchPlacementGesture\(event\)\)/);
  assert.match(pointerUp, /event\.stopPropagation\(\)/);
  assert.match(pointerUp, /activeEditPointerIdRef\.current = null/);
  assert.match(pointerUp, /releasePlanPointerCapture\(event\.pointerId\)/);
  assert.match(pointerUp, /return;/);
});

test("Copy and repeated Paste stay visible whenever a movable selection is active", () => {
  assert.match(
    page,
    /selectedId && planSelectionActionsVisible && <div className="field-context-toolbar"/,
  );
  assert.match(page, /className="copy-primary"[\s\S]*?Copy &amp; paste/);
  assert.match(page, /Placed · move and click again · Esc or right-click finishes/);
});

test("right-clicking a plan item opens the primary compact Copy menu without starting pan", () => {
  const viewportDown = bodyBetween(
    "function handleViewportPointerDownCapture",
    "function handleViewportPointerMoveCapture",
  );
  assert.match(viewportDown, /closest\("\[data-plan-drawing-id\]"\)/);
  assert.match(viewportDown, /event\.button === 2[\s\S]*?openPlanContextMenu\(/);
  assert.match(page, /if \(!selectedIds\.includes\(drawing\.id\)\) selectOnly\(drawing\.id\)/);
  assert.match(page, /className="plan-context-menu"/);
  assert.match(page, /role="menuitem"/);
  assert.match(page, /ref=\{planContextMenuRef\}/);
  assert.match(page, /closePlanContextMenu\(true\)/);
  assert.match(page, /<Copy size=\{15\} \/> Copy/);
  assert.match(page, /data-plan-drawing-id=\{preview \? undefined : drawing\.id\}/);
  assert.match(page, /data-plan-drawing-id=\{isCopyPreview \? undefined : drawing\.id\}/);
});

test("core plan objects expose selection and context-menu keyboard access", () => {
  assert.match(page, /function handlePlanDrawingKeyDown/);
  assert.match(page, /event\.key === "ContextMenu" \|\| \(event\.shiftKey && event\.key === "F10"\)/);
  assert.match(page, /aria-label=\{preview \? undefined : planDrawingAccessibleLabel\(drawing\)\}/);
  assert.match(page, /tabIndex=\{isCopyPreview \? undefined : 0\}/);
  assert.match(page, /aria-pressed=\{isCopyPreview \? undefined : runSelected\}/);
});

test("T Branch placement never manufactures a surprise third run", () => {
  const placement = bodyBetween(
    "function placeSmartBranch",
    "function updateFittingPortSize",
  );
  assert.match(placement, /const branchRunId = matchedRoute\?\.drawing\.id \|\| ""/);
  assert.match(placement, /const branchRun: Drawing \| null = matchedRoute/);
  assert.match(placement, /\.\.\.\(branchRun \? \[branchRun\] : \[\]\)/);
  assert.match(placement, /connectedIds: \[target\.drawing\.id, downstreamId, branchRunId\]/);
  assert.match(placement, /setPendingBranchFittingId\(fittingId\)/);
  assert.doesNotMatch(placement, /id: branchRunId,[\s\S]*?type: "supply"/);
});
