export const ROOM_MARKUP_LIFECYCLE_VERSION = "room-markup-lifecycle-v131.0";
export const ROOM_MARKUP_APPLICATION_VERSION = "room-markup-application-v131.0";

export type RoomMarkupCandidateStatus =
  | "proposed"
  | "confirmed"
  | "moved"
  | "edited"
  | "rejected"
  | "stale";

export type RoomMarkupCandidateKind = "supply" | "return";
export type RoomMarkupCertainty = "confirmed" | "uncertain" | "missing";
export type RoomMarkupQuestionKind =
  | "room"
  | "system"
  | "scale"
  | "return-strategy";

export const ROOM_MARKUP_RETURN_STRATEGIES = [
  "Dedicated return",
  "Transfer grille",
  "Jump duct",
  "Approved door undercut",
  "Other reviewed strategy",
  "Needs field review",
] as const;

export type RoomMarkupReturnStrategy = typeof ROOM_MARKUP_RETURN_STRATEGIES[number];

export type RoomMarkupReviewPoint = {
  x: number;
  y: number;
};

export type RoomMarkupEvidenceBinding = {
  sourceFingerprint: string;
  evidenceFingerprint: string;
};

export type RoomMarkupFact = {
  value?: string;
  certainty: RoomMarkupCertainty;
};

export type RoomMarkupAnswers = Partial<
  Record<RoomMarkupQuestionKind, string>
>;

export type RoomMarkupTerminalSelection = {
  optionId: string;
  label: string;
  size: string;
  variant: string;
  elevation?: string;
};

export type RoomMarkupCandidate = {
  id: string;
  roomId: string;
  kind: RoomMarkupCandidateKind;
  page: number;
  label: string;
  sourcePoint: RoomMarkupReviewPoint;
  reviewPoint: RoomMarkupReviewPoint;
  room: RoomMarkupFact;
  system: RoomMarkupFact;
  systemId?: string;
  scale: RoomMarkupFact;
  scaleVerified: boolean;
  returnStrategy?: RoomMarkupFact;
  terminalSelection?: RoomMarkupTerminalSelection;
  binding: RoomMarkupEvidenceBinding;
  status: RoomMarkupCandidateStatus;
  answers: RoomMarkupAnswers;
  note?: string;
  rejectionReason?: string;
};

export type RoomMarkupCandidateSeed = Omit<
  RoomMarkupCandidate,
  "reviewPoint" | "binding" | "status" | "answers" | "rejectionReason"
> & {
  answers?: RoomMarkupAnswers;
};

export type RoomMarkupQuestion = {
  id: string;
  candidateId: string;
  kind: RoomMarkupQuestionKind;
  prompt: string;
  answerType: "text" | "choice";
  options: string[];
  answer?: string;
  resolved: boolean;
};

export type RoomMarkupChecklistItem = {
  candidate: RoomMarkupCandidate;
  questions: RoomMarkupQuestion[];
  openQuestionCount: number;
  readyToConfirm: boolean;
  stagedOnly: true;
};

export type RoomMarkupChecklistCounts = {
  total: number;
  proposed: number;
  confirmed: number;
  moved: number;
  edited: number;
  rejected: number;
  stale: number;
  openQuestions: number;
  needsAnswers: number;
  readyToConfirm: number;
};

export type RoomMarkupChecklist = {
  items: RoomMarkupChecklistItem[];
  counts: RoomMarkupChecklistCounts;
};

export type RoomMarkupCurrentBindings =
  | RoomMarkupEvidenceBinding
  | Record<string, RoomMarkupEvidenceBinding>;

export type RoomMarkupTransition =
  | { type: "confirm" }
  | { type: "move"; reviewPoint: RoomMarkupReviewPoint }
  | {
    type: "edit";
    label?: string;
    roomName?: string;
    note?: string;
    answers?: RoomMarkupAnswers;
    systemId?: string;
    systemLabel?: string;
    terminalSelection?: RoomMarkupTerminalSelection;
  }
  | { type: "reject"; reason: string };

export type RoomMarkupTransitionResult = {
  candidate: RoomMarkupCandidate;
  applied: boolean;
  reason: string;
};

export type RoomMarkupApplicationRecord = {
  version: typeof ROOM_MARKUP_APPLICATION_VERSION;
  id: string;
  roomId: string;
  roomName: string;
  page: number;
  systemId: string;
  candidateIds: string[];
  candidateFingerprints: Record<string, string>;
  createdDrawingIdsByCandidate: Record<string, string>;
  createdDrawingIds: string[];
  sourceFingerprint: string;
  evidenceFingerprints: string[];
  beforeDrawingFingerprint: string;
  afterDrawingFingerprint: string;
  reviewer: string;
  note?: string;
  createdAt: string;
  reversedAt?: string;
};

const QUESTION_ORDER: RoomMarkupQuestionKind[] = [
  "room",
  "system",
  "scale",
  "return-strategy",
];

const STATUS_ORDER: RoomMarkupCandidateStatus[] = [
  "proposed",
  "confirmed",
  "moved",
  "edited",
  "rejected",
  "stale",
];

function clonePoint(point: RoomMarkupReviewPoint): RoomMarkupReviewPoint {
  return { x: point.x, y: point.y };
}

function cleanAnswer(value?: string) {
  const answer = value?.trim();
  return answer || undefined;
}

function cleanTerminalSelection(
  selection?: RoomMarkupTerminalSelection,
): RoomMarkupTerminalSelection | undefined {
  if (!selection) return undefined;
  const optionId = selection.optionId.trim();
  const label = selection.label.trim();
  const size = selection.size.trim();
  const variant = selection.variant.trim();
  if (!optionId || !label || !size || !variant) return undefined;
  return {
    optionId,
    label,
    size,
    variant,
    elevation: cleanAnswer(selection.elevation),
  };
}

function returnStrategy(value?: string): RoomMarkupReturnStrategy | undefined {
  const answer = cleanAnswer(value);
  return ROOM_MARKUP_RETURN_STRATEGIES.find((option) => option === answer);
}

function normalizedAnswers(answers: RoomMarkupAnswers = {}) {
  return QUESTION_ORDER.reduce<RoomMarkupAnswers>((result, kind) => {
    const answer = cleanAnswer(answers[kind]);
    if (answer) result[kind] = answer;
    return result;
  }, {});
}

function factNeedsQuestion(fact: RoomMarkupFact | undefined) {
  return !fact || fact.certainty !== "confirmed" || !cleanAnswer(fact.value);
}

function isReviewPoint(point: RoomMarkupReviewPoint) {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function roomMarkupEvidenceIsCurrent(
  candidate: RoomMarkupCandidate,
  currentBinding: RoomMarkupEvidenceBinding,
) {
  return (
    candidate.binding.sourceFingerprint === currentBinding.sourceFingerprint &&
    candidate.binding.evidenceFingerprint === currentBinding.evidenceFingerprint
  );
}

export function roomMarkupCandidateReviewFingerprint(
  candidate: RoomMarkupCandidate,
) {
  return JSON.stringify({
    id: candidate.id,
    roomId: candidate.roomId,
    kind: candidate.kind,
    page: candidate.page,
    label: candidate.label,
    sourcePoint: candidate.sourcePoint,
    reviewPoint: candidate.reviewPoint,
    room: candidate.room,
    system: candidate.system,
    systemId: candidate.systemId,
    scale: candidate.scale,
    scaleVerified: candidate.scaleVerified,
    returnStrategy: candidate.returnStrategy,
    terminalSelection: candidate.terminalSelection,
    binding: candidate.binding,
    status: candidate.status,
    answers: candidate.answers,
    note: candidate.note,
    rejectionReason: candidate.rejectionReason,
  });
}

export function createRoomMarkupCandidate(
  seed: RoomMarkupCandidateSeed,
  binding: RoomMarkupEvidenceBinding,
): RoomMarkupCandidate {
  if (!seed.id.trim()) throw new Error("A room markup candidate needs a stable ID.");
  if (!seed.roomId.trim()) throw new Error("A room markup candidate needs a stable room ID.");
  if (!Number.isInteger(seed.page) || seed.page < 1) {
    throw new Error("A room markup candidate needs a valid PDF page.");
  }
  if (!isReviewPoint(seed.sourcePoint)) {
    throw new Error("A room markup candidate point must use normalized page coordinates.");
  }
  if (!binding.sourceFingerprint.trim() || !binding.evidenceFingerprint.trim()) {
    throw new Error("Source and evidence fingerprints are required.");
  }
  return {
    ...seed,
    sourcePoint: clonePoint(seed.sourcePoint),
    reviewPoint: clonePoint(seed.sourcePoint),
    room: { ...seed.room },
    system: { ...seed.system },
    systemId: cleanAnswer(seed.systemId),
    scale: { ...seed.scale },
    scaleVerified: Boolean(seed.scaleVerified),
    returnStrategy: seed.returnStrategy ? { ...seed.returnStrategy } : undefined,
    terminalSelection: cleanTerminalSelection(seed.terminalSelection),
    binding: { ...binding },
    status: "proposed",
    answers: normalizedAnswers(seed.answers),
  };
}

export function roomMarkupQuestions(
  candidate: RoomMarkupCandidate,
): RoomMarkupQuestion[] {
  const definitions: Array<{
    kind: RoomMarkupQuestionKind;
    needed: boolean;
    prompt: string;
    answerType: "text" | "choice";
    options: string[];
  }> = [
    {
      kind: "room",
      needed: factNeedsQuestion(candidate.room),
      prompt: `Which room does this ${candidate.kind} review marker serve?`,
      answerType: "text",
      options: [],
    },
    {
      kind: "system",
      needed: factNeedsQuestion(candidate.system) || !candidate.systemId,
      prompt: "Which confirmed HVAC system serves this room?",
      answerType: "text",
      options: [],
    },
    {
      kind: "scale",
      needed: factNeedsQuestion(candidate.scale) || !candidate.scaleVerified,
      prompt: `Confirm the drawing scale for PDF page ${candidate.page}.`,
      answerType: "text",
      options: [],
    },
    {
      kind: "return-strategy",
      needed:
        candidate.kind === "return" &&
        factNeedsQuestion(candidate.returnStrategy),
      prompt: "Which reviewed return-air strategy should this room use?",
      answerType: "choice",
      options: [
        ...ROOM_MARKUP_RETURN_STRATEGIES,
      ],
    },
  ];

  return definitions
    .filter((definition) => definition.needed)
    .map((definition) => {
      const answer = definition.kind === "room"
        ? cleanAnswer(candidate.room.value)
        : definition.kind === "system"
          ? candidate.systemId
            ? cleanAnswer(candidate.system.value)
            : undefined
          : definition.kind === "scale"
            ? candidate.scaleVerified
              ? cleanAnswer(candidate.scale.value)
              : undefined
            : returnStrategy(candidate.answers[definition.kind]);
      const resolved = definition.kind === "return-strategy"
        ? Boolean(answer && answer !== "Needs field review")
        : definition.kind === "room"
          ? candidate.room.certainty === "confirmed" && Boolean(answer)
          : definition.kind === "system"
            ? candidate.system.certainty === "confirmed" &&
              Boolean(candidate.systemId) &&
              Boolean(answer)
            : candidate.scale.certainty === "confirmed" &&
              candidate.scaleVerified &&
              Boolean(answer);
      return {
        id: `${candidate.id}:question:${definition.kind}`,
        candidateId: candidate.id,
        kind: definition.kind,
        prompt: definition.prompt,
        answerType: definition.answerType,
        options: [...definition.options],
        answer,
        resolved,
      };
    });
}

export function refreshRoomMarkupCandidate(
  candidate: RoomMarkupCandidate,
  currentBinding: RoomMarkupEvidenceBinding,
): RoomMarkupCandidate {
  if (roomMarkupEvidenceIsCurrent(candidate, currentBinding)) return candidate;
  if (candidate.status === "stale") return candidate;
  return { ...candidate, status: "stale" };
}

export function transitionRoomMarkupCandidate(
  candidate: RoomMarkupCandidate,
  transition: RoomMarkupTransition,
  currentBinding: RoomMarkupEvidenceBinding,
): RoomMarkupTransitionResult {
  const currentCandidate = refreshRoomMarkupCandidate(candidate, currentBinding);
  if (currentCandidate.status === "stale") {
    return {
      candidate: currentCandidate,
      applied: false,
      reason: "The source or evidence changed. Rebuild this candidate before reviewing it.",
    };
  }
  if (currentCandidate.status === "rejected") {
    return {
      candidate: currentCandidate,
      applied: false,
      reason: "A rejected candidate must be rebuilt before it can be changed.",
    };
  }

  if (transition.type === "confirm") {
    const openQuestions = roomMarkupQuestions(currentCandidate).filter(
      (question) => !question.resolved,
    );
    if (openQuestions.length) {
      return {
        candidate: currentCandidate,
        applied: false,
        reason: `${openQuestions.length} required question${openQuestions.length === 1 ? "" : "s"} must be answered first.`,
      };
    }
    return {
      candidate: { ...currentCandidate, status: "confirmed" },
      applied: true,
      reason: "Review marker confirmed. No plan geometry was created or changed.",
    };
  }

  if (transition.type === "move") {
    if (!isReviewPoint(transition.reviewPoint)) {
      return {
        candidate: currentCandidate,
        applied: false,
        reason: "The review marker must stay within the normalized PDF page.",
      };
    }
    return {
      candidate: {
        ...currentCandidate,
        reviewPoint: clonePoint(transition.reviewPoint),
        status: "moved",
      },
      applied: true,
      reason: "Review marker moved. No plan geometry was created or changed.",
    };
  }

  if (transition.type === "edit") {
    const label = transition.label == null
      ? currentCandidate.label
      : transition.label.trim();
    if (!label) {
      return {
        candidate: currentCandidate,
        applied: false,
        reason: "The candidate label cannot be blank.",
      };
    }
    const requestedReturnStrategy = transition.answers?.["return-strategy"];
    if (requestedReturnStrategy && !returnStrategy(requestedReturnStrategy)) {
      return {
        candidate: currentCandidate,
        applied: false,
        reason: "Choose one of the listed return-air strategies.",
      };
    }
    const answers = normalizedAnswers({
      ...currentCandidate.answers,
      ...(transition.answers || {}),
    });
    if (answers["return-strategy"]) {
      answers["return-strategy"] = returnStrategy(answers["return-strategy"]);
    }
    const note = transition.note == null
      ? currentCandidate.note
      : cleanAnswer(transition.note);
    const roomName = transition.roomName == null
      ? currentCandidate.room.value
      : cleanAnswer(transition.roomName);
    if (transition.roomName != null && !roomName) {
      return {
        candidate: currentCandidate,
        applied: false,
        reason: "Enter the room name shown on the PDF before confirming this location.",
      };
    }
    const systemId = transition.systemId == null
      ? currentCandidate.systemId
      : cleanAnswer(transition.systemId);
    const systemLabel = transition.systemLabel == null
      ? currentCandidate.system.value
      : cleanAnswer(transition.systemLabel);
    if ((transition.systemId != null || transition.systemLabel != null) && (!systemId || !systemLabel)) {
      return {
        candidate: currentCandidate,
        applied: false,
        reason: "Choose a stable HVAC system before confirming this room.",
      };
    }
    const terminalSelection = transition.terminalSelection == null
      ? currentCandidate.terminalSelection
      : cleanTerminalSelection(transition.terminalSelection);
    if (transition.terminalSelection && !terminalSelection) {
      return {
        candidate: currentCandidate,
        applied: false,
        reason: "Choose a complete terminal type and face size.",
      };
    }
    return {
      candidate: {
        ...currentCandidate,
        label,
        note,
        room: transition.roomName == null
          ? currentCandidate.room
          : { value: roomName, certainty: "confirmed" },
        answers,
        systemId,
        system: systemId && systemLabel
          ? { value: systemLabel, certainty: "confirmed" }
          : currentCandidate.system,
        terminalSelection,
        status: "edited",
      },
      applied: true,
      reason: "Candidate review information edited. No plan geometry was created or changed.",
    };
  }

  const rejectionReason = transition.reason.trim();
  if (!rejectionReason) {
    return {
      candidate: currentCandidate,
      applied: false,
      reason: "Record why this candidate is being rejected.",
    };
  }
  return {
    candidate: {
      ...currentCandidate,
      status: "rejected",
      rejectionReason,
    },
    applied: true,
    reason: "Candidate rejected. The plan remains unchanged.",
  };
}

export function deriveRoomMarkupChecklist(
  candidates: readonly RoomMarkupCandidate[],
  currentBindings: RoomMarkupCurrentBindings,
): RoomMarkupChecklist {
  const isSingleBinding = (
    bindings: RoomMarkupCurrentBindings,
  ): bindings is RoomMarkupEvidenceBinding => (
    typeof (bindings as RoomMarkupEvidenceBinding).sourceFingerprint === "string" &&
    typeof (bindings as RoomMarkupEvidenceBinding).evidenceFingerprint === "string"
  );
  const bindingFor = (candidate: RoomMarkupCandidate) =>
    isSingleBinding(currentBindings)
      ? currentBindings
      : currentBindings[candidate.id] || {
        sourceFingerprint: "",
        evidenceFingerprint: "",
      };
  const items = candidates
    .map((candidate) => refreshRoomMarkupCandidate(candidate, bindingFor(candidate)))
    .sort((left, right) =>
      left.page - right.page ||
      (left.room.value || "").localeCompare(right.room.value || "") ||
      left.kind.localeCompare(right.kind) ||
      left.id.localeCompare(right.id)
    )
    .map((candidate): RoomMarkupChecklistItem => {
      const questions = roomMarkupQuestions(candidate);
      const openQuestionCount = questions.filter((question) => !question.resolved).length;
      return {
        candidate,
        questions,
        openQuestionCount,
        readyToConfirm:
          !["confirmed", "rejected", "stale"].includes(candidate.status) &&
          openQuestionCount === 0,
        stagedOnly: true,
      };
    });

  const statusCounts = STATUS_ORDER.reduce<Record<RoomMarkupCandidateStatus, number>>(
    (counts, status) => {
      counts[status] = items.filter((item) => item.candidate.status === status).length;
      return counts;
    },
    {
      proposed: 0,
      confirmed: 0,
      moved: 0,
      edited: 0,
      rejected: 0,
      stale: 0,
    },
  );
  return {
    items,
    counts: {
      total: items.length,
      ...statusCounts,
      openQuestions: items.reduce(
        (total, item) => total + item.openQuestionCount,
        0,
      ),
      needsAnswers: items.filter((item) => item.openQuestionCount > 0).length,
      readyToConfirm: items.filter((item) => item.readyToConfirm).length,
    },
  };
}
