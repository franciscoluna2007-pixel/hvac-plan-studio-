import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [assistant, page, styles] = await Promise.all([
  readFile(new URL("../app/MarkupAssistantStudio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("v128 presents Plan setup and one Fix Plan instead of separate Problems and Fixes tabs", () => {
  assert.match(assistant, /PRIMARY_VIEW_ORDER: AssistantView\[\] = \["setup", "repair-plan"\]/);
  assert.match(assistant, /\["repair-plan", "Fix Plan", repairPlan\.actions\.length\]/);
  assert.doesNotMatch(assistant, /\["recommendations", "Problems", recommendations\.length\]/);
  assert.match(assistant, /One place to find a problem and approve its fix/);
});

test("the one-card flow answers where, wrong, fix, result, yes, and no", () => {
  assert.match(assistant, /1 · WHERE/);
  assert.match(assistant, /2 · WHAT IS WRONG/);
  assert.match(assistant, /3 · HOW I WOULD FIX IT/);
  assert.match(assistant, /4 · EXPECTED RESULT/);
  assert.match(assistant, /Yes · fix this/);
  assert.match(assistant, /No · leave for later/);
  assert.match(assistant, /Apply this fix · one Undo/);
  assert.match(assistant, /showLegacyRepairPlan = false/);
});

test("connection choices and endpoint repairs live inside the same Fix Plan", () => {
  assert.match(assistant, /connectionDisplayActions/);
  assert.match(assistant, /CHOOSE THE EXISTING RUN YOU RECOGNIZE/);
  assert.match(assistant, /onChooseConnectionCandidate/);
  assert.match(assistant, /onApplyConnectionRepair/);
  assert.match(page, /connectionRepairItems=\{activeConnectionRepairIssues\}/);
  assert.match(page, /applyConnectionRepairSelection\(\[itemId\], evidenceFingerprint\)/);
  assert.match(page, /openMarkupAssistant\("fix-plan"\)/);
});

test("the assistant review layer is transient, page-scoped, pointer-inert, and omitted from print", () => {
  assert.match(page, /assistantSuggestionLayer\.status === "review"/);
  assert.match(page, /id="assistant-suggestion-layer"/);
  assert.match(page, /suggestion\.point\.x \* renderSize\.width/);
  assert.match(page, /suggestion\.point\.y \* renderSize\.height/);
  assert.match(styles, /\.assistant-suggestion-layer\s*\{\s*pointer-events: none;/);
  assert.match(styles, /@media print[\s\S]*?\.assistant-suggestion-layer,[\s\S]*?display: none !important;/);
});

test("run and fitting selections use object-specific wheels and duct labels persist scale", () => {
  assert.match(page, /labelScale\?: number/);
  assert.match(page, /normalizedDuctLabelScale\(drawing\.labelScale\)/);
  assert.match(page, /variant="run"/);
  assert.match(page, /variant="fitting"/);
  assert.match(page, /onLabelSmaller=\{\(\) => adjustSelectedRunLabelScale\(-1\)\}/);
  assert.match(page, /onResetLabel=\{resetSelectedRunLabel\}/);
  assert.match(page, /splitActive=\{splitMode\}/);
  assert.match(page, /Copy is limited to icons and measurements so duct connections cannot be duplicated accidentally/);
  assert.match(page, /Duplicate is limited to icons and measurements so duct connections stay intact/);
  assert.match(page, /Mirror is limited to icons and measurements so duct routing stays intact/);
  assert.match(page, /disabled=\{!selectedRunHasLabel\}/);
  assert.match(page, /!selectedContextWheelVisible/);
});
