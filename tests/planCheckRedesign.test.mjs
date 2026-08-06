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

test("keeps Plan Check optional inside Export instead of occupying the workspace", () => {
  assert.match(finish, /finish-plan-check-action/);
  assert.match(finish, /Check plan\{planCheckCount/);
  assert.match(page, /planCheckCount=\{planCheckCount\}/);
  assert.match(page, /onOpenPlanCheck=\{\(\) => \{/);
  assert.doesNotMatch(page, /<PlanCheckStrip/);
});

test("uses factual Plan Check language and keeps details user-invoked", () => {
  assert.match(assistant, /PLAN CHECK/);
  assert.match(assistant, /Checks are advisory/);
  assert.match(assistant, /<details className="assistant-more-tools">/);
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
