import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  FIX_PLAN_ANSWER_VERSION,
  FIX_PLAN_HANDLED_REASON_OPTIONS,
  fixPlanAnswerCompletesReview,
  isFixPlanAnswerStale,
} = await loadTypescriptModule(
  new URL("../app/fixPlanAnswers.ts", import.meta.url),
);

const currentBinding = {
  issueId: "review-system-1-return-deficit",
  evidenceFingerprint: "issue-evidence-a",
  sourceFingerprint: "plan-source-a",
};

test("v130 answer records expose stable handled-elsewhere reasons", () => {
  assert.equal(FIX_PLAN_ANSWER_VERSION, "fix-plan-answers-v130.0");
  assert.deepEqual(FIX_PLAN_HANDLED_REASON_OPTIONS, [
    { value: "already-resolved", label: "Already resolved elsewhere" },
    { value: "tracked-in-rfi", label: "Tracked in an RFI" },
    { value: "tracked-in-punch", label: "Tracked in a punch item" },
    { value: "different-system", label: "Belongs to a different system" },
    { value: "field-verification", label: "Needs field verification" },
    { value: "other", label: "Other documented workflow" },
  ]);
  assert.equal(
    new Set(FIX_PLAN_HANDLED_REASON_OPTIONS.map((option) => option.value)).size,
    FIX_PLAN_HANDLED_REASON_OPTIONS.length,
  );
  assert.ok(FIX_PLAN_HANDLED_REASON_OPTIONS.every((option) => option.label.trim()));
});

test("answer staleness is bound to the exact issue, evidence, and plan source", () => {
  assert.equal(isFixPlanAnswerStale(currentBinding, currentBinding), false);
  assert.equal(isFixPlanAnswerStale(
    { ...currentBinding, issueId: "review-system-1-other" },
    currentBinding,
  ), true);
  assert.equal(isFixPlanAnswerStale(
    { ...currentBinding, evidenceFingerprint: "issue-evidence-b" },
    currentBinding,
  ), true);
  assert.equal(isFixPlanAnswerStale(
    { ...currentBinding, sourceFingerprint: "plan-source-b" },
    currentBinding,
  ), true);
});

test("missing answer or current bindings are stale instead of reusable", () => {
  for (const field of ["issueId", "evidenceFingerprint", "sourceFingerprint"]) {
    assert.equal(
      isFixPlanAnswerStale({ ...currentBinding, [field]: "" }, currentBinding),
      true,
      `blank saved ${field}`,
    );
    assert.equal(
      isFixPlanAnswerStale(currentBinding, { ...currentBinding, [field]: "" }),
      true,
      `blank current ${field}`,
    );
  }
});

test("critical and stale answers never complete review", () => {
  for (const status of ["accepted", "rfi", "punch", "handled-elsewhere"]) {
    assert.equal(fixPlanAnswerCompletesReview({
      severity: "critical",
      status,
      stale: false,
      rfiStatus: "approved",
      punchStatus: "resolved",
    }), false);
    assert.equal(fixPlanAnswerCompletesReview({
      severity: "warning",
      status,
      stale: true,
      rfiStatus: "approved",
      punchStatus: "resolved",
    }), false);
  }
});

test("handled elsewhere is documentation only and never completes review", () => {
  for (const severity of ["warning", "info"]) {
    assert.equal(fixPlanAnswerCompletesReview({
      severity,
      status: "handled-elsewhere",
      stale: false,
      rfiStatus: "approved",
      punchStatus: "resolved",
    }), false);
  }
});

test("accepted completes only a current noncritical review", () => {
  assert.equal(fixPlanAnswerCompletesReview({
    severity: "warning",
    status: "accepted",
    stale: false,
  }), true);
  assert.equal(fixPlanAnswerCompletesReview({
    severity: "info",
    status: "accepted",
    stale: false,
  }), true);
  assert.equal(fixPlanAnswerCompletesReview({
    severity: "warning",
    status: null,
    stale: false,
  }), false);
});

test("RFI answers complete only after approval or closure", () => {
  for (const rfiStatus of [undefined, null, "draft", "submitted", "answered"]) {
    assert.equal(fixPlanAnswerCompletesReview({
      severity: "warning",
      status: "rfi",
      stale: false,
      rfiStatus,
    }), false);
  }
  for (const rfiStatus of ["approved", "closed"]) {
    assert.equal(fixPlanAnswerCompletesReview({
      severity: "warning",
      status: "rfi",
      stale: false,
      rfiStatus,
    }), true);
  }
});

test("punch answers complete only after the punch item is resolved", () => {
  for (const punchStatus of [undefined, null, "open"]) {
    assert.equal(fixPlanAnswerCompletesReview({
      severity: "warning",
      status: "punch",
      stale: false,
      punchStatus,
    }), false);
  }
  assert.equal(fixPlanAnswerCompletesReview({
    severity: "warning",
    status: "punch",
    stale: false,
    punchStatus: "resolved",
  }), true);
});
