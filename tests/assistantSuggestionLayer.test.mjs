import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescriptModule } from "./load-typescript-module.mjs";

const { buildAssistantSuggestionLayer } = await loadTypescriptModule(
  new URL("../app/assistantSuggestionLayer.ts", import.meta.url),
);

const region = (x, y) => ({
  x,
  y,
  width: 80,
  height: 20,
  pageWidth: 800,
  pageHeight: 600,
  coordinateSpace: "viewport-points",
});

function source(id, excerpt, x, y) {
  return {
    id,
    page: 1,
    sheetNumber: "A1.1",
    excerpt,
    confidence: 0.92,
    source: "PDF text layer",
    region: region(x, y),
  };
}

function setup() {
  return {
    version: "smart-plan-setup-v120.0",
    sourceFingerprint: "pdf-source-1",
    scales: [{
      page: 1,
      sheetNumber: "A1.1",
      title: "Floor plan",
      status: "verified",
      selectedCandidateId: "scale-1",
      selectedLabel: '1/4" = 1\'-0"',
      candidates: [],
      conflict: false,
      requiresCalibration: false,
      inheritedFromPages: [],
    }],
    rooms: [{
      id: "room-bedroom-2",
      name: "Bedroom 2",
      number: "2",
      page: 1,
      sheetNumber: "A1.1",
      status: "likely",
      ceilingType: "flat",
      ceilingHeight: null,
      conflictingHeights: [],
      sources: [source("room-source", "BEDROOM 2", 300, 200)],
    }, {
      id: "room-closet",
      name: "Closet",
      number: null,
      page: 1,
      sheetNumber: "A1.1",
      status: "likely",
      ceilingType: "unknown",
      ceilingHeight: null,
      conflictingHeights: [],
      sources: [source("closet-source", "CLOSET", 500, 200)],
    }],
    unassignedCeilingHeights: [],
    equipment: [{
      id: "equipment-ahu-1",
      tag: "AHU-1",
      equipmentType: "AHU",
      status: "likely",
      tonnage: 3,
      tonnageStatus: "likely",
      conflictingTonnages: [],
      sources: [source("equipment-source", "AHU-1 3 TON", 100, 450)],
    }],
    systems: [{
      id: "system-1",
      label: "System 1",
      kind: "system",
      status: "likely",
      sources: [source("system-source", "SYSTEM 1", 100, 420)],
    }],
    reviewQuestions: [],
    counts: {
      sheets: 1,
      verifiedScales: 1,
      likelyScales: 0,
      estimatedScales: 0,
      missingScales: 0,
      rooms: 2,
      roomHeights: 0,
      systems: 1,
      zones: 0,
      equipment: 1,
      equipmentReferences: 1,
      reviewItems: 0,
      requiredReviewItems: 0,
    },
    summary: {
      headline: "Ready",
      detail: "Ready",
      primaryActionLabel: "Connect",
      primaryAction: "connect-and-repair",
      readyForConnectionRepair: true,
      statusLines: [],
    },
  };
}

function analysis() {
  const current = setup();
  return {
    id: "analysis-1",
    sourceFingerprint: current.sourceFingerprint,
    sourceFileName: "plan.pdf",
    createdAt: "2026-07-28T00:00:00.000Z",
    pageCount: 1,
    pages: [{
      page: 1,
      sheetNumber: "A1.1",
      title: "Floor plan",
      classification: "Related sheet",
      hvacScore: 4,
      confidence: 0.9,
      textLength: 500,
      readable: true,
    }],
    evidence: [
      {
        id: "room-source",
        category: "Rooms",
        label: "Room name",
        value: "Bedroom 2",
        page: 1,
        sheetNumber: "A1.1",
        excerpt: "BEDROOM 2",
        confidence: 0.92,
        source: "PDF text layer",
        region: region(300, 200),
      },
      {
        id: "closet-source",
        category: "Rooms",
        label: "Room name",
        value: "Closet",
        page: 1,
        sheetNumber: "A1.1",
        excerpt: "CLOSET",
        confidence: 0.92,
        source: "PDF text layer",
        region: region(500, 200),
      },
      {
        id: "equipment-source",
        category: "Equipment",
        label: "Equipment tag",
        value: "AHU-1",
        page: 1,
        sheetNumber: "A1.1",
        excerpt: "AHU-1 3 TON",
        confidence: 0.92,
        source: "PDF text layer",
        region: region(100, 450),
      },
    ],
    findings: [],
    takeoff: [],
    summary: {
      mechanicalSheets: 1,
      readableSheets: 1,
      equipment: 1,
      ductSizes: 0,
      airDevices: 0,
      openFindings: 0,
      averageConfidence: 0.92,
    },
  };
}

function input(overrides = {}) {
  return {
    page: 1,
    scaleVerified: true,
    smartSetup: setup(),
    analysis: analysis(),
    sourceFingerprint: "pdf-source-1",
    activeSystemLabel: "System 1",
    equipmentAnchors: [],
    existingTerminals: [],
    ...overrides,
  };
}

test("blocks the layer until the selected page scale is confirmed", () => {
  const result = buildAssistantSuggestionLayer(input({ scaleVerified: false }));
  assert.equal(result.status, "blocked");
  assert.equal(result.suggestions.length, 0);
  assert.ok(result.missingInformation.some((item) => /scale/i.test(item)));
});

test("accepts a manually confirmed page scale when the PDF has no printed scale note", () => {
  const next = setup();
  next.scales = [];
  const result = buildAssistantSuggestionLayer(input({ smartSetup: next }));
  assert.equal(result.status, "review");
  assert.equal(result.missingInformation.length, 0);
});

test("blocks instead of guessing when room source locations are unavailable", () => {
  const next = setup();
  next.rooms = next.rooms.map((room) => ({ ...room, sources: room.sources.map((row) => ({ ...row, region: undefined })) }));
  const nextAnalysis = analysis();
  nextAnalysis.evidence = nextAnalysis.evidence.map((row) =>
    row.category === "Rooms" ? { ...row, region: undefined } : row
  );
  const result = buildAssistantSuggestionLayer(input({ smartSetup: next, analysis: nextAnalysis }));
  assert.equal(result.status, "blocked");
  assert.ok(result.missingInformation.some((item) => /room name/i.test(item)));
});

test("blocks scanned or textless pages until OCR or visual review", () => {
  const next = analysis();
  next.pages[0].readable = false;
  const result = buildAssistantSuggestionLayer(input({ analysis: next }));
  assert.equal(result.status, "blocked");
  assert.ok(result.missingInformation.some((item) => /OCR|visual review/i.test(item)));
});

test("invalidates the layer when the loaded PDF fingerprint changes", () => {
  const result = buildAssistantSuggestionLayer(input({ sourceFingerprint: "new-pdf" }));
  assert.equal(result.status, "blocked");
  assert.ok(result.missingInformation.some((item) => /PDF changed/i.test(item)));
});

test("creates evidence-linked supply and return review zones without changing geometry", () => {
  const result = buildAssistantSuggestionLayer(input());
  assert.equal(result.status, "review");
  assert.deepEqual(result.suggestions.map((row) => row.kind).sort(), ["return", "supply"]);
  assert.ok(result.suggestions.every((row) => row.roomName === "Bedroom 2"));
  assert.ok(result.suggestions.every((row) => row.label.includes("review zone")));
  assert.ok(result.detail.includes("not exact engineered locations"));
});

test("does not duplicate a terminal already assigned to the room", () => {
  const result = buildAssistantSuggestionLayer(input({
    existingTerminals: [{
      id: "supply-1",
      kind: "supply",
      page: 1,
      roomName: "Bedroom 2",
      point: { x: 0.2, y: 0.2 },
    }],
  }));
  assert.deepEqual(result.suggestions.map((row) => row.kind), ["return"]);
});

test("blocks ambiguous multi-system pages instead of assigning rooms by proximity", () => {
  const next = setup();
  next.systems.push({
    id: "system-2",
    label: "System 2",
    kind: "system",
    status: "likely",
    sources: [source("system-2-source", "SYSTEM 2", 680, 420)],
  });
  const result = buildAssistantSuggestionLayer(input({ smartSetup: next }));
  assert.equal(result.status, "blocked");
  assert.ok(result.missingInformation.some((item) => /which rooms/i.test(item)));
});

test("primary bathroom text never creates a return-grille recommendation", () => {
  const nextSetup = setup();
  nextSetup.rooms = [{
    ...nextSetup.rooms[0],
    id: "room-primary-bath",
    name: "Primary Bathroom",
    sources: [source("primary-bath-source", "PRIMARY BATHROOM", 300, 200)],
  }];
  const nextAnalysis = analysis();
  nextAnalysis.evidence = nextAnalysis.evidence.filter((row) => row.category !== "Rooms");
  nextAnalysis.evidence.push({
    id: "primary-bath-source",
    category: "Rooms",
    label: "Room name",
    value: "Primary Bathroom",
    page: 1,
    sheetNumber: "A1.1",
    excerpt: "PRIMARY BATHROOM",
    confidence: 0.92,
    source: "PDF text layer",
    region: region(300, 200),
  });
  const result = buildAssistantSuggestionLayer(input({
    smartSetup: nextSetup,
    analysis: nextAnalysis,
  }));
  assert.ok(result.suggestions.every((row) => row.kind !== "return"));
});

test("fingerprint is stable for the same evidence and page", () => {
  const first = buildAssistantSuggestionLayer(input());
  const second = buildAssistantSuggestionLayer(input());
  assert.equal(first.evidenceFingerprint, second.evidenceFingerprint);
});
