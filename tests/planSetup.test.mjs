import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const { buildSmartPlanSetup } = await loadTypescriptModule(
  new URL("../app/planSetup.ts", import.meta.url),
);

function fixture(pages, evidence = []) {
  return {
    id: "analysis-v120-test",
    sourceFingerprint: "source-v120-test",
    sourceFileName: "test-plan.pdf",
    createdAt: "2026-07-27T00:00:00.000Z",
    pageCount: pages.length,
    pages,
    evidence,
    findings: [],
    takeoff: [],
    summary: {
      mechanicalSheets: pages.filter((page) => page.classification === "Mechanical plan").length,
      readableSheets: pages.filter((page) => page.readable).length,
      equipment: evidence.filter((row) => row.category === "Equipment").length,
      ductSizes: 0,
      airDevices: 0,
      openFindings: 0,
      averageConfidence: 0.9,
    },
  };
}

const mechanicalPage = {
  page: 1,
  sheetNumber: "M1.1",
  title: "FIRST FLOOR MECHANICAL PLAN",
  classification: "Mechanical plan",
  hvacScore: 9,
  confidence: 0.96,
  textLength: 2000,
  readable: true,
};

test("verifies repeated architectural scales and preserves source regions", () => {
  const region = {
    x: 40,
    y: 700,
    width: 160,
    height: 20,
    pageWidth: 792,
    pageHeight: 612,
    coordinateSpace: "viewport-points",
  };
  const analysis = fixture([mechanicalPage], [{
    id: "scale-title-block",
    category: "Notes",
    label: "Scale",
    value: "1/4 IN = 1 FT",
    page: 1,
    sheetNumber: "M1.1",
    excerpt: "FLOOR PLAN SCALE: 1/4\" = 1'-0\"",
    confidence: 0.96,
    source: "PDF text layer",
    region,
  }]);
  const extra = [{
    id: "scale-view-label",
    page: 1,
    sheetNumber: "M1.1",
    text: "MECHANICAL PLAN 1/4\" = 1'-0\"",
    confidence: 0.94,
    source: "PDF page text",
    region: {
      ...region,
      x: 400,
      y: 500,
    },
  }, {
    id: "plan-room-facts",
    page: 1,
    sheetNumber: "M1.1",
    text: "BEDROOM 3 - CEILING HEIGHT 9'-0\"\nSYSTEM 1 AHU-1 3 TON",
    confidence: 0.95,
    source: "PDF page text",
  }];

  const result = buildSmartPlanSetup(analysis, extra);

  assert.equal(result.scales[0].status, "verified");
  assert.equal(result.scales[0].selectedLabel, "1/4\" = 1'-0\"");
  assert.equal(result.scales[0].candidates[0].ratio, 48);
  assert.equal(result.scales[0].candidates[0].sources[0].region?.x, 40);
  assert.equal(result.rooms[0].name, "Bedroom 3");
  assert.equal(result.rooms[0].ceilingHeight?.minimumInches, 108);
  assert.equal(result.counts.systems, 1);
  assert.equal(result.counts.equipment, 1);
  assert.equal(result.equipment[0].tonnage, 3);
});

test("detects metric scales and metric ceiling heights", () => {
  const analysis = fixture([{
    ...mechanicalPage,
    sheetNumber: "M-101",
    title: "LEVEL 1 HVAC PLAN",
  }]);
  const result = buildSmartPlanSetup(analysis, [{
    id: "metric-plan-facts",
    page: 1,
    sheetNumber: "M-101",
    text: "SCALE 1:100\nOFFICE - CEILING HEIGHT 2700 MM\nSYSTEM A RTU-1 5 TON",
    confidence: 0.93,
  }]);

  assert.equal(result.scales[0].status, "likely");
  assert.equal(result.scales[0].selectedLabel, "1:100");
  assert.equal(result.rooms[0].ceilingHeight?.label, "2700 mm");
  assert.equal(result.rooms[0].ceilingHeight?.unit, "metric");
  assert.equal(result.equipment[0].tag, "RTU-1");
});

test("keeps NTS sheets out of distance repair and asks for calibration", () => {
  const analysis = fixture([mechanicalPage]);
  const result = buildSmartPlanSetup(analysis, [{
    id: "nts-note",
    page: 1,
    text: "MECHANICAL PLAN - NOT TO SCALE",
    confidence: 0.98,
  }]);

  assert.equal(result.scales[0].status, "likely");
  assert.equal(result.scales[0].candidates[0].kind, "not-to-scale");
  assert.equal(result.scales[0].requiresCalibration, true);
  assert.match(
    result.reviewQuestions.find((question) => question.category === "scale").prompt,
    /marked NTS/i,
  );
});

test("does not treat overlapping excerpts as two scale or height confirmations", () => {
  const sharedRegion = {
    x: 100,
    y: 100,
    width: 220,
    height: 80,
    pageWidth: 792,
    pageHeight: 612,
    coordinateSpace: "viewport-points",
  };
  const analysis = fixture([mechanicalPage]);
  const result = buildSmartPlanSetup(analysis, [{
    id: "overlap-a",
    page: 1,
    text: "PLAN SCALE 1/4\" = 1'-0\" BEDROOM 1 CEILING 9'-0\" SYSTEM 1 AHU-1 3 TON",
    confidence: 0.95,
    region: sharedRegion,
  }, {
    id: "overlap-b",
    page: 1,
    text: "SCALE 1/4\" = 1'-0\" BEDROOM 1 CEILING 9'-0\"",
    confidence: 0.94,
    region: {
      ...sharedRegion,
      x: 120,
      y: 110,
    },
  }]);

  assert.equal(result.scales[0].status, "likely");
  assert.equal(result.scales[0].candidates[0].occurrences, 1);
  assert.equal(result.rooms[0].status, "likely");
});

test("turns conflicting scales and ceiling heights into exact review questions", () => {
  const analysis = fixture([mechanicalPage]);
  const result = buildSmartPlanSetup(analysis, [{
    id: "conflict-a",
    page: 1,
    text: "FLOOR PLAN SCALE: 1/4\" = 1'-0\"\nBEDROOM 2 CEILING 9'-0\"\nSYSTEM 1 AHU-1",
    confidence: 0.94,
  }, {
    id: "conflict-b",
    page: 1,
    text: "ENLARGED PLAN SCALE: 1/2\" = 1'-0\"\nBEDROOM 2 CEILING 10'-0\"",
    confidence: 0.94,
  }]);

  assert.equal(result.scales[0].status, "missing");
  assert.equal(result.scales[0].conflict, true);
  assert.equal(result.scales[0].selectedCandidateId, null);
  assert.equal(result.rooms[0].status, "missing");
  assert.deepEqual(
    result.rooms[0].conflictingHeights.map((height) => height.minimumInches),
    [108, 120],
  );
  assert.ok(result.reviewQuestions.some((question) =>
    question.category === "scale" && /conflicting scales/i.test(question.prompt)
  ));
  assert.ok(result.reviewQuestions.some((question) =>
    question.category === "room-height" && /conflicting ceiling heights/i.test(question.prompt)
  ));
});

test("estimates only readable plan-like sheets from one consistent project scale", () => {
  const analysis = fixture([
    mechanicalPage,
    {
      ...mechanicalPage,
      page: 2,
      sheetNumber: "M1.2",
      title: "SECOND FLOOR MECHANICAL PLAN",
    },
    {
      ...mechanicalPage,
      page: 3,
      sheetNumber: "M5.1",
      title: "EQUIPMENT SCHEDULES",
      classification: "Mechanical schedule",
    },
  ]);
  const result = buildSmartPlanSetup(analysis, [{
    id: "only-scale",
    page: 1,
    text: "SCALE: 1/8\" = 1'-0\"\nSYSTEM 1 AHU-1 3 TON",
    confidence: 0.96,
  }]);

  assert.equal(result.scales[0].status, "likely");
  assert.equal(result.scales[1].status, "estimated");
  assert.deepEqual(result.scales[1].inheritedFromPages, [1]);
  assert.equal(result.scales.length, 2);
  assert.ok(result.reviewQuestions.some((question) =>
    question.page === 2 && /carried over from page 1/i.test(question.prompt)
  ));
});

test("reports only the information the solo operator still needs", () => {
  const analysis = fixture([mechanicalPage]);
  const result = buildSmartPlanSetup(analysis, [{
    id: "partial-facts",
    page: 1,
    text: "SCALE 1/4\" = 1'-0\"\nBEDROOM 1\nAHU-1",
    confidence: 0.94,
  }]);

  assert.ok(result.reviewQuestions.some((question) =>
    question.category === "room-height" && /Bedroom 1/i.test(question.title)
  ));
  assert.ok(result.reviewQuestions.some((question) =>
    question.category === "equipment" && /AHU-1/i.test(question.title)
  ));
  assert.ok(result.reviewQuestions.some((question) =>
    question.category === "system" && /system assignments/i.test(question.title)
  ));
  assert.equal(result.summary.primaryAction, "review-plan-facts");
  assert.equal(result.summary.readyForConnectionRepair, false);
  assert.match(result.summary.statusLines[0], /Scale: 1 of 1/);
});
