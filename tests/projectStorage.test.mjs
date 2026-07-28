import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  projectStorageKey,
  resolveProjectRestore,
} = await loadTypescriptModule(
  new URL("../app/projectStorage.ts", import.meta.url),
);

test("uses the PDF fingerprint to keep same-named plan files separate", () => {
  assert.equal(
    projectStorageKey("House Plan", "source-a"),
    "hvac-plan-studio:house plan:source-a",
  );
  assert.notEqual(
    projectStorageKey("House Plan", "source-a"),
    projectStorageKey("House Plan", "source-b"),
  );
});

test("restores only a snapshot that matches the opened PDF contents", () => {
  const matching = JSON.stringify({ pdfFingerprint: "source-a", drawings: [{ id: "run-1" }] });
  const result = resolveProjectRestore(matching, null, "source-a");

  assert.equal(result.status, "restored");
  assert.deepEqual(result.project.drawings, [{ id: "run-1" }]);
});

test("opens a same-named but different PDF as a new job", () => {
  const prior = JSON.stringify({ pdfFingerprint: "source-a", drawings: [{ id: "old-run" }] });
  const result = resolveProjectRestore(null, prior, "source-b");

  assert.deepEqual(result, { status: "source-mismatch", project: null });
});

test("treats corrupt local snapshots as new jobs", () => {
  assert.deepEqual(
    resolveProjectRestore(null, "{bad-json", "source-a"),
    { status: "new", project: null },
  );
});
