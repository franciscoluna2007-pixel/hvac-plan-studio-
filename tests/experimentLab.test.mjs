import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const root = process.cwd();
const component = fs.readFileSync(path.join(root, "app", "experiment-lab", "ExperimentLab.tsx"), "utf8");
const canvas = fs.readFileSync(path.join(root, "app", "experiment-lab", "LabPlanCanvas.tsx"), "utf8");
const fixtures = fs.readFileSync(path.join(root, "app", "experiment-lab", "labFixtures.ts"), "utf8");
const adapter = fs.readFileSync(path.join(root, "app", "geometryComparison.ts"), "utf8");
const documentation = fs.readFileSync(path.join(root, "docs", "EXPERIMENT_LAB.md"), "utf8");
const route = fs.readFileSync(path.join(root, "app", "experiment-lab", "page.tsx"), "utf8");

const lab = await loadTypescriptModule(new URL("../app/experiment-lab/labFixtures.ts", import.meta.url));

test("experiment lab runs both real geometry adapter contracts", () => {
  const elbow = lab.previewGeometryComparison("elbow", lab.initialGeometryInputs);
  const reducer = lab.previewGeometryComparison("reducer", lab.initialGeometryInputs);

  assert.equal(elbow.status, "match");
  assert.equal(elbow.comparisonKind, "elbow-tangent-trim");
  assert.ok(elbow.baseline);
  assert.ok(elbow.candidate);
  assert.equal(reducer.status, "match");
  assert.equal(reducer.comparisonKind, "rectangular-reducer-outline");
  assert.ok(reducer.baseline);
  assert.ok(reducer.candidate);
});

test("invalid live geometry is rejected rather than converted into positive evidence", () => {
  const rejected = lab.previewGeometryComparison("reducer", {
    ...lab.initialGeometryInputs,
    reducer: {
      ...lab.initialGeometryInputs.reducer,
      outletWidthInches: 36,
    },
  });

  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.baseline, null);
  assert.equal(rejected.candidate, null);
  assert.match(rejected.rejectionReason, /invalid-rectangular-reducer/);
});

test("an explicit run wraps the actual adapter receipt with run timestamps", () => {
  const startedAt = new Date("2026-08-08T12:00:00.000Z");
  const run = lab.runGeometryComparison("elbow", lab.initialGeometryInputs, startedAt);

  assert.equal(run.startedAt, startedAt.toISOString());
  assert.match(run.completedAt, /^2026-/);
  assert.equal(run.sourceContext, "isolated experiment route");
  assert.equal(run.receipt.status, "match");
  assert.equal(run.receipt.provenance.candidate.package, "@flatten-js/core");
  assert.equal(run.receipt.provenance.candidate.packageVersion, "1.6.12");
});

test("live redraw is separate from the explicit evidence receipt lifecycle", () => {
  assert.match(component, /previewGeometryComparison\(experimentId, inputs\)/);
  assert.match(component, /useState<CompletedGeometryRun \| null>\(null\)/);
  assert.match(component, /setRun\(null\)/);
  assert.match(component, /Every change invalidates the previous receipt/i);
  assert.match(component, /onClick=\{runComparison\}/);
  assert.match(component, /disabled=\{!run\}/);
  assert.match(documentation, /Every input change redraws both live previews immediately/i);
  assert.match(documentation, /live preview is not an evidence receipt/i);
});

test("baseline, candidate, and difference overlay draw from adapter snapshots", () => {
  assert.match(component, /snapshot=\{livePreview\.baseline\}/);
  assert.match(component, /snapshot=\{livePreview\.candidate\}/);
  assert.match(component, /comparisonSnapshot=\{run\.receipt\.candidate\}/);
  assert.match(canvas, /Live geometry redraw from the current inputs/);
  assert.match(canvas, /Geometry rendered directly from the completed comparison receipt/);
  assert.match(canvas, /Product baseline/);
  assert.match(canvas, /Flatten\.js candidate/);
});

test("the route remains opt-in, direct-only, and safe for an owner-only release", () => {
  assert.match(route, /NEXT_PUBLIC_EXPERIMENT_LAB_ENABLED !== "1"/);
  assert.match(route, /notFound\(\)/);
  assert.match(documentation, /does not appear in production navigation/i);
  assert.match(documentation, /default build therefore returns 404/i);
  assert.match(documentation, /owner-only private Sites release may enable the route/i);
});

test("lab modules have no production persistence or network mutation path", () => {
  const combined = `${component}\n${fixtures}\n${canvas}\n${adapter}`;
  assert.doesNotMatch(combined, /localStorage\.|indexedDB\.|fetch\s*\(|createClient\s*\(|\.upload\s*\(/i);
  assert.doesNotMatch(combined, /from "\.\.\/page"|from "\.\.\/.*Store"/i);
  assert.match(documentation, /no localStorage, IndexedDB, project-store, upload, fetch, cloud-client/i);
});

test("evidence wording rejects unsupported performance and engineering claims", () => {
  assert.match(component, /Only a completed <strong>match<\/strong> is positive differential evidence/i);
  assert.match(component, /No performance claim/i);
  for (const phrase of ["Manual D", "pressure or friction loss", "measured airflow", "fabrication approval"]) {
    assert.match(documentation, new RegExp(phrase, "i"));
  }
});
