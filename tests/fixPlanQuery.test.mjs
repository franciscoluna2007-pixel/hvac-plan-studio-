import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const { rankFixPlanActions } = await loadTypescriptModule(
  new URL("../app/fixPlanQuery.ts", import.meta.url),
);

const actions = [
  {
    id: "bedroom-return",
    title: "Bedroom return path missing",
    location: "Bedroom 2 · sheet 1",
    problem: "The supplied bedroom has no reviewed return-air path.",
    proposedFix: "Confirm a transfer path or draw a reviewed return route.",
    expectedResult: "The room has a documented return-air strategy.",
    evidence: ["Bedroom 2 supply terminal", "Door-closed review"],
    objectIds: ["return-grille-2"],
  },
  {
    id: "disconnected-return",
    title: "Return grille disconnected",
    location: "Bedroom 2 · sheet 1",
    problem: "The return terminal is not connected to its saved run.",
    proposedFix: "Snap the reviewed run endpoint to the return can.",
    expectedResult: "The existing return path becomes continuous.",
    evidence: ["Same sheet and system"],
    objectIds: ["run-return-12", "return-grille-2"],
  },
  {
    id: "kitchen-supply",
    title: "Supply run size",
    location: "Kitchen · sheet 1",
    problem: "The current supply run exceeds the selected velocity limit.",
    proposedFix: "Resize only the reviewed run and fitting size labels.",
    expectedResult: "The velocity screen falls below the project limit.",
    evidence: ["Kitchen terminal", "Reviewed room airflow"],
    objectIds: ["run-supply-4"],
  },
];

test("an empty query preserves stable input order without mutating actions", () => {
  const before = JSON.stringify(actions);
  const ranked = rankFixPlanActions(actions, "   ");

  assert.deepEqual(ranked.map((row) => row.action.id), actions.map((action) => action.id));
  assert.ok(ranked.every((row) => row.score === 0));
  assert.ok(ranked.every((row) => row.matchedFields.length === 0));
  assert.equal(JSON.stringify(actions), before);
});

test("a contiguous phrase outranks the same tokens spread across fields", () => {
  const ranked = rankFixPlanActions(actions, "bedroom return");

  assert.deepEqual(
    ranked.map((row) => row.action.id),
    ["bedroom-return", "disconnected-return"],
  );
  assert.ok(ranked[0].score > ranked[1].score);
  assert.ok(ranked[0].matchedFields.includes("title"));
});

test("field weights rank a location match above evidence-only matches", () => {
  const ranked = rankFixPlanActions(actions, "kitchen");

  assert.equal(ranked[0].action.id, "kitchen-supply");
  assert.deepEqual(ranked[0].matchedFields, ["location", "evidence"]);
});

test("object IDs are searchable with punctuation and case normalization", () => {
  const ranked = rankFixPlanActions(actions, "RUN RETURN 12");

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].action.id, "disconnected-return");
  assert.ok(ranked[0].matchedFields.includes("objectIds"));
});

test("natural field wording ignores generic intent words", () => {
  const ranked = rankFixPlanActions(actions, "return problem in Bedroom 2");

  assert.equal(ranked[0].action.id, "bedroom-return");
  assert.ok(ranked[0].matchedFields.includes("title"));
  assert.ok(ranked[0].matchedFields.includes("location"));
});

test("ties retain source order and unmatched queries return no rows", () => {
  const tied = actions.slice(0, 2).map((action, index) => ({
    ...action,
    id: `tie-${index}`,
    title: "Open connection",
    location: "System 1",
    problem: "Needs review",
    proposedFix: "Inspect",
    expectedResult: "Reviewed",
    evidence: [],
    objectIds: [],
  }));

  assert.deepEqual(
    rankFixPlanActions(tied, "open connection").map((row) => row.action.id),
    ["tie-0", "tie-1"],
  );
  assert.deepEqual(rankFixPlanActions(actions, "attic smoke detector"), []);
});
