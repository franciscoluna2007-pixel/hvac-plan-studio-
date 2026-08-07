import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, styles, display, wheel] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/workspaceDisplay.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/PlanSymbolActionWheel.tsx", import.meta.url), "utf8"),
]);

test("ordinary plan selection omits resize and rotation chrome", () => {
  assert.doesNotMatch(page, /className="symbol-resize-outline"/);
  assert.doesNotMatch(page, /className={`symbol-resize-handle/);
  assert.doesNotMatch(page, /className="symbol-label-outline"/);
  assert.doesNotMatch(page, /className="symbol-label-size-handle"/);
  assert.doesNotMatch(page, /className="rotation-ring"/);
  assert.doesNotMatch(page, /className="fitting-rotation-control"/);
  assert.doesNotMatch(page, /className="edit-handle"/);
  assert.doesNotMatch(page, /className="midpoint-grip"/);

  assert.match(page, /onPointerDown=\{preview \? undefined : \(event\) => startSymbolDrag\(event, drawing\)\}/);
  assert.match(page, /onPointerDown=\{isCopyPreview \? undefined : \(event\) => startFittingDrag\(event, drawing\)\}/);
  assert.match(page, /onPointerDown=\{isCopyPreview \? undefined : \(event\) => startLineDrag\(event, drawing\)\}/);
  assert.match(page, /aria-pressed=\{preview \? undefined : selected\}/);
  assert.match(page, /Selected on plan/);
  assert.match(page, /PLAN ICON SIZE/);
  assert.match(page, /FITTING ROTATION/);
});

test("selected actions use a single adaptive, keyboard-accessible control set", () => {
  assert.match(wheel, /layout\?: "wheel" \| "strip"/);
  assert.match(wheel, /data-wheel-layout=\{props\.layout \?\? "wheel"\}/);
  assert.match(wheel, /if \(event\.key === "Escape"\)/);
  assert.match(wheel, /aria-label=\{actionLabel\}/);
  assert.match(wheel, /Copy icon and place it with the mouse/);
  assert.match(wheel, /Rotate left 15 degrees/);
  assert.match(wheel, /Rotate right 15 degrees/);
  assert.match(wheel, /Mirror icon/);
  assert.match(wheel, /Use compact icon and label sizes/);
  assert.match(wheel, /Delete icon/);
  assert.match(wheel, /Close icon actions/);
  assert.match(page, /!selectedContextWheelVisible && <div className="field-context-toolbar"/);
  assert.match(styles, /\.symbol-action-wheel\.compact-strip/);
  assert.match(styles, /min-width: 44px;[\s\S]*height: 44px;[\s\S]*min-height: 44px;/);
});

test("desktop operational panels share responsive Material reading widths", () => {
  assert.match(styles, /@media \(min-width: 1101px\)[\s\S]*grid-template-columns: clamp\(300px, 22vw, 328px\) minmax\(520px, 1fr\) clamp\(300px, 22vw, 328px\)/);
  assert.match(styles, /--operational-ink: #202823/);
  assert.match(styles, /--operational-muted: #4e5952/);
  assert.match(styles, /--operational-panel: #fff/);
  assert.match(styles, /:is\(p, li, label\) \{[\s\S]*font-size: 15px/);
  assert.match(styles, /:is\(small, em, dt, \.supporting-copy\) \{[\s\S]*font-size: 14px/);
  assert.match(styles, /@media \(pointer: coarse\)[\s\S]*min-height: 44px/);
});

test("workspace zoom reaches twelve-times while preserving truthful shared clamping", () => {
  assert.match(display, /export const MAX_WORKSPACE_ZOOM = 12/);
  assert.match(display, /Math\.min\(MAX_WORKSPACE_ZOOM/);
  assert.match(page, /Math\.round\(zoom \* 100\)\}%/);
  assert.match(page, /cameraForCursorZoom/);
  assert.match(page, /wheelZoomFactor/);
});

test("T Branch status keeps semantic legs visible and reveals exact tip status on interaction", () => {
  assert.match(page, /function fittingStrokeWidth/);
  assert.match(page, /return runStrokeWidth\(value\) \* 1\.22/);
  assert.match(page, /className={`fitting-leg \$\{!portStates\[0\]\.connected \|\| portStates\[0\]\.overloaded \? "warning" : ""\}/);
  assert.match(styles, /\.branch-fitting \.fitting-leg\.warning \{ stroke: #ef4444/);
  assert.match(page, /T Branch Status/);
  assert.match(page, /undersized · \$\{size\}" at \$\{state\.cfm\} CFM · recommended \$\{state\.recommended\}"/);
  assert.match(page, /connected and properly sized/);
  assert.match(page, /disconnected · connect the/);
  assert.match(styles, /\.branch-fitting \.status-port \{[\s\S]*opacity: 0/);
  assert.match(styles, /\.branch-fitting:is\(:hover, :focus-visible, \.selected-fitting\) \.status-port \{[\s\S]*opacity: 1/);
  assert.match(styles, /transition: opacity 120ms ease/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/);
  assert.match(styles, /@media print[\s\S]*\.branch-fitting :is\(\.status-port, \.detailed-port\)/);
});
