import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  branchLeavesTrunkAtClearAngle,
  commitPort3Branch,
  port3UndoDisposition,
} = await loadTypescriptModule(
  new URL("../app/port3BranchDraft.ts", import.meta.url),
);

function fixture() {
  return {
    draft: {
      fittingId: "fit-1",
      branchSize: "8",
      page: 2,
      systemId: "system-1",
      anchor: { x: 30, y: 40 },
    },
    fitting: {
      id: "fit-1",
      points: [{ x: 20, y: 30 }],
      size: "14×12×8",
      page: 2,
      systemId: "system-1",
      fitting: {
        upstreamSize: "14",
        downstreamSize: "12",
        branchSize: "8",
        connectedIds: ["upstream", "downstream", ""],
      },
    },
    run: {
      id: "branch-1",
      type: "supply",
      points: [{ x: 30, y: 40 }, { x: 60, y: 72 }],
      size: "8",
      page: 2,
      systemId: "system-1",
    },
  };
}

test("Port 3 commit creates one branch and preserves Ports 1 and 2 atomically", () => {
  const { draft, fitting, run } = fixture();
  const original = structuredClone(fitting);
  const result = commitPort3Branch({
    drawings: [fitting],
    draft,
    run,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(fitting, original);
  assert.equal(result.drawings.length, 2);
  assert.deepEqual(
    result.drawings[0].fitting.connectedIds,
    ["upstream", "downstream", "branch-1"],
  );
  assert.equal(result.drawings[0].size, "14×12×8");
  assert.equal(result.drawings[1].size, "8");
  assert.deepEqual(result.drawings[1].points[0], draft.anchor);
});

test("Port 3 never saves a stub or a route detached from its fitting anchor", () => {
  const { draft, fitting, run } = fixture();
  assert.deepEqual(
    commitPort3Branch({
      drawings: [fitting],
      draft,
      run: { ...run, points: [draft.anchor] },
    }),
    { ok: false, reason: "no-route" },
  );
  assert.deepEqual(
    commitPort3Branch({
      drawings: [fitting],
      draft,
      run: { ...run, points: [{ x: 31, y: 40 }, run.points[1]] },
    }),
    { ok: false, reason: "detached-anchor" },
  );
});

test("Port 3 rejects stale sheet, system, missing, and occupied fitting state", () => {
  const { draft, fitting, run } = fixture();
  assert.equal(commitPort3Branch({
    drawings: [fitting],
    draft: { ...draft, page: 3 },
    run,
  }).reason, "wrong-context");
  assert.equal(commitPort3Branch({
    drawings: [fitting],
    draft: { ...draft, systemId: "system-2" },
    run,
  }).reason, "wrong-context");
  assert.equal(commitPort3Branch({
    drawings: [],
    draft,
    run,
  }).reason, "missing-fitting");
  assert.equal(commitPort3Branch({
    drawings: [{
      ...fitting,
      fitting: {
        ...fitting.fitting,
        connectedIds: ["upstream", "downstream", "existing"],
      },
    }],
    draft,
    run,
  }).reason, "occupied-port");
});

test("existing-run attachment rejects near-parallel branch geometry", () => {
  assert.equal(branchLeavesTrunkAtClearAngle(0, 0.05), false);
  assert.equal(branchLeavesTrunkAtClearAngle(0, Math.PI - 0.05), false);
  assert.equal(branchLeavesTrunkAtClearAngle(0, Math.PI / 4), true);
  assert.equal(branchLeavesTrunkAtClearAngle(0, Math.PI / 2), true);
});

test("one Undo rolls a newly direct-placed fitting back through history", () => {
  assert.equal(port3UndoDisposition({
    draftPointCount: 1,
    origin: "direct-placement",
  }), "history");
});

test("existing fitting drafts retain their established Undo behavior", () => {
  assert.equal(port3UndoDisposition({
    draftPointCount: 1,
    origin: "existing-fitting",
  }), "leave-port-open");
  assert.equal(port3UndoDisposition({
    draftPointCount: 1,
  }), "leave-port-open");
  assert.equal(port3UndoDisposition({
    draftPointCount: 2,
    origin: "direct-placement",
  }), "trim-route");
  assert.equal(port3UndoDisposition({
    draftPointCount: 0,
    origin: "direct-placement",
  }), "history");
});
