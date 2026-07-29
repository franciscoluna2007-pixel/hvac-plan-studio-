import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, editing, wheel, styles, layout, analytics, readme, roadmap] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/symbolEditing.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/PlanSymbolActionWheel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/productAnalytics.ts", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../ROADMAP.md", import.meta.url), "utf8"),
]);

test("v127 permits genuinely compact icons and labels without changing legacy fallback", () => {
  assert.match(editing, /MIN_SYMBOL_SCALE = 0\.2/);
  assert.match(editing, /MIN_SYMBOL_LABEL_SCALE = 0\.3/);
  assert.match(editing, /DEFAULT_TERMINAL_SYMBOL_SCALE = 0\.35/);
  assert.match(editing, /DEFAULT_TERMINAL_LABEL_SCALE = 0\.4/);
  assert.match(editing, /finiteNumber\(value, 1\)/);

  assert.match(page, /const visibleHandleSize = 9 \/ Math\.max\(\.25, zoom\)/);
  assert.match(page, /const resizeHitRadius = 22 \/ Math\.max\(\.25, zoom\)/);
  assert.match(page, /const labelHitRadius = 22 \/ Math\.max\(\.25, zoom\)/);
  assert.match(page, /className="symbol-direct-hit"/);
  assert.match(styles, /\.symbol-direct-hit \{[^}]*pointer-events: all/);
  assert.match(styles, /paint-order: stroke fill/);
});

test("v127 keeps wheel editing and adds one-tap compact sizing", () => {
  assert.match(wheel, /onCompact: \(\) => void/);
  assert.match(wheel, /label: "Use compact icon and label sizes"/);
  assert.match(wheel, /shortLabel: "Compact"/);
  assert.match(page, /onCompact=\{compactSelectedSymbol\}/);
  assert.match(page, /maxObjectRadiusPx: DEFAULT_SYMBOL_ACTION_WHEEL_OBJECT_RADIUS_CAP_PX/);
  assert.match(page, /Use compact icon and label sizes/);
  assert.match(styles, /\.symbol-wheel-action\.action-compact/);
  assert.match(editing, /Math\.min\(\s*normalizedSymbolScale\(value\),\s*defaultSymbolScale\(kind\)/);
  assert.match(editing, /Math\.min\(\s*normalizedSymbolLabelScale\(value\),\s*defaultSymbolLabelScale\(kind\)/);

  assert.match(page, /function adjustSelectedSymbolSize\(direction: -1 \| 1\)/);
  assert.match(page, /function adjustSelectedSymbolLabelSize\(direction: -1 \| 1\)/);
  assert.match(page, /− Smaller/);
  assert.match(page, /Larger \+/);
  assert.match(page, /function compactPageTerminalSymbols\(\)/);
  assert.match(page, /Compact all supply &amp; return symbols on this sheet/);
  assert.match(page, /one Undo restores them/);
});

test("v127 removes SIZE LATER and leaves unconfirmed supply and return runs unlabeled", () => {
  assert.doesNotMatch(page, /SIZE LATER/);
  assert.doesNotMatch(readme, /SIZE LATER/);
  assert.doesNotMatch(roadmap, /SIZE LATER/);
  assert.match(page, /New supply and return runs stay unlabeled until you confirm a size/);
  assert.match(page, /drawing\.sizeReviewed === true \? `\$\{drawing\.size\}"/);
  assert.match(page, /const runLabelText = \[/);
  assert.match(page, /\{runLabelText && <text/);
  assert.match(page, /\{runLabelText\}/);
});

test("current release metadata stays image-free and identifies Finish the Job", () => {
  assert.match(layout, /HVAC Plan Studio · Finish the Job/);
  assert.match(layout, /Review materials, clear plan holds/);
  assert.doesNotMatch(layout, /\bimages\s*:/);
  assert.doesNotMatch(layout, /summary_large_image/);
  assert.match(analytics, /app_version: "132"/);
  assert.match(readme, /Current release\s+[—-]\s+v132/i);
  assert.match(readme, /v132\s+[—-]\s+Finish the Job/i);
  assert.match(readme, /v131\s+[—-]\s+Room-by-Room Markup/i);
  assert.match(readme, /v130\s+[—-]\s+Answer & Fix in Place/i);
  assert.match(readme, /v129\s+[—-]\s+One Job Screen/i);
  assert.match(readme, /v128\s+[—-]\s+Fix Plan & Contextual Markup/i);
  assert.match(readme, /v127\s+[—-]\s+Compact Symbol Workflow/i);
  assert.match(roadmap, /\| v130 \| Answer & Fix in Place \| Shipped \|/);
  assert.match(roadmap, /\| v131 \| Room-by-Room Markup \| Shipped \|/);
  assert.match(roadmap, /\| v132 \| Finish the Job \| Shipped \|/);
  assert.match(roadmap, /\| v129 \| One Job Screen \| Shipped \|/);
  assert.match(roadmap, /\| v128 \| Fix Plan & Contextual Markup \| Shipped \|/);
  assert.match(roadmap, /\| v127 \| Compact Symbol Workflow \| Shipped \|/);
});
