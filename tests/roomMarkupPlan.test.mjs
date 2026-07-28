import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const lifecycle = await loadTypescriptModule(
  new URL("../app/roomMarkupLifecycle.ts", import.meta.url),
);
const {
  buildRoomMarkupPlan,
  roomMarkupCandidateCreatesTerminal,
} = await loadTypescriptModule(
  new URL("../app/roomMarkupPlan.ts", import.meta.url),
);

function suggestion(kind, overrides = {}) {
  return {
    id: `suggestion-${kind}-bedroom-2`,
    kind,
    page: 1,
    roomId: "room-bedroom-2",
    roomName: "Bedroom 2",
    roomCeilingHeight: {
      label: "10'-0\"",
      minimumInches: 120,
      maximumInches: 120,
      unit: "imperial",
    },
    roomCeilingType: "flat",
    roomAssignmentConfirmed: true,
    systemAssignmentConfirmed: true,
    point: kind === "supply" ? { x: 0.44, y: 0.38 } : { x: 0.38, y: 0.44 },
    sourceRegion: {
      x: 300,
      y: 200,
      width: 80,
      height: 20,
      pageWidth: 800,
      pageHeight: 600,
      coordinateSpace: "viewport-points",
    },
    confidence: 0.9,
    label: `${kind} review zone - Bedroom 2`,
    explanation: "Review location.",
    evidence: ["A1.1: BEDROOM 2"],
    sourceEvidenceIds: ["room-source"],
    evidenceFingerprint: `evidence-${kind}-a`,
    geometry: "review-zone",
    readiness: "confirm-location",
    ...overrides,
  };
}

function layer(suggestions = [suggestion("supply"), suggestion("return")]) {
  return {
    version: "assistant-suggestion-layer-v131.0",
    page: 1,
    status: "review",
    headline: `${suggestions.length} review zones ready`,
    detail: "Review only.",
    confidence: 0.9,
    evidenceFingerprint: "layer-a",
    missingInformation: [],
    basis: ["Verified scale"],
    suggestions,
  };
}

function input(overrides = {}) {
  return {
    layer: layer(),
    sourceFingerprint: "pdf-a",
    systemId: "system-1",
    systemLabel: "System 1",
    scaleVerified: true,
    scaleLabel: '1/4" = 1\'-0"',
    savedCandidates: [],
    applicationRecords: [],
    existingTerminals: [],
    ...overrides,
  };
}

function existingTerminal(candidate, id, overrides = {}) {
  return {
    id,
    page: candidate.page,
    systemId: "system-1",
    kind: candidate.kind,
    roomName: candidate.room.value,
    candidateId: candidate.id,
    sourceFingerprint: "pdf-a",
    evidenceFingerprint: candidate.binding.evidenceFingerprint,
    ...overrides,
  };
}

function transition(candidate, transition) {
  return lifecycle.transitionRoomMarkupCandidate(
    candidate,
    transition,
    candidate.binding,
  ).candidate;
}

test("groups deterministic supply and return ghosts into one room checklist", () => {
  const plan = buildRoomMarkupPlan(input());
  assert.equal(plan.rooms.length, 1);
  assert.equal(plan.rooms[0].roomName, "Bedroom 2");
  assert.equal(plan.rooms[0].items.length, 2);
  assert.equal(plan.rooms[0].status, "on-hold");
  assert.equal(plan.counts.candidates, 2);
  assert.equal(plan.overlayCandidates.length, 2);
});

test("requires a person to confirm a low-confidence room name", () => {
  const lowConfidenceLayer = layer([
    suggestion("supply", { roomAssignmentConfirmed: false }),
  ]);
  const seeded = buildRoomMarkupPlan(input({ layer: lowConfidenceLayer }));
  const candidate = seeded.rooms[0].items[0].candidate;
  assert.equal(seeded.rooms[0].status, "on-hold");
  assert.deepEqual(
    seeded.rooms[0].items[0].questions.map((question) => question.kind),
    ["room"],
  );

  const named = transition(candidate, {
    type: "edit",
    roomName: "Bedroom 2",
  });
  const confirmed = transition(named, { type: "confirm" });
  const reviewed = buildRoomMarkupPlan(input({
    layer: lowConfidenceLayer,
    savedCandidates: [confirmed],
  }));
  assert.equal(reviewed.rooms[0].status, "ready-to-add");
  assert.equal(reviewed.rooms[0].items[0].candidate.room.certainty, "confirmed");
});

test("requires reviewed return strategy and creates only dedicated return geometry", () => {
  const seeded = buildRoomMarkupPlan(input());
  const supply = transition(
    seeded.rooms[0].items.find((item) => item.candidate.kind === "supply").candidate,
    { type: "confirm" },
  );
  const returnCandidate = seeded.rooms[0].items.find((item) => item.candidate.kind === "return").candidate;
  const alternate = transition(
    transition(returnCandidate, {
      type: "edit",
      answers: { "return-strategy": "Jump duct" },
    }),
    { type: "confirm" },
  );
  const plan = buildRoomMarkupPlan(input({ savedCandidates: [supply, alternate] }));
  assert.equal(plan.rooms[0].status, "ready-to-add");
  assert.equal(plan.rooms[0].supplyToAdd, 1);
  assert.equal(plan.rooms[0].returnToAdd, 0);
  assert.equal(plan.rooms[0].reviewedWithoutMarkup, 1);
  assert.equal(roomMarkupCandidateCreatesTerminal(alternate), false);
  assert.deepEqual(plan.overlayCandidates.map((candidate) => candidate.kind), ["supply"]);
});

test("uses stable system IDs rather than a typed system label", () => {
  const ambiguousLayer = layer([
    suggestion("supply", { systemAssignmentConfirmed: false }),
  ]);
  const seeded = buildRoomMarkupPlan(input({ layer: ambiguousLayer }));
  const candidate = seeded.rooms[0].items[0].candidate;
  assert.equal(candidate.systemId, undefined);
  assert.equal(seeded.rooms[0].status, "on-hold");

  const typedOnly = transition(candidate, {
    type: "edit",
    answers: { system: "System 1" },
  });
  const typedPlan = buildRoomMarkupPlan(input({
    layer: ambiguousLayer,
    savedCandidates: [typedOnly],
  }));
  assert.equal(typedPlan.rooms[0].status, "on-hold");

  const assigned = transition(candidate, {
    type: "edit",
    systemId: "system-1",
    systemLabel: "System 1",
  });
  const confirmed = transition(assigned, { type: "confirm" });
  const assignedPlan = buildRoomMarkupPlan(input({
    layer: ambiguousLayer,
    savedCandidates: [confirmed],
  }));
  assert.equal(assignedPlan.rooms[0].status, "ready-to-add");
});

test("marks saved decisions stale when candidate evidence changes", () => {
  const seeded = buildRoomMarkupPlan(input());
  const saved = seeded.rooms[0].items.find(
    (item) => item.candidate.kind === "supply",
  ).candidate;
  const changedLayer = layer([
    suggestion("supply", { evidenceFingerprint: "evidence-supply-b" }),
  ]);
  const changed = buildRoomMarkupPlan(input({
    layer: changedLayer,
    savedCandidates: [saved],
  }));
  assert.equal(changed.rooms[0].status, "stale");
  assert.equal(changed.rooms[0].items[0].candidate.status, "stale");
  assert.equal(changed.overlayCandidates.length, 0);
});

test("reconciles applied drawings so Undo or deletion reopens the reviewed room", () => {
  const seeded = buildRoomMarkupPlan(input({
    layer: layer([suggestion("supply")]),
  }));
  const confirmed = transition(seeded.rooms[0].items[0].candidate, { type: "confirm" });
  const record = {
    version: "room-markup-application-v131.0",
    id: "room-application-1",
    roomId: "room-bedroom-2",
    roomName: "Bedroom 2",
    page: 1,
    systemId: "system-1",
    candidateIds: [confirmed.id],
    candidateFingerprints: {
      [confirmed.id]: lifecycle.roomMarkupCandidateReviewFingerprint(confirmed),
    },
    createdDrawingIdsByCandidate: {
      [confirmed.id]: "drawing-1",
    },
    createdDrawingIds: ["drawing-1"],
    sourceFingerprint: "pdf-a",
    evidenceFingerprints: [confirmed.binding.evidenceFingerprint],
    beforeDrawingFingerprint: "before",
    afterDrawingFingerprint: "after",
    reviewer: "FL",
    createdAt: "2026-07-28T22:00:00.000Z",
  };
  const added = buildRoomMarkupPlan(input({
    layer: layer([suggestion("supply")]),
    savedCandidates: [confirmed],
    applicationRecords: [record],
    existingTerminals: [existingTerminal(confirmed, "drawing-1")],
  }));
  assert.equal(added.rooms[0].status, "added");
  assert.equal(added.overlayCandidates.length, 0);

  const evidenceRemoved = buildRoomMarkupPlan(input({
    layer: layer([]),
    savedCandidates: [confirmed],
    applicationRecords: [record],
    existingTerminals: [existingTerminal(confirmed, "drawing-1")],
  }));
  assert.equal(evidenceRemoved.rooms[0].status, "stale");
  assert.equal(evidenceRemoved.rooms[0].items[0].candidate.status, "stale");
  assert.equal(evidenceRemoved.overlayCandidates.length, 0);

  const reopened = buildRoomMarkupPlan(input({
    layer: layer([suggestion("supply")]),
    savedCandidates: [confirmed],
    applicationRecords: [record],
    existingTerminals: [],
  }));
  assert.equal(reopened.rooms[0].status, "ready-to-add");
  assert.equal(reopened.overlayCandidates.length, 1);

  const sourceChanged = buildRoomMarkupPlan(input({
    layer: layer([suggestion("supply")]),
    savedCandidates: [confirmed],
    applicationRecords: [{
      ...record,
      sourceFingerprint: "pdf-old",
    }],
    existingTerminals: [existingTerminal(confirmed, "drawing-1")],
  }));
  assert.equal(sourceChanged.rooms[0].status, "ready-to-add");
  assert.equal(sourceChanged.overlayCandidates.length, 1);
});

test("reopens only a missing terminal and preserves the surviving room markup", () => {
  const seeded = buildRoomMarkupPlan(input());
  const supply = transition(
    seeded.rooms[0].items.find((item) => item.candidate.kind === "supply").candidate,
    { type: "confirm" },
  );
  const returnCandidate = seeded.rooms[0].items.find(
    (item) => item.candidate.kind === "return",
  ).candidate;
  const dedicatedReturn = transition(
    transition(returnCandidate, {
      type: "edit",
      answers: { "return-strategy": "Dedicated return" },
    }),
    { type: "confirm" },
  );
  const firstRecord = {
    version: "room-markup-application-v131.0",
    id: "room-application-partial-1",
    roomId: "room-bedroom-2",
    roomName: "Bedroom 2",
    page: 1,
    systemId: "system-1",
    candidateIds: [supply.id, dedicatedReturn.id],
    candidateFingerprints: {
      [supply.id]: lifecycle.roomMarkupCandidateReviewFingerprint(supply),
      [dedicatedReturn.id]: lifecycle.roomMarkupCandidateReviewFingerprint(dedicatedReturn),
    },
    createdDrawingIdsByCandidate: {
      [supply.id]: "drawing-supply",
      [dedicatedReturn.id]: "drawing-return",
    },
    createdDrawingIds: ["drawing-supply", "drawing-return"],
    sourceFingerprint: "pdf-a",
    evidenceFingerprints: [
      supply.binding.evidenceFingerprint,
      dedicatedReturn.binding.evidenceFingerprint,
    ].sort(),
    beforeDrawingFingerprint: "before",
    afterDrawingFingerprint: "after-first",
    reviewer: "FL",
    createdAt: "2026-07-28T22:00:00.000Z",
  };

  const partial = buildRoomMarkupPlan(input({
    savedCandidates: [supply, dedicatedReturn],
    applicationRecords: [firstRecord],
    existingTerminals: [existingTerminal(supply, "drawing-supply")],
  }));
  assert.equal(partial.rooms[0].status, "ready-to-add");
  assert.deepEqual(partial.rooms[0].appliedCandidateIds, [supply.id]);
  assert.equal(partial.rooms[0].supplyToAdd, 0);
  assert.equal(partial.rooms[0].returnToAdd, 1);
  assert.deepEqual(
    partial.overlayCandidates.map((candidate) => candidate.id),
    [dedicatedReturn.id],
  );

  const repairedRecord = {
    ...firstRecord,
    id: "room-application-partial-2",
    createdDrawingIdsByCandidate: {
      [supply.id]: "drawing-supply",
      [dedicatedReturn.id]: "drawing-return-repaired",
    },
    createdDrawingIds: ["drawing-return-repaired"],
    afterDrawingFingerprint: "after-repair",
    createdAt: "2026-07-28T22:01:00.000Z",
  };
  const repaired = buildRoomMarkupPlan(input({
    savedCandidates: [supply, dedicatedReturn],
    applicationRecords: [firstRecord, repairedRecord],
    existingTerminals: [
      existingTerminal(supply, "drawing-supply"),
      existingTerminal(dedicatedReturn, "drawing-return-repaired"),
    ],
  }));
  assert.equal(repaired.rooms[0].status, "added");
  assert.deepEqual(
    repaired.rooms[0].appliedCandidateIds,
    [dedicatedReturn.id, supply.id].sort(),
  );
  assert.equal(repaired.overlayCandidates.length, 0);

  const undoneRepair = buildRoomMarkupPlan(input({
    savedCandidates: [supply, dedicatedReturn],
    applicationRecords: [
      firstRecord,
      {
        ...repairedRecord,
        reversedAt: "2026-07-28T22:02:00.000Z",
      },
    ],
    existingTerminals: [existingTerminal(supply, "drawing-supply")],
  }));
  assert.equal(undoneRepair.rooms[0].latestApplication.id, firstRecord.id);
  assert.equal(undoneRepair.rooms[0].status, "ready-to-add");
  assert.deepEqual(undoneRepair.rooms[0].appliedCandidateIds, [supply.id]);
  assert.deepEqual(
    undoneRepair.overlayCandidates.map((candidate) => candidate.id),
    [dedicatedReturn.id],
  );
});

test("requires a new receipt after a missing return changes to a no-symbol strategy", () => {
  const seeded = buildRoomMarkupPlan(input());
  const supply = transition(
    seeded.rooms[0].items.find((item) => item.candidate.kind === "supply").candidate,
    { type: "confirm" },
  );
  const dedicatedReturn = transition(
    transition(
      seeded.rooms[0].items.find((item) => item.candidate.kind === "return").candidate,
      { type: "edit", answers: { "return-strategy": "Dedicated return" } },
    ),
    { type: "confirm" },
  );
  const oldRecord = {
    version: "room-markup-application-v131.0",
    id: "room-application-old-decision",
    roomId: "room-bedroom-2",
    roomName: "Bedroom 2",
    page: 1,
    systemId: "system-1",
    candidateIds: [supply.id, dedicatedReturn.id],
    candidateFingerprints: {
      [supply.id]: lifecycle.roomMarkupCandidateReviewFingerprint(supply),
      [dedicatedReturn.id]: lifecycle.roomMarkupCandidateReviewFingerprint(dedicatedReturn),
    },
    createdDrawingIdsByCandidate: {
      [supply.id]: "drawing-supply",
      [dedicatedReturn.id]: "drawing-return",
    },
    createdDrawingIds: ["drawing-supply", "drawing-return"],
    sourceFingerprint: "pdf-a",
    evidenceFingerprints: [
      supply.binding.evidenceFingerprint,
      dedicatedReturn.binding.evidenceFingerprint,
    ].sort(),
    beforeDrawingFingerprint: "before",
    afterDrawingFingerprint: "after",
    reviewer: "FL",
    createdAt: "2026-07-28T22:00:00.000Z",
  };
  const jumpDuct = transition(
    transition(dedicatedReturn, {
      type: "edit",
      answers: { "return-strategy": "Jump duct" },
    }),
    { type: "confirm" },
  );
  const changed = buildRoomMarkupPlan(input({
    savedCandidates: [supply, jumpDuct],
    applicationRecords: [oldRecord],
    existingTerminals: [existingTerminal(supply, "drawing-supply")],
  }));
  assert.equal(changed.rooms[0].status, "ready-to-add");
  assert.equal(changed.rooms[0].latestApplication, undefined);
  assert.deepEqual(changed.rooms[0].appliedCandidateIds, [supply.id]);
  assert.equal(changed.rooms[0].reviewedWithoutMarkup, 1);

  const newRecord = {
    ...oldRecord,
    id: "room-application-new-decision",
    candidateFingerprints: {
      [supply.id]: lifecycle.roomMarkupCandidateReviewFingerprint(supply),
      [jumpDuct.id]: lifecycle.roomMarkupCandidateReviewFingerprint(jumpDuct),
    },
    createdDrawingIdsByCandidate: {
      [supply.id]: "drawing-supply",
    },
    createdDrawingIds: [],
    createdAt: "2026-07-28T22:01:00.000Z",
  };
  const approved = buildRoomMarkupPlan(input({
    savedCandidates: [supply, jumpDuct],
    applicationRecords: [oldRecord, newRecord],
    existingTerminals: [existingTerminal(supply, "drawing-supply")],
  }));
  assert.equal(approved.rooms[0].status, "added");
  assert.equal(approved.rooms[0].latestApplication.id, newRecord.id);
});

test("does not accept a room terminal moved to another system", () => {
  const seeded = buildRoomMarkupPlan(input({
    layer: layer([suggestion("supply")]),
  }));
  const confirmed = transition(seeded.rooms[0].items[0].candidate, { type: "confirm" });
  const record = {
    version: "room-markup-application-v131.0",
    id: "room-application-wrong-system",
    roomId: "room-bedroom-2",
    roomName: "Bedroom 2",
    page: 1,
    systemId: "system-1",
    candidateIds: [confirmed.id],
    candidateFingerprints: {
      [confirmed.id]: lifecycle.roomMarkupCandidateReviewFingerprint(confirmed),
    },
    createdDrawingIdsByCandidate: {
      [confirmed.id]: "drawing-1",
    },
    createdDrawingIds: ["drawing-1"],
    sourceFingerprint: "pdf-a",
    evidenceFingerprints: [confirmed.binding.evidenceFingerprint],
    beforeDrawingFingerprint: "before",
    afterDrawingFingerprint: "after",
    reviewer: "FL",
    createdAt: "2026-07-28T22:00:00.000Z",
  };
  const movedSystem = buildRoomMarkupPlan(input({
    layer: layer([suggestion("supply")]),
    savedCandidates: [confirmed],
    applicationRecords: [record],
    existingTerminals: [
      existingTerminal(confirmed, "drawing-1", { systemId: "system-2" }),
    ],
  }));
  assert.equal(movedSystem.rooms[0].status, "ready-to-add");
  assert.deepEqual(movedSystem.rooms[0].appliedCandidateIds, []);
  assert.equal(movedSystem.overlayCandidates.length, 1);
});

test("does not accept a room terminal with mismatched evidence provenance", () => {
  const seeded = buildRoomMarkupPlan(input({
    layer: layer([suggestion("supply")]),
  }));
  const confirmed = transition(seeded.rooms[0].items[0].candidate, { type: "confirm" });
  const record = {
    version: "room-markup-application-v131.0",
    id: "room-application-wrong-evidence",
    roomId: "room-bedroom-2",
    roomName: "Bedroom 2",
    page: 1,
    systemId: "system-1",
    candidateIds: [confirmed.id],
    candidateFingerprints: {
      [confirmed.id]: lifecycle.roomMarkupCandidateReviewFingerprint(confirmed),
    },
    createdDrawingIdsByCandidate: {
      [confirmed.id]: "drawing-1",
    },
    createdDrawingIds: ["drawing-1"],
    sourceFingerprint: "pdf-a",
    evidenceFingerprints: [confirmed.binding.evidenceFingerprint],
    beforeDrawingFingerprint: "before",
    afterDrawingFingerprint: "after",
    reviewer: "FL",
    createdAt: "2026-07-28T22:00:00.000Z",
  };
  const mismatched = buildRoomMarkupPlan(input({
    layer: layer([suggestion("supply")]),
    savedCandidates: [confirmed],
    applicationRecords: [record],
    existingTerminals: [
      existingTerminal(confirmed, "drawing-1", {
        evidenceFingerprint: "evidence-from-another-review",
      }),
    ],
  }));
  assert.equal(mismatched.rooms[0].status, "ready-to-add");
  assert.deepEqual(mismatched.rooms[0].appliedCandidateIds, []);
  assert.equal(mismatched.overlayCandidates.length, 1);
});

test("marks an applied room stale when its exact verified scale changes", () => {
  const seeded = buildRoomMarkupPlan(input({
    layer: layer([suggestion("supply")]),
  }));
  const confirmed = transition(seeded.rooms[0].items[0].candidate, { type: "confirm" });
  const record = {
    version: "room-markup-application-v131.0",
    id: "room-application-scale-a",
    roomId: "room-bedroom-2",
    roomName: "Bedroom 2",
    page: 1,
    systemId: "system-1",
    candidateIds: [confirmed.id],
    candidateFingerprints: {
      [confirmed.id]: lifecycle.roomMarkupCandidateReviewFingerprint(confirmed),
    },
    createdDrawingIdsByCandidate: {
      [confirmed.id]: "drawing-1",
    },
    createdDrawingIds: ["drawing-1"],
    sourceFingerprint: "pdf-a",
    evidenceFingerprints: [confirmed.binding.evidenceFingerprint],
    beforeDrawingFingerprint: "before",
    afterDrawingFingerprint: "after",
    reviewer: "FL",
    createdAt: "2026-07-28T22:00:00.000Z",
  };
  const changedLayer = layer([
    suggestion("supply", { evidenceFingerprint: "evidence-supply-scale-b" }),
  ]);
  const stale = buildRoomMarkupPlan(input({
    layer: changedLayer,
    savedCandidates: [confirmed],
    applicationRecords: [record],
    existingTerminals: [existingTerminal(confirmed, "drawing-1")],
  }));
  assert.equal(stale.rooms[0].status, "stale");
  assert.deepEqual(stale.rooms[0].appliedCandidateIds, [confirmed.id]);
  assert.equal(stale.overlayCandidates.length, 0);
});

test("reopens a reviewed no-markup room when its receipt is reversed", () => {
  const seeded = buildRoomMarkupPlan(input({
    layer: layer([suggestion("return")]),
  }));
  const candidate = seeded.rooms[0].items[0].candidate;
  const confirmed = transition(
    transition(candidate, {
      type: "edit",
      answers: { "return-strategy": "Transfer grille" },
    }),
    { type: "confirm" },
  );
  const record = {
    version: "room-markup-application-v131.0",
    id: "room-application-no-markup",
    roomId: "room-bedroom-2",
    roomName: "Bedroom 2",
    page: 1,
    systemId: "system-1",
    candidateIds: [confirmed.id],
    candidateFingerprints: {
      [confirmed.id]: lifecycle.roomMarkupCandidateReviewFingerprint(confirmed),
    },
    createdDrawingIdsByCandidate: {},
    createdDrawingIds: [],
    sourceFingerprint: "pdf-a",
    evidenceFingerprints: [confirmed.binding.evidenceFingerprint],
    beforeDrawingFingerprint: "same",
    afterDrawingFingerprint: "same",
    reviewer: "FL",
    createdAt: "2026-07-28T22:00:00.000Z",
  };
  const reviewed = buildRoomMarkupPlan(input({
    layer: layer([suggestion("return")]),
    savedCandidates: [confirmed],
    applicationRecords: [record],
  }));
  assert.equal(reviewed.rooms[0].status, "reviewed-no-markup");

  const reopened = buildRoomMarkupPlan(input({
    layer: layer([suggestion("return")]),
    savedCandidates: [confirmed],
    applicationRecords: [{
      ...record,
      reversedAt: "2026-07-28T22:01:00.000Z",
    }],
  }));
  assert.equal(reopened.rooms[0].status, "ready-to-add");
});
