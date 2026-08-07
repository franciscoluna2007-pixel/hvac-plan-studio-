import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, finish, assistant, styles] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/FinishJobStudio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/MarkupAssistantStudio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("centers the workspace on the approved four-step workflow", () => {
  const open = page.indexOf("Open plan");
  const draw = page.indexOf("Draw HVAC");
  const materials = page.indexOf("Materials", draw);
  const exportPlan = page.indexOf("Export", materials);
  assert.ok(open >= 0 && open < draw && draw < materials && materials < exportPlan);
  assert.match(page, /aria-label="Plan workflow"/);
  assert.match(page, /className={`app-shell swiss-plan-workspace/);
  assert.match(styles, /\.command-rail-main > button::before/);
});

test("replaces Plan Check with a focused Connection Check", () => {
  assert.match(finish, /finish-plan-check-action/);
  assert.match(finish, /Check connections\{planCheckCount/);
  assert.match(page, /planCheckCount=\{activeConnectionRepairIssues\.length\}/);
  assert.match(page, /onOpenPlanCheck=\{\(\) => \{/);
  assert.match(page, /aria-label="Connection Check"/);
  assert.match(page, /It never creates or moves duct without your approval/);
  assert.doesNotMatch(page, /<PlanCheckStrip/);
});

test("keeps the retired rule engine out of the visible workspace", () => {
  assert.match(assistant, /PLAN CHECK/);
  assert.match(assistant, /Checks are advisory/);
  assert.match(assistant, /<details className="assistant-more-tools">/);
  assert.match(page, /\{false && mountMarkupAssistantStudio && <MarkupAssistantStudio/);
  assert.doesNotMatch(assistant, /PLAN HELPER/);
  assert.doesNotMatch(assistant, /NOTHING CHANGES WITHOUT APPROVAL/);
});

test("applies the scoped Material Cobalt presentation without changing plan drawing colors", () => {
  assert.match(styles, /--material-plan: #ffffff/);
  assert.match(styles, /--material-shell: #edf0ee/);
  assert.match(styles, /--material-blue: #002fa7/);
  assert.match(styles, /font-family: var\(--font-geist-sans\)/);
  assert.match(styles, /data-presentation="material-cobalt"[\s\S]*?:is\(\.plan-sheet, \.pdf-stage canvas\)/);
  assert.doesNotMatch(styles, /\.app-shell\.swiss-plan-workspace[\s\S]*?drawingColors/);
});
