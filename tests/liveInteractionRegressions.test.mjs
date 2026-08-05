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

test("plain wheel zoom uses one native non-passive listener", () => {
  assert.match(
    page,
    /viewport\.addEventListener\("wheel", onWheel, \{ passive: false \}\)/,
  );
  assert.match(page, /return \(\) => viewport\.removeEventListener\("wheel", onWheel\)/);
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
