import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, layout, styles, design, sidecarSource] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../DESIGN.md", import.meta.url), "utf8"),
  readFile(new URL("../.impeccable/design.json", import.meta.url), "utf8"),
]);

const sidecar = JSON.parse(sidecarSource);

test("the product shell identifies HVAC Plan Studio as the Field Command Console", () => {
  assert.match(page, /<span>Field Command Console<\/span>/);
  assert.match(layout, /default: "HVAC Plan Studio · Field Command Console"/);
  assert.match(layout, /Plan, route, review, redline, and issue controlled HVAC work directly over the source PDF\./);
  assert.doesNotMatch(layout, /default: "HVAC Plan Studio · Field Redline Studio"/);
  assert.match(layout, /summary_large_image/);
  assert.match(layout, /url: "\/og\.png"/);
});

test("the interface exposes the approved operational color language", () => {
  for (const token of [
    "--plan-navy: #07111f",
    "--signal-cyan: #2ccce4",
    "--branch-gold: #f7b733",
    "--critical-coral: #f0525a",
    "--approval-green: #35c98b",
  ]) {
    assert.match(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(styles, /\.tool\.active \{[\s\S]*?inset 2px 0 var\(--signal-cyan\)/);
  assert.match(styles, /\.branch-designer\.active \{[\s\S]*?var\(--branch-gold\)/);
  assert.match(styles, /\.branch-workflow-hud\.run-armed,[\s\S]*?var\(--approval-green\)/);
});

test("raised instruments stay selective and field controls remain touch-safe", () => {
  assert.match(styles, /--instrument-shadow: 0 18px 48px #0008/);
  assert.match(styles, /\.field-context-toolbar \{[\s\S]*?var\(--instrument-shadow\)/);
  assert.match(styles, /\.branch-workflow-hud \{[\s\S]*?var\(--instrument-shadow\)/);
  assert.match(styles, /@media \(pointer: coarse\) \{[\s\S]*?\.tool \{ min-height: 48px; \}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?transition: none !important/);
});

test("the command deck gives the plan a dedicated rail and inset work surface", () => {
  assert.match(page, /data-layout="command-deck"/);
  assert.match(page, /className="command-rail"/);
  assert.match(page, /aria-label="Field command rail"/);
  assert.match(styles, /grid-template-areas: "rail tools canvas inspector"/);
  assert.match(styles, /--deck-rail: 64px/);
  assert.match(styles, /--deck-tools: 280px/);
  assert.match(styles, /--deck-inspector: 336px/);
  assert.match(styles, /grid-template-rows: 72px 72px minmax\(0, 1fr\) 30px/);
  assert.match(styles, /@media \(max-width: 899px\), \(orientation: portrait\) and \(pointer: coarse\)[\s\S]*?\.command-rail \{[\s\S]*?position: fixed/);
});

test("the durable design artifacts match the shipped interface system", () => {
  assert.match(design, /# HVAC Plan Studio — Field Command Console/);
  assert.match(design, /never gaming software or generic office software/);
  assert.equal(sidecar.schemaVersion, 2);
  assert.equal(sidecar.title, "HVAC Plan Studio — Field Command Console");
  assert.match(design, /The desktop shell is a \*\*Command Deck\*\*/);
  assert.equal(sidecar.extensions.layout.desktopDeck, "64px command rail, 280px tool dock, fluid plan canvas, 336px inspector");
  assert.equal(sidecar.components.length, 9);
});
