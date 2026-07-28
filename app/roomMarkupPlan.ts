import type {
  AssistantSuggestion,
  AssistantSuggestionLayer,
} from "./assistantSuggestionLayer";
import {
  createRoomMarkupCandidate,
  deriveRoomMarkupChecklist,
  ROOM_MARKUP_RETURN_STRATEGIES,
  roomMarkupCandidateReviewFingerprint,
  type RoomMarkupApplicationRecord,
  type RoomMarkupCandidate,
  type RoomMarkupChecklistItem,
  type RoomMarkupEvidenceBinding,
  type RoomMarkupReturnStrategy,
  type RoomMarkupTerminalSelection,
} from "./roomMarkupLifecycle";

export const ROOM_MARKUP_PLAN_VERSION = "room-markup-plan-v131.0";

export type RoomMarkupTerminalOption = RoomMarkupTerminalSelection & {
  kind: "supply" | "return";
};

export const DEFAULT_ROOM_MARKUP_TERMINALS: RoomMarkupTerminalOption[] = [
  {
    optionId: "supply-4way",
    kind: "supply",
    label: "4-way supply",
    size: "12×12",
    variant: "4way",
    elevation: "CEILING",
  },
  {
    optionId: "supply-2way",
    kind: "supply",
    label: "2-way supply",
    size: "12×12",
    variant: "2way",
    elevation: "CEILING",
  },
  {
    optionId: "supply-sidewall-12x6",
    kind: "supply",
    label: "Sidewall supply",
    size: "12×6",
    variant: "register",
    elevation: "HIGH WALL",
  },
  {
    optionId: "return-standard",
    kind: "return",
    label: "Dedicated return grille",
    size: "14×14",
    variant: "grille",
    elevation: "CEILING",
  },
  {
    optionId: "return-highwall-14x6",
    kind: "return",
    label: "High-wall return grille",
    size: "14×6",
    variant: "bar",
    elevation: "HIGH WALL",
  },
];

export type RoomMarkupRoomStatus =
  | "needs-review"
  | "ready-to-add"
  | "added"
  | "reviewed-no-markup"
  | "on-hold"
  | "stale";

export type RoomMarkupRoomPlan = {
  id: string;
  roomId: string;
  roomName: string;
  page: number;
  systemId: string;
  status: RoomMarkupRoomStatus;
  ceilingHeight?: AssistantSuggestion["roomCeilingHeight"];
  ceilingType?: string;
  sourceRegion?: AssistantSuggestion["sourceRegion"];
  items: RoomMarkupChecklistItem[];
  supplyToAdd: number;
  returnToAdd: number;
  reviewedWithoutMarkup: number;
  appliedCandidateIds: string[];
  createdDrawingIdsByCandidate: Record<string, string>;
  createdDrawingIds: string[];
  latestApplication?: RoomMarkupApplicationRecord;
};

export type RoomMarkupExistingTerminal = {
  id: string;
  page: number;
  systemId: string;
  kind: "supply" | "return";
  roomName?: string;
  candidateId?: string;
  sourceFingerprint?: string;
  evidenceFingerprint?: string;
};

export type RoomMarkupPlan = {
  version: typeof ROOM_MARKUP_PLAN_VERSION;
  page: number;
  sourceFingerprint: string;
  systemId: string;
  status: AssistantSuggestionLayer["status"];
  headline: string;
  detail: string;
  missingInformation: string[];
  rooms: RoomMarkupRoomPlan[];
  overlayCandidates: RoomMarkupCandidate[];
  currentBindings: Record<string, RoomMarkupEvidenceBinding>;
  counts: {
    rooms: number;
    needsReview: number;
    readyToAdd: number;
    added: number;
    reviewedNoMarkup: number;
    onHold: number;
    stale: number;
    candidates: number;
  };
};

type BuildRoomMarkupPlanInput = {
  layer: AssistantSuggestionLayer;
  sourceFingerprint: string;
  systemId: string;
  systemLabel: string;
  scaleVerified: boolean;
  scaleLabel: string;
  savedCandidates: readonly RoomMarkupCandidate[];
  applicationRecords: readonly RoomMarkupApplicationRecord[];
  existingTerminals: readonly RoomMarkupExistingTerminal[];
  terminalOptions?: readonly RoomMarkupTerminalOption[];
};

function currentBinding(
  sourceFingerprint: string,
  suggestion: AssistantSuggestion,
): RoomMarkupEvidenceBinding {
  return {
    sourceFingerprint,
    evidenceFingerprint: suggestion.evidenceFingerprint,
  };
}

function defaultTerminal(
  kind: "supply" | "return",
  options: readonly RoomMarkupTerminalOption[],
) {
  return options.find((option) => option.kind === kind);
}

function seedCandidate(
  suggestion: AssistantSuggestion,
  input: BuildRoomMarkupPlanInput,
  options: readonly RoomMarkupTerminalOption[],
) {
  const systemConfirmed = suggestion.systemAssignmentConfirmed !== false;
  return createRoomMarkupCandidate({
    id: suggestion.id,
    roomId: suggestion.roomId,
    kind: suggestion.kind,
    page: suggestion.page,
    label: suggestion.label,
    sourcePoint: suggestion.point,
    room: {
      value: suggestion.roomName,
      certainty: suggestion.roomAssignmentConfirmed ? "confirmed" : "uncertain",
    },
    system: {
      value: input.systemLabel,
      certainty: systemConfirmed ? "confirmed" : "uncertain",
    },
    systemId: systemConfirmed ? input.systemId : undefined,
    scale: {
      value: input.scaleLabel,
      certainty: input.scaleVerified ? "confirmed" : "uncertain",
    },
    scaleVerified: input.scaleVerified,
    returnStrategy: suggestion.kind === "return"
      ? { certainty: "missing" }
      : undefined,
    terminalSelection: defaultTerminal(suggestion.kind, options),
  }, currentBinding(input.sourceFingerprint, suggestion));
}

function mergeCurrentCandidate(
  seed: RoomMarkupCandidate,
  saved?: RoomMarkupCandidate,
) {
  if (!saved) return seed;
  if (
    saved.binding.sourceFingerprint !== seed.binding.sourceFingerprint ||
    saved.binding.evidenceFingerprint !== seed.binding.evidenceFingerprint
  ) {
    return { ...saved, status: "stale" as const };
  }
  return {
    ...saved,
    id: seed.id,
    roomId: seed.roomId,
    kind: seed.kind,
    room: saved.room,
    page: seed.page,
    sourcePoint: seed.sourcePoint,
    scale: seed.scale,
    scaleVerified: seed.scaleVerified,
    binding: seed.binding,
    terminalSelection: saved.terminalSelection || seed.terminalSelection,
  };
}

function latestRoomApplication(
  records: readonly RoomMarkupApplicationRecord[],
  roomId: string,
  systemId: string,
  page: number,
  sourceFingerprint: string,
  items: readonly RoomMarkupChecklistItem[],
) {
  const candidateFingerprints = Object.fromEntries(
    items.map((item) => [
      item.candidate.id,
      roomMarkupCandidateReviewFingerprint(item.candidate),
    ]),
  );
  return matchingRoomApplications(
    records,
    roomId,
    systemId,
    page,
    sourceFingerprint,
    items,
  ).filter((record) =>
    JSON.stringify(Object.entries(record.candidateFingerprints || {}).sort()) ===
    JSON.stringify(Object.entries(candidateFingerprints).sort())
  )[0];
}

function matchingRoomApplications(
  records: readonly RoomMarkupApplicationRecord[],
  roomId: string,
  systemId: string,
  page: number,
  sourceFingerprint: string,
  items: readonly RoomMarkupChecklistItem[],
) {
  const evidenceFingerprints = items
    .map((item) => item.candidate.binding.evidenceFingerprint)
    .sort();
  return matchingRoomIdentityApplications(
    records,
    roomId,
    systemId,
    page,
    sourceFingerprint,
    items,
  )
    .filter((record) =>
      JSON.stringify([...record.evidenceFingerprints].sort()) === JSON.stringify(evidenceFingerprints)
    );
}

function matchingRoomIdentityApplications(
  records: readonly RoomMarkupApplicationRecord[],
  roomId: string,
  systemId: string,
  page: number,
  sourceFingerprint: string,
  items: readonly RoomMarkupChecklistItem[],
) {
  const candidateIds = items.map((item) => item.candidate.id).sort();
  return [...records]
    .filter((record) =>
      record.roomId === roomId &&
      record.systemId === systemId &&
      record.page === page &&
      !record.reversedAt &&
      record.sourceFingerprint === sourceFingerprint &&
      JSON.stringify([...record.candidateIds].sort()) === JSON.stringify(candidateIds)
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function returnStrategy(candidate: RoomMarkupCandidate) {
  const value = candidate.answers["return-strategy"];
  return ROOM_MARKUP_RETURN_STRATEGIES.find((option) => option === value);
}

function createsTerminal(candidate: RoomMarkupCandidate) {
  if (candidate.status !== "confirmed") return false;
  if (candidate.kind === "supply") return true;
  return returnStrategy(candidate) === "Dedicated return";
}

function reviewedWithoutTerminal(candidate: RoomMarkupCandidate) {
  if (candidate.status === "rejected") return true;
  if (candidate.kind !== "return" || candidate.status !== "confirmed") return false;
  const strategy = returnStrategy(candidate);
  return Boolean(strategy && strategy !== "Dedicated return" && strategy !== "Needs field review");
}

function roomStatus(
  items: RoomMarkupChecklistItem[],
  latestApplication: RoomMarkupApplicationRecord | undefined,
  appliedCandidateIds: Set<string>,
): RoomMarkupRoomStatus {
  if (items.some((item) => item.candidate.status === "stale")) return "stale";
  if (latestApplication) {
    const terminalCandidateIds = items
      .map((item) => item.candidate)
      .filter(createsTerminal)
      .map((candidate) => candidate.id);
    if (!terminalCandidateIds.length) return "reviewed-no-markup";
    if (terminalCandidateIds.every((id) => appliedCandidateIds.has(id))) {
      return "added";
    }
  }
  if (
    items.some((item) =>
      item.openQuestionCount > 0 ||
      returnStrategy(item.candidate) === "Needs field review"
    )
  ) return "on-hold";
  if (
    items.length &&
    items.every((item) =>
      item.candidate.status === "confirmed" ||
      item.candidate.status === "rejected"
    )
  ) return "ready-to-add";
  return "needs-review";
}

export function buildRoomMarkupPlan(
  input: BuildRoomMarkupPlanInput,
): RoomMarkupPlan {
  const options = input.terminalOptions?.length
    ? input.terminalOptions
    : DEFAULT_ROOM_MARKUP_TERMINALS;
  const savedById = new Map(
    input.savedCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const currentBindings: Record<string, RoomMarkupEvidenceBinding> = {};
  const seeded = input.layer.suggestions.map((suggestion) => {
    const seed = seedCandidate(suggestion, input, options);
    currentBindings[seed.id] = seed.binding;
    return mergeCurrentCandidate(seed, savedById.get(seed.id));
  });
  const currentIds = new Set(seeded.map((candidate) => candidate.id));
  const appliedCandidateIds = new Set(
    input.applicationRecords
      .filter((record) =>
        record.systemId === input.systemId &&
        record.page === input.layer.page &&
        !record.reversedAt &&
        record.sourceFingerprint === input.sourceFingerprint
      )
      .flatMap((record) => record.candidateIds),
  );
  const retainedApplied = input.savedCandidates
    .filter((candidate) =>
      candidate.page === input.layer.page &&
      !currentIds.has(candidate.id) &&
      appliedCandidateIds.has(candidate.id)
    )
    .map((candidate) => {
      const binding = {
        sourceFingerprint: input.sourceFingerprint,
        evidenceFingerprint: "",
      };
      currentBindings[candidate.id] = binding;
      return { ...candidate, status: "stale" as const };
    });
  const checklist = deriveRoomMarkupChecklist(
    [...seeded, ...retainedApplied],
    currentBindings,
  );
  const existingTerminalById = new Map(
    input.existingTerminals.map((terminal) => [terminal.id, terminal]),
  );
  const suggestionById = new Map(
    input.layer.suggestions.map((suggestion) => [suggestion.id, suggestion]),
  );
  const roomGroups = new Map<string, RoomMarkupChecklistItem[]>();
  checklist.items.forEach((item) => {
    const rows = roomGroups.get(item.candidate.roomId) || [];
    rows.push(item);
    roomGroups.set(item.candidate.roomId, rows);
  });
  const rooms = [...roomGroups.entries()]
    .map(([roomId, items]): RoomMarkupRoomPlan => {
      const candidate = items[0].candidate;
      const suggestion = suggestionById.get(candidate.id);
      const latestApplication = latestRoomApplication(
        input.applicationRecords,
        roomId,
        input.systemId,
        candidate.page,
        input.sourceFingerprint,
        items,
      );
      const latestDrawingApplication = matchingRoomIdentityApplications(
        input.applicationRecords,
        roomId,
        input.systemId,
        candidate.page,
        input.sourceFingerprint,
        items,
      )[0];
      const normalizedRoomName = (value?: string) =>
        (value || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
      const createdDrawingIdsByCandidate = Object.fromEntries(
        Object.entries(latestDrawingApplication?.createdDrawingIdsByCandidate || {})
          .filter(([candidateId, drawingId]) => {
            const item = items.find((row) => row.candidate.id === candidateId);
            const terminal = existingTerminalById.get(drawingId);
            if (!item || !terminal) return false;
            return (
              terminal.page === item.candidate.page &&
              terminal.systemId === input.systemId &&
              terminal.kind === item.candidate.kind &&
              terminal.candidateId === item.candidate.id &&
              terminal.sourceFingerprint === input.sourceFingerprint &&
              terminal.evidenceFingerprint ===
                item.candidate.binding.evidenceFingerprint &&
              normalizedRoomName(terminal.roomName) ===
                normalizedRoomName(item.candidate.room.value)
            );
          }),
      );
      const appliedCandidateIds = new Set(Object.keys(createdDrawingIdsByCandidate));
      const createdDrawingIds = Object.values(createdDrawingIdsByCandidate);
      return {
        id: `${input.systemId}:${candidate.page}:${roomId}`,
        roomId,
        roomName: candidate.room.value || "Unconfirmed room",
        page: candidate.page,
        systemId: input.systemId,
        status: roomStatus(items, latestApplication, appliedCandidateIds),
        ceilingHeight: suggestion?.roomCeilingHeight,
        ceilingType: suggestion?.roomCeilingType,
        sourceRegion: suggestion?.sourceRegion,
        items,
        supplyToAdd: items.filter((item) =>
          item.candidate.kind === "supply" &&
          createsTerminal(item.candidate) &&
          !appliedCandidateIds.has(item.candidate.id)
        ).length,
        returnToAdd: items.filter((item) =>
          item.candidate.kind === "return" &&
          createsTerminal(item.candidate) &&
          !appliedCandidateIds.has(item.candidate.id)
        ).length,
        reviewedWithoutMarkup: items.filter((item) =>
          reviewedWithoutTerminal(item.candidate)
        ).length,
        appliedCandidateIds: [...appliedCandidateIds].sort(),
        createdDrawingIdsByCandidate,
        createdDrawingIds,
        latestApplication,
      };
    })
    .sort((left, right) =>
      left.page - right.page ||
      left.roomName.localeCompare(right.roomName) ||
      left.roomId.localeCompare(right.roomId)
    );
  const appliedCandidateIdsWithDrawings = new Set(
    rooms.flatMap((room) => room.appliedCandidateIds),
  );
  const overlayCandidates = checklist.items
    .map((item) => item.candidate)
    .filter((candidate) => {
      if (["rejected", "stale"].includes(candidate.status)) return false;
      if (appliedCandidateIdsWithDrawings.has(candidate.id)) return false;
      if (candidate.kind !== "return") return true;
      const strategy = returnStrategy(candidate);
      return !strategy || strategy === "Dedicated return" || strategy === "Needs field review";
    });

  return {
    version: ROOM_MARKUP_PLAN_VERSION,
    page: input.layer.page,
    sourceFingerprint: input.sourceFingerprint,
    systemId: input.systemId,
    status: input.layer.status,
    headline: input.layer.headline,
    detail: input.layer.detail,
    missingInformation: [...input.layer.missingInformation],
    rooms,
    overlayCandidates,
    currentBindings,
    counts: {
      rooms: rooms.length,
      needsReview: rooms.filter((room) => room.status === "needs-review").length,
      readyToAdd: rooms.filter((room) => room.status === "ready-to-add").length,
      added: rooms.filter((room) => room.status === "added").length,
      reviewedNoMarkup: rooms.filter((room) => room.status === "reviewed-no-markup").length,
      onHold: rooms.filter((room) => room.status === "on-hold").length,
      stale: rooms.filter((room) => room.status === "stale").length,
      candidates: checklist.counts.total,
    },
  };
}

export function roomMarkupStrategy(
  candidate: RoomMarkupCandidate,
): RoomMarkupReturnStrategy | undefined {
  return returnStrategy(candidate);
}

export function roomMarkupCandidateCreatesTerminal(candidate: RoomMarkupCandidate) {
  return createsTerminal(candidate);
}
