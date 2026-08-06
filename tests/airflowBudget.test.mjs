import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/airflowBudget.ts", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cjsModule = { exports: {} };
new Function("module", "exports", compiled)(cjsModule, cjsModule.exports);
const { allocateBranchAirflow } = cjsModule.exports;

test("splits available branch airflow evenly and conserves the parent total", () => {
  const allocation = allocateBranchAirflow([
    { id: "14", childIds: ["12-a", "12-b"], manualCfm: 700 },
    { id: "12-a", childIds: ["10-a", "10-b"] },
    { id: "12-b", childIds: [] },
    { id: "10-a", childIds: [] },
    { id: "10-b", childIds: [] },
  ], [{ runId: "14", availableCfm: 2000 }]);

  assert.equal(allocation.get("14"), 700);
  assert.equal(allocation.get("12-a"), 350);
  assert.equal(allocation.get("12-b"), 350);
  assert.equal(allocation.get("10-a"), 175);
  assert.equal(allocation.get("10-b"), 175);
});

test("keeps manual and scheduled child values and assigns only the remainder", () => {
  const allocation = allocateBranchAirflow([
    { id: "root", childIds: ["manual", "scheduled", "open"], manualCfm: 1000 },
    { id: "manual", childIds: [], manualCfm: 300 },
    { id: "scheduled", childIds: [], scheduledCfm: 250 },
    { id: "open", childIds: [] },
  ], [{ runId: "root", availableCfm: 2000 }]);

  assert.equal(allocation.get("manual"), 300);
  assert.equal(allocation.get("scheduled"), 250);
  assert.equal(allocation.get("open"), 450);
});

test("handles odd totals without losing a CFM", () => {
  const allocation = allocateBranchAirflow([
    { id: "root", childIds: ["a", "b"], manualCfm: 701 },
    { id: "a", childIds: [] },
    { id: "b", childIds: [] },
  ], [{ runId: "root", availableCfm: 701 }]);

  assert.equal((allocation.get("a") || 0) + (allocation.get("b") || 0), 701);
});

test("shows equipment design CFM and review-only downsizing guidance in the plan editor", () => {
  assert.match(pageSource, /`\$\{compactLabel\} · \$\{Math\.round\(drawing\.cfm \|\| 0\)\} CFM`/);
  assert.match(pageSource, /<span>Suggested size<\/span>/);
  assert.match(pageSource, /BALANCED BUDGET/);
});
