import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadTypescriptModule } from "./load-typescript-module.mjs";

const finishJob = await loadTypescriptModule(new URL("../app/finishJob.ts", import.meta.url));
const [page, studio, composer, styles, readme, roadmap, analytics] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/FinishJobStudio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/FieldPackageComposer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../ROADMAP.md", import.meta.url), "utf8"),
  readFile(new URL("../app/productAnalytics.ts", import.meta.url), "utf8"),
]);

function model(overrides = {}) {
  return finishJob.buildFinishJobModel({
    materialRowCount: 12,
    materialReviewCurrent: false,
    gates: [
      { id: "materials", label: "Materials", clear: false, detail: "Review" },
      { id: "scale", label: "Scale", clear: true, detail: "Verified" },
      { id: "checklist", label: "Checklist", clear: false, detail: "0/8" },
    ],
    checklistComplete: 0,
    checklistTotal: 8,
    releaseCurrent: false,
    releaseStale: false,
    ...overrides,
  });
}

test("chooses the first incomplete Finish the Job step deterministically", () => {
  assert.equal(model().currentStep, "materials");
  assert.equal(model({ materialReviewCurrent: true }).currentStep, "checklist");
  assert.equal(model({
    materialReviewCurrent: true,
    checklistComplete: 8,
  }).currentStep, "revision");
  assert.equal(model({
    materialReviewCurrent: true,
    checklistComplete: 8,
    releaseCurrent: true,
    releaseRevision: "IFC-1",
  }).currentStep, "print-share");
});

test("keeps technical holds separate without waiving checklist or cloud release gates", () => {
  const result = model({
    materialReviewCurrent: true,
    gates: [
      { id: "connections", label: "Connections", clear: false, detail: "1 open" },
      { id: "checklist", label: "Checklist", clear: false, detail: "5/8" },
      { id: "cloud", label: "Cloud", clear: false, detail: "Needs approval" },
    ],
  });
  assert.deepEqual(result.technicalHolds.map((gate) => gate.id), ["connections"]);
  assert.equal(result.cloudGate?.id, "cloud");
  assert.equal(result.currentStep, "holds");
  assert.equal(result.jobReady, false);
});

test("provides a plain-language action for every current release gate", () => {
  const ids = [
    "materials", "runs", "critical", "warning", "connections", "elevations",
    "rooms", "scale", "checklist", "rfi", "punch", "cloud",
  ];
  for (const id of ids) {
    assert.notEqual(finishJob.finishJobGateActionLabel(id), "Open this item", id);
  }
});

test("binds final approval to the exact source, release, materials, reviewer, and note", () => {
  const base = {
    systemId: "system-1",
    sourceFingerprint: "pdf-a",
    releaseSignature: "release-a",
    materialFingerprint: "materials-a",
    materialReviewId: "review-a",
    revision: "IFC-1",
    reviewedBy: "FL",
    note: "West wing",
  };
  const fingerprint = finishJob.finishJobApprovalFingerprint(base);
  assert.equal(fingerprint, finishJob.finishJobApprovalFingerprint({ ...base }));
  for (const [field, value] of [
    ["sourceFingerprint", "pdf-b"],
    ["releaseSignature", "release-b"],
    ["materialFingerprint", "materials-b"],
    ["materialReviewId", "review-b"],
    ["revision", "IFC-2"],
    ["reviewedBy", "AB"],
    ["note", "East wing"],
  ]) {
    assert.notEqual(
      fingerprint,
      finishJob.finishJobApprovalFingerprint({ ...base, [field]: value }),
      field,
    );
  }
});

test("makes output readiness section-aware", () => {
  const readiness = finishJob.buildOutputSectionReadiness({
    releaseCurrent: true,
    materialReviewCurrent: false,
    commissioningReady: false,
    scaleVerified: true,
    hvacLayersVisible: true,
  });
  assert.equal(readiness.plan.ready, true);
  assert.equal(readiness.release.ready, true);
  assert.equal(readiness.materials.ready, false);
  assert.equal(readiness.startup.ready, false);
  assert.equal(finishJob.selectedOutputIsReady(["plan", "release"], readiness), true);
  assert.equal(finishJob.selectedOutputIsReady(["plan"], readiness), false);
  assert.equal(finishJob.selectedOutputIsReady([], readiness), false);
  assert.equal(finishJob.selectedOutputIsReady(["plan", "materials"], readiness), false);
  assert.equal(finishJob.selectedOutputIsReady(["startup"], readiness), false);
});

test("integrates one visible Finish the Job path and preserves manual issue approval", () => {
  assert.match(page, /id: "finish",\s*label: "Finish the Job"/);
  assert.match(page, /run: openFinishJobStudio/);
  assert.match(page, /<FinishJobStudio/);
  assert.match(page, /function issueSystemRelease\(approvalFingerprint: string\)/);
  assert.match(page, /approvalFingerprint !== expectedApprovalFingerprint/);
  assert.match(page, /releaseIssueLockRef\.current/);
  assert.match(page, /finishApprovalFingerprintRef\.current !== expectedApprovalFingerprint/);
  assert.match(page, /systemName: systemLabel\(systemId\)/);
  assert.match(page, /returnToFinishGateId/);
  assert.match(page, /copyCurrentFinishJobSummary/);
  assert.doesNotMatch(page, /navigator\.share/);
  assert.match(page, /existing && latestMaterialReview\(\)\?\.id === existing\.id/);
  assert.match(page, /Current material quantities reviewed/);
  assert.match(page, /materialFingerprint: materialReviewFingerprint\(\)/);
  assert.match(page, /version: 8,/);
  assert.match(page, /materialReviewRecords,/);
  assert.doesNotMatch(page, /label: "Materials & Print"/);
});

test("keeps Finish the Job readable, keyboard-contained, and mobile-safe", () => {
  assert.match(studio, /role="dialog"/);
  assert.match(studio, /aria-modal="true"/);
  assert.match(studio, /aria-current=\{activeStep === step\.id \? "step"/);
  assert.match(studio, /aria-expanded=\{activeStep === step\.id\}/);
  assert.match(studio, /aria-label=\{`\$\{index \+ 1\}\. \$\{step\.label\}/);
  assert.match(studio, /<fieldset>/);
  assert.doesNotMatch(studio, /<main[\s>]/);
  assert.match(studio, /<FinalApprovalControl[\s\S]*?key=\{approvalFingerprint\}/);
  assert.match(studio, /I reviewed this exact plan, material list, holds, and field checklist\./);
  assert.match(studio, /Nothing issues automatically/);
  assert.doesNotMatch(studio, /Check all|Approve all|Accept all/i);
  assert.match(styles, /\.finish-job-studio/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\.finish-job-studio \{\s*width: 100vw;\s*height: 100dvh;/);
  assert.match(styles, /font-size: 14px/);
});

test("forces stale selected output sections to print as a draft and excludes transient plan marks", () => {
  assert.match(composer, /selectedSectionHolds/);
  assert.match(composer, /selectedOutputIsReady\(selectedSections, sectionReadiness\)/);
  assert.match(composer, /releaseRecordMissing/);
  assert.match(composer, /RELEASE RECORD REQUIRED/);
  assert.match(composer, /DRAFT · SECTION REVIEW REQUIRED/);
  assert.match(composer, /Plan scope/);
  assert.match(page, /Output fingerprint:/);
  assert.match(page, /packageOutputFingerprint/);
  for (const transientClass of [
    "draft-drawing",
    "measure-preview",
    "branch-opportunity-marker",
    "step-one-repair-preview",
  ]) {
    assert.match(styles, new RegExp(`\\.${transientClass}`));
  }
});

test("keeps V132 warnings and supporting copy above the readability floor", () => {
  assert.match(styles, /\.package-section-holds strong \{[\s\S]*?font-size: 13px;/);
  assert.match(styles, /\.package-section-holds span \{[\s\S]*?font-size: 12px;/);
  assert.match(styles, /\.package-more-presets > summary,[\s\S]*?font-size: 12px;/);
  assert.match(styles, /@media \(max-height: 680px\) and \(min-width: 761px\)/);
});

test("publishes V132 product metadata and roadmap", () => {
  assert.match(analytics, /app_version: "132"/);
  assert.match(readme, /## Current release — v132/);
  assert.match(readme, /### v132 — Finish the Job/);
  assert.match(roadmap, /\| v132 \| Finish the Job \| Shipped \|/);
  assert.match(roadmap, /## v132 — Finish the Job/);
});
