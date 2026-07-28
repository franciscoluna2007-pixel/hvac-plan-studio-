import type {
  PlanFactSource,
  PlanSetupRegion,
  RoomFact,
  SmartPlanSetup,
} from "./planSetup";
import type { PlanAnalysis, PlanEvidence } from "./planReader";

export const ASSISTANT_SUGGESTION_LAYER_VERSION = "assistant-suggestion-layer-v128.0";

export type AssistantSuggestionKind = "supply" | "return";

export type NormalizedPoint = {
  x: number;
  y: number;
};

export type ExistingTerminalAnchor = {
  id: string;
  kind: AssistantSuggestionKind;
  page: number;
  roomName?: string;
  point: NormalizedPoint;
};

export type EquipmentAnchor = {
  id: string;
  page: number;
  point: NormalizedPoint;
  label: string;
};

export type AssistantSuggestion = {
  id: string;
  kind: AssistantSuggestionKind;
  page: number;
  roomId: string;
  roomName: string;
  point: NormalizedPoint;
  sourceRegion: PlanSetupRegion;
  confidence: number;
  label: string;
  explanation: string;
  evidence: string[];
  sourceEvidenceIds: string[];
  evidenceFingerprint: string;
  geometry: "review-zone";
  readiness: "confirm-location";
};

export type AssistantSuggestionLayer = {
  version: typeof ASSISTANT_SUGGESTION_LAYER_VERSION;
  page: number;
  status: "review" | "blocked" | "clear";
  headline: string;
  detail: string;
  confidence: number;
  evidenceFingerprint: string;
  missingInformation: string[];
  basis: string[];
  suggestions: AssistantSuggestion[];
};

type BuildAssistantSuggestionLayerInput = {
  page: number;
  scaleVerified: boolean;
  smartSetup: SmartPlanSetup | null;
  analysis: PlanAnalysis | null;
  sourceFingerprint: string;
  activeSystemLabel: string;
  equipmentAnchors?: EquipmentAnchor[];
  existingTerminals?: ExistingTerminalAnchor[];
};

const NON_SUPPLY_ROOM = /\b(?:CLOSET|PANTRY|MECHANICAL|GARAGE|ATTIC|CRAWL|SHAFT)\b/i;
const RETURN_ROOM = /\b(?:BED(?:ROOM)?|PRIMARY|MASTER|SUITE|LIVING|GREAT|FAMILY|BONUS|GAME|MEDIA|OFFICE|STUDY|DEN)\b/i;
const NON_RETURN_ROOM = /\b(?:BATH(?:ROOM)?|CLOSET|PANTRY|KITCHEN|LAUNDRY|UTILITY|MECHANICAL|GARAGE|ATTIC|CRAWL|SHAFT)\b/i;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function clamp(value: number, minimum = 0.025, maximum = 0.975) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizedRoomName(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function regionCenter(region: PlanSetupRegion): NormalizedPoint {
  return {
    x: clamp((region.x + region.width / 2) / Math.max(1, region.pageWidth)),
    y: clamp((region.y + region.height / 2) / Math.max(1, region.pageHeight)),
  };
}

function planEvidenceSource(evidence: PlanEvidence): PlanFactSource {
  return {
    id: evidence.id,
    page: evidence.page,
    sheetNumber: evidence.sheetNumber,
    excerpt: evidence.excerpt,
    confidence: evidence.confidence,
    source: evidence.source,
    ...(evidence.region ? { region: evidence.region } : {}),
  };
}

function sourceForRoom(room: RoomFact, analysis: PlanAnalysis, page: number) {
  const roomName = normalizedRoomName(room.name);
  const exact = analysis.evidence
    .filter((evidence) =>
      evidence.page === page &&
      evidence.category === "Rooms" &&
      evidence.label === "Room name" &&
      evidence.region &&
      normalizedRoomName(evidence.value) === roomName
    )
    .sort((left, right) =>
      right.confidence - left.confidence ||
      left.id.localeCompare(right.id)
    )[0];
  return exact ? planEvidenceSource(exact) : undefined;
}

function sourceForEquipment(smartSetup: SmartPlanSetup, analysis: PlanAnalysis, page: number) {
  return smartSetup.equipment
    .flatMap((equipment) => analysis.evidence
      .filter((evidence) =>
        evidence.category === "Equipment" &&
        evidence.label === "Equipment tag" &&
        evidence.region &&
        normalizedRoomName(evidence.value) === normalizedRoomName(equipment.tag)
      )
      .map((evidence) => ({
        equipment,
        source: planEvidenceSource(evidence),
      })))
    .sort((left, right) =>
      Number(right.source.page === page) - Number(left.source.page === page) ||
      right.source.confidence - left.source.confidence ||
      left.equipment.tag.localeCompare(right.equipment.tag)
    )[0];
}

function near(left: NormalizedPoint, right: NormalizedPoint, threshold = 0.045) {
  return Math.hypot(left.x - right.x, left.y - right.y) <= threshold;
}

function existingTerminalForRoom(
  room: RoomFact,
  point: NormalizedPoint,
  kind: AssistantSuggestionKind,
  terminals: ExistingTerminalAnchor[],
) {
  const roomName = normalizedRoomName(room.name);
  return terminals.some((terminal) =>
    terminal.kind === kind &&
    terminal.page === room.page &&
    (
      (terminal.roomName && normalizedRoomName(terminal.roomName) === roomName) ||
      near(terminal.point, point)
    )
  );
}

function suggestedPoint(
  roomPoint: NormalizedPoint,
  kind: AssistantSuggestionKind,
  index: number,
) {
  const alternating = index % 2 ? -1 : 1;
  return kind === "supply"
    ? {
      x: clamp(roomPoint.x + 0.027 * alternating),
      y: clamp(roomPoint.y - 0.032),
    }
    : {
      x: clamp(roomPoint.x - 0.032 * alternating),
      y: clamp(roomPoint.y + 0.034),
    };
}

function missingLayer(
  input: BuildAssistantSuggestionLayerInput,
  missingInformation: string[],
  basis: string[],
) : AssistantSuggestionLayer {
  const evidenceFingerprint = stableHash([
    ASSISTANT_SUGGESTION_LAYER_VERSION,
    input.page,
    input.smartSetup?.sourceFingerprint || "no-plan",
    ...missingInformation,
  ].join("|"));
  return {
    version: ASSISTANT_SUGGESTION_LAYER_VERSION,
    page: input.page,
    status: "blocked",
    headline: "Not enough plan information for placement suggestions",
    detail: "The assistant will not guess at supply or return locations. Resolve the items below, then reopen this layer.",
    confidence: 0,
    evidenceFingerprint,
    missingInformation,
    basis,
    suggestions: [],
  };
}

function sourceEvidence(source: PlanFactSource) {
  return `${source.sheetNumber}: ${source.excerpt}`;
}

export function buildAssistantSuggestionLayer(
  input: BuildAssistantSuggestionLayerInput,
): AssistantSuggestionLayer {
  const setup = input.smartSetup;
  const analysis = input.analysis;
  const missingInformation: string[] = [];
  const basis: string[] = [];
  if (!setup || !analysis) {
    return missingLayer(input, ["Let Plan Helper read the selected PDF page."], basis);
  }
  if (
    input.sourceFingerprint !== setup.sourceFingerprint ||
    input.sourceFingerprint !== analysis.sourceFingerprint
  ) {
    return missingLayer(input, ["The PDF changed. Read this page again before showing suggestions."], basis);
  }
  if (analysis.persistence?.truncated) {
    missingInformation.push("Read this PDF again because the saved source evidence is incomplete.");
  }
  const pageReading = analysis.pages.find((page) => page.page === input.page);
  if (!pageReading?.readable) {
    missingInformation.push("This page needs OCR or a visual review before the assistant can locate room evidence.");
  }

  if (!input.scaleVerified) missingInformation.push("Confirm the scale for this page.");

  const roomRows = setup.rooms
    .filter((room) => room.page === input.page)
    .map((room) => ({ room, source: sourceForRoom(room, analysis, input.page) }))
    .filter((row): row is { room: RoomFact; source: PlanFactSource & { region: PlanSetupRegion } } =>
      Boolean(row.source?.region)
    );
  if (!roomRows.length) {
    missingInformation.push("Identify at least one readable room name with a source location on this page.");
  }

  const placedEquipment = (input.equipmentAnchors || []).find((anchor) => anchor.page === input.page);
  const extractedEquipment = sourceForEquipment(setup, analysis, input.page);
  if (!placedEquipment && !extractedEquipment?.source.region) {
    missingInformation.push("Place or confirm the HVAC unit serving this page.");
  }

  const systemQuestion = setup.reviewQuestions.find((question) =>
    question.priority === "required" &&
    question.category === "system" &&
    (question.page == null || question.page === input.page)
  );
  const systemIsKnown = Boolean(
    setup.systems.length ||
    (placedEquipment && input.activeSystemLabel.trim())
  );
  if (
    !systemIsKnown ||
    (systemQuestion && setup.equipment.length > 1) ||
    setup.systems.length > 1
  ) {
    missingInformation.push("Confirm which rooms belong to this HVAC system.");
  }

  const requiredScaleQuestion = setup.reviewQuestions.find((question) =>
    question.priority === "required" &&
    question.category === "scale" &&
    question.page === input.page
  );
  if (requiredScaleQuestion && !input.scaleVerified) {
    missingInformation.push(requiredScaleQuestion.title);
  }

  if (missingInformation.length) {
    return missingLayer(input, [...new Set(missingInformation)], basis);
  }

  basis.push(
    `Verified page scale`,
    `${roomRows.length} room source location${roomRows.length === 1 ? "" : "s"}`,
    placedEquipment
      ? `${placedEquipment.label} placed on the plan`
      : `${extractedEquipment!.equipment.tag} source location`,
    `${input.activeSystemLabel} review context`,
  );

  const terminals = input.existingTerminals || [];
  const suggestions: AssistantSuggestion[] = [];
  roomRows.forEach(({ room, source }, index) => {
    const roomPoint = regionCenter(source.region);
    if (
      !NON_SUPPLY_ROOM.test(room.name) &&
      !existingTerminalForRoom(room, roomPoint, "supply", terminals)
    ) {
      suggestions.push({
        id: `suggestion-supply-${stableHash(`${setup.sourceFingerprint}|${room.id}|${input.page}`)}`,
        kind: "supply",
        page: input.page,
        roomId: room.id,
        roomName: room.name,
        point: suggestedPoint(roomPoint, "supply", index),
        sourceRegion: source.region,
        confidence: Math.min(0.88, source.confidence, placedEquipment ? 0.88 : extractedEquipment!.source.confidence),
        label: `Supply review zone - ${room.name}`,
        explanation: `A preliminary supply review zone near the readable ${room.name} label. Confirm walls, glass, ceiling pattern, throw, load, and diffuser type before placing anything.`,
        evidence: [
          sourceEvidence(source),
          placedEquipment
            ? `${placedEquipment.label} is placed on this page`
            : sourceEvidence(extractedEquipment!.source),
          "Page scale confirmed",
        ],
        sourceEvidenceIds: [source.id, extractedEquipment?.source.id].filter((id): id is string => Boolean(id)),
        evidenceFingerprint: stableHash([
          ASSISTANT_SUGGESTION_LAYER_VERSION,
          setup.sourceFingerprint,
          input.page,
          input.activeSystemLabel,
          room.id,
          "supply",
          source.id,
          source.region.x,
          source.region.y,
          source.region.width,
          source.region.height,
        ].join("|")),
        geometry: "review-zone",
        readiness: "confirm-location",
      });
    }
    if (
      RETURN_ROOM.test(room.name) &&
      !NON_RETURN_ROOM.test(room.name) &&
      !existingTerminalForRoom(room, roomPoint, "return", terminals)
    ) {
      suggestions.push({
        id: `suggestion-return-${stableHash(`${setup.sourceFingerprint}|${room.id}|${input.page}`)}`,
        kind: "return",
        page: input.page,
        roomId: room.id,
        roomName: room.name,
        point: suggestedPoint(roomPoint, "return", index),
        sourceRegion: source.region,
        confidence: Math.min(0.84, source.confidence, placedEquipment ? 0.86 : extractedEquipment!.source.confidence),
        label: `Return review zone - ${room.name}`,
        explanation: `A preliminary return-path review zone for ${room.name}. Confirm the chosen return strategy, door condition, transfer path, grille size, noise, and pressure before drawing.`,
        evidence: [
          sourceEvidence(source),
          `${room.name} matches the company return-path review pattern`,
          "No matching return markup was found for this room",
        ],
        sourceEvidenceIds: [source.id],
        evidenceFingerprint: stableHash([
          ASSISTANT_SUGGESTION_LAYER_VERSION,
          setup.sourceFingerprint,
          input.page,
          input.activeSystemLabel,
          room.id,
          "return-path-review",
          source.id,
          source.region.x,
          source.region.y,
          source.region.width,
          source.region.height,
        ].join("|")),
        geometry: "review-zone",
        readiness: "confirm-location",
      });
    }
  });

  const evidenceFingerprint = stableHash([
    ASSISTANT_SUGGESTION_LAYER_VERSION,
    setup.sourceFingerprint,
    input.page,
    input.activeSystemLabel,
    ...basis,
    ...suggestions.map((suggestion) =>
      `${suggestion.id}:${suggestion.kind}:${suggestion.point.x.toFixed(5)}:${suggestion.point.y.toFixed(5)}`
    ),
  ].join("|"));
  if (!suggestions.length) {
    return {
      version: ASSISTANT_SUGGESTION_LAYER_VERSION,
      page: input.page,
      status: "clear",
      headline: "No new supply or return review zones",
      detail: "Every readable room on this page already has a nearby matching markup, or the room type does not call for a new suggestion.",
      confidence: 1,
      evidenceFingerprint,
      missingInformation: [],
      basis,
      suggestions: [],
    };
  }

  return {
    version: ASSISTANT_SUGGESTION_LAYER_VERSION,
    page: input.page,
    status: "review",
    headline: `${suggestions.length} transparent review zone${suggestions.length === 1 ? "" : "s"} ready`,
    detail: "These are evidence-linked planning suggestions, not exact engineered locations. The PDF and drawing remain unchanged until a person places or approves plan geometry.",
    confidence: suggestions.reduce((total, suggestion) => total + suggestion.confidence, 0) / suggestions.length,
    evidenceFingerprint,
    missingInformation: [],
    basis,
    suggestions,
  };
}
