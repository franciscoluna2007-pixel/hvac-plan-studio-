import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const assistant = await readFile(new URL("app/MarkupAssistantStudio.tsx", root), "utf8");
const page = await readFile(new URL("app/page.tsx", root), "utf8");
const css = await readFile(new URL("app/globals.css", root), "utf8");

test("keeps issue search, answers, exact preview, approval, and Undo in one Plan Check card", () => {
  assert.match(assistant, /Review one item at a time/);
  assert.match(assistant, /role="search"/);
  assert.match(assistant, /Find an item/);
  assert.match(assistant, /rankFixPlanActions\(visibleFixActions, fixQuery\)\.slice\(0, 3\)/);
  assert.match(assistant, /EXACT CHANGE PREVIEW/);
  assert.match(assistant, /Answer here/);
  assert.match(assistant, /Handled elsewhere/);
  assert.match(assistant, /This records a job condition; it does not change the drawing\./);
  assert.match(assistant, /Handled-elsewhere and critical answers remain open release holds\./);
  assert.match(assistant, /Fixed\. The plan and evidence were checked again before saving\./);
  assert.match(assistant, /Undo this fix/);
});

test("connection repair is staged behind named review and final confirmation", () => {
  const start = assistant.indexOf("function approveSingleAction");
  const end = assistant.indexOf("function skipAction", start);
  const approvalBody = assistant.slice(start, end);
  assert.match(approvalBody, /setSelectedConnectionActionId\(action\.id\)/);
  assert.doesNotMatch(approvalBody, /onApplyConnectionRepair\(/);
  assert.match(assistant, /await onApplyConnectionRepair\(\{/);
  assert.match(assistant, /reviewer: reviewer\.trim\(\)/);
  assert.match(assistant, /connectionConfirmationKey/);
  assert.match(page, /reviewer: input\.reviewer/);
  assert.match(page, /kind: "manual-follow-up" as const/);
  assert.match(page, /connectionRepairPreviewChanges\(item\)/);
  assert.match(page, /T Branch port \$\{item\.port \+ 1\} run reference/);
  assert.match(page, /\$\{item\.slot \|\| "terminal"\} connected endpoint/);
});

test("v130 answers are source-bound and handled-elsewhere never clears review", () => {
  assert.match(page, /FIX_PLAN_ANSWER_VERSION/);
  assert.match(page, /isFixPlanAnswerStale\(\{/);
  assert.match(page, /fixPlanAnswerCompletesReview\(\{/);
  assert.match(page, /status === "handled-elsewhere"/);
  assert.match(page, /remains open in Plan Check/);
  assert.match(page, /version: 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8 \| 9;/);
  assert.match(
    page,
    /const buildProjectSnapshot = useCallback\(\(\): SavedProject => \{[\s\S]*?return \{\s*version: 9,/,
  );
  assert.match(page, /\[activeSystem, activeValidationIssues, fileName, pdfFingerprint, punchItems, reviewDecisionsBySystem, rfiItems\]/);
  assert.doesNotMatch(assistant, /onReopenIssueAnswer/);
});

test("Fix Plan can reach system-only evidence and keeps its markers visible", () => {
  assert.match(page, /rightTab !== "checks" && !showMarkupAssistant/);
  assert.match(page, /const nextIssue = activeReviewedIssueRows\.find\(\(row\) =>\s*!row\.resolvedByDecision\s*\)/);
  assert.match(page, /const selectable = activeReviewedIssueRows\.filter\(\(row\) => !row\.resolvedByDecision\)/);
  assert.doesNotMatch(page, /const selectable = activeReviewedIssueRows\.filter\(\(row\) => !row\.resolvedByDecision && row\.issue\.drawingId\)/);
});

test("Plan Check launch is an advisory strip instead of a fifth selected tab", () => {
  assert.match(page, /className="right-tablist" role="tablist"/);
  assert.match(page, /<PlanCheckStrip/);
  assert.match(page, /onReview=\{\(\) => openMarkupAssistant\("fix-plan"\)\}/);
  assert.doesNotMatch(page, /role="tab" aria-selected=\{showMarkupAssistant\}/);
  assert.match(css, /\.right-tablist \{/);
});

test("v130 uses a desktop sidecar and a mobile bottom sheet", () => {
  assert.match(assistant, /fix-plan-sidecar/);
  assert.match(css, /\.markup-assistant-overlay\.fix-plan-sidecar \{/);
  assert.match(css, /width: min\(430px, 40vw\)/);
  assert.match(css, /height: min\(72vh, 760px\)/);
});

test("inline Undo remains bound to the top assistant receipt", () => {
  assert.match(page, /canUndo=\{Boolean\(undoableAssistantRepairRecord\(\)\)\}/);
  assert.doesNotMatch(assistant, /canUndoPlanChange/);
  assert.match(assistant, /disabled=\{!canUndo\}/);
});
