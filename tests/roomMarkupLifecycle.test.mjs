import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const {
  createRoomMarkupCandidate,
  deriveRoomMarkupChecklist,
  roomMarkupCandidateReviewFingerprint,
  roomMarkupQuestions,
  transitionRoomMarkupCandidate,
} = await loadTypescriptModule(
  new URL("../app/roomMarkupLifecycle.ts", import.meta.url),
);

const binding = {
  sourceFingerprint: "pdf-source-a",
  evidenceFingerprint: "room-evidence-a",
};

function seed(overrides = {}) {
  return {
    id: "candidate-bedroom-2-supply",
    roomId: "room-bedroom-2",
    kind: "supply",
    page: 1,
    label: "Bedroom 2 supply review",
    sourcePoint: { x: 0.42, y: 0.36 },
    room: { value: "Bedroom 2", certainty: "confirmed" },
    system: { value: "System 1", certainty: "confirmed" },
    systemId: "system-1",
    scale: { value: '1/4" = 1\'-0"', certainty: "confirmed" },
    scaleVerified: true,
    ...overrides,
  };
}

test("binds every candidate to source and evidence fingerprints", () => {
  const candidate = createRoomMarkupCandidate(seed(), binding);
  const before = JSON.stringify(candidate);
  const result = transitionRoomMarkupCandidate(
    candidate,
    { type: "move", reviewPoint: { x: 0.5, y: 0.4 } },
    { ...binding, evidenceFingerprint: "room-evidence-b" },
  );

  assert.equal(result.applied, false);
  assert.equal(result.candidate.status, "stale");
  assert.deepEqual(result.candidate.reviewPoint, candidate.reviewPoint);
  assert.equal(JSON.stringify(candidate), before, "stale detection must not mutate the candidate");
});

test("asks explicit questions and does not let typed scale or system text authorize placement", () => {
  const candidate = createRoomMarkupCandidate(seed({
    id: "candidate-bedroom-2-return",
    kind: "return",
    room: { certainty: "uncertain" },
    system: { certainty: "missing" },
    systemId: undefined,
    scale: { value: "Scale note found", certainty: "uncertain" },
    scaleVerified: false,
    returnStrategy: { certainty: "missing" },
  }), binding);

  assert.deepEqual(
    roomMarkupQuestions(candidate).map((question) => question.kind),
    ["room", "system", "scale", "return-strategy"],
  );
  const blocked = transitionRoomMarkupCandidate(candidate, { type: "confirm" }, binding);
  assert.equal(blocked.applied, false);
  assert.match(blocked.reason, /4 required questions/);

  const answered = transitionRoomMarkupCandidate(candidate, {
    type: "edit",
    systemId: "system-1",
    systemLabel: "System 1",
    answers: {
      "return-strategy": "Jump duct",
    },
  }, binding);
  assert.equal(answered.applied, true);
  assert.equal(answered.candidate.status, "edited");
  assert.deepEqual(
    roomMarkupQuestions(answered.candidate)
      .filter((question) => !question.resolved)
      .map((question) => question.kind),
    ["room", "scale"],
  );

  const confirmed = transitionRoomMarkupCandidate(
    answered.candidate,
    { type: "confirm" },
    binding,
  );
  assert.equal(confirmed.applied, false);
  assert.match(confirmed.reason, /2 required questions/);

  const readyReturn = createRoomMarkupCandidate(seed({
    id: "candidate-bedroom-2-return-ready",
    kind: "return",
    returnStrategy: { certainty: "missing" },
    answers: { "return-strategy": "Jump duct" },
  }), binding);
  const readyConfirmed = transitionRoomMarkupCandidate(
    readyReturn,
    { type: "confirm" },
    binding,
  );
  assert.equal(readyConfirmed.applied, true);
  assert.equal(readyConfirmed.candidate.status, "confirmed");
});

test("supports proposed, moved, edited, confirmed, and rejected review states without geometry mutation", () => {
  const proposed = createRoomMarkupCandidate(seed(), binding);
  assert.equal(proposed.status, "proposed");

  const moved = transitionRoomMarkupCandidate(
    proposed,
    { type: "move", reviewPoint: { x: 0.55, y: 0.41 } },
    binding,
  );
  assert.equal(moved.candidate.status, "moved");
  assert.deepEqual(moved.candidate.reviewPoint, { x: 0.55, y: 0.41 });
  assert.deepEqual(moved.candidate.sourcePoint, proposed.sourcePoint);
  assert.deepEqual(proposed.reviewPoint, proposed.sourcePoint);

  const edited = transitionRoomMarkupCandidate(
    moved.candidate,
    { type: "edit", label: "Bedroom 2 east supply", note: "Keep clear of fan." },
    binding,
  );
  assert.equal(edited.candidate.status, "edited");
  assert.deepEqual(edited.candidate.reviewPoint, moved.candidate.reviewPoint);

  const confirmed = transitionRoomMarkupCandidate(
    edited.candidate,
    { type: "confirm" },
    binding,
  );
  assert.equal(confirmed.candidate.status, "confirmed");

  const rejected = transitionRoomMarkupCandidate(
    confirmed.candidate,
    { type: "reject", reason: "Existing approved supply serves this room." },
    binding,
  );
  assert.equal(rejected.candidate.status, "rejected");
  assert.equal(
    rejected.candidate.rejectionReason,
    "Existing approved supply serves this room.",
  );
  assert.deepEqual(rejected.candidate.reviewPoint, confirmed.candidate.reviewPoint);
});

test("records an explicit room-name confirmation in the approved decision fingerprint", () => {
  const candidate = createRoomMarkupCandidate(seed({
    room: { value: "Bedroom?", certainty: "uncertain" },
  }), binding);
  const before = roomMarkupCandidateReviewFingerprint(candidate);
  const edited = transitionRoomMarkupCandidate(candidate, {
    type: "edit",
    roomName: "Bedroom 2",
  }, binding);
  assert.equal(edited.applied, true);
  assert.deepEqual(edited.candidate.room, {
    value: "Bedroom 2",
    certainty: "confirmed",
  });
  assert.notEqual(roomMarkupCandidateReviewFingerprint(edited.candidate), before);
  assert.equal(
    transitionRoomMarkupCandidate(edited.candidate, { type: "confirm" }, binding).applied,
    true,
  );
});

test("requires a rejection reason and blocks invalid marker coordinates", () => {
  const candidate = createRoomMarkupCandidate(seed(), binding);
  const rejected = transitionRoomMarkupCandidate(
    candidate,
    { type: "reject", reason: " " },
    binding,
  );
  assert.equal(rejected.applied, false);
  assert.equal(rejected.candidate.status, "proposed");

  const moved = transitionRoomMarkupCandidate(
    candidate,
    { type: "move", reviewPoint: { x: 1.1, y: 0.4 } },
    binding,
  );
  assert.equal(moved.applied, false);
  assert.deepEqual(moved.candidate.reviewPoint, candidate.reviewPoint);
});

test("derives a deterministic checklist, ordering, and complete status counts", () => {
  const proposed = createRoomMarkupCandidate(seed({
    id: "z-supply",
    page: 2,
    room: { value: "Office", certainty: "confirmed" },
  }), binding);
  const needsAnswer = createRoomMarkupCandidate(seed({
    id: "a-return",
    kind: "return",
    page: 1,
    room: { certainty: "uncertain" },
    returnStrategy: { certainty: "missing" },
  }), binding);
  const confirmed = transitionRoomMarkupCandidate(
    createRoomMarkupCandidate(seed({
      id: "b-supply",
      page: 1,
      room: { value: "Bedroom 1", certainty: "confirmed" },
    }), binding),
    { type: "confirm" },
    binding,
  ).candidate;
  const rejected = transitionRoomMarkupCandidate(
    createRoomMarkupCandidate(seed({
      id: "c-supply",
      page: 1,
      room: { value: "Kitchen", certainty: "confirmed" },
    }), binding),
    { type: "reject", reason: "Existing terminal retained." },
    binding,
  ).candidate;
  const input = [proposed, rejected, needsAnswer, confirmed];
  const before = JSON.stringify(input);
  const first = deriveRoomMarkupChecklist(input, binding);
  const second = deriveRoomMarkupChecklist(input, binding);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), before, "checklist derivation must not mutate candidates");
  assert.deepEqual(
    first.items.map((item) => item.candidate.id),
    ["a-return", "b-supply", "c-supply", "z-supply"],
  );
  assert.deepEqual(first.counts, {
    total: 4,
    proposed: 2,
    confirmed: 1,
    moved: 0,
    edited: 0,
    rejected: 1,
    stale: 0,
    openQuestions: 2,
    needsAnswers: 1,
    readyToConfirm: 1,
  });
  assert.ok(first.items.every((item) => item.stagedOnly));
});

test("rejects return strategies outside the reviewed list", () => {
  const candidate = createRoomMarkupCandidate(seed({
    id: "candidate-bedroom-2-return-invalid",
    kind: "return",
    returnStrategy: { certainty: "missing" },
  }), binding);
  const result = transitionRoomMarkupCandidate(candidate, {
    type: "edit",
    answers: { "return-strategy": "Whatever the assistant thinks" },
  }, binding);
  assert.equal(result.applied, false);
  assert.match(result.reason, /listed return-air strategies/);
});
