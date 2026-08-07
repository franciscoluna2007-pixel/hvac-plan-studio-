import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/materialOrder.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const commonJsModule = { exports: {} };
vm.runInNewContext(compiled, { module: commonJsModule, exports: commonJsModule.exports, Set, Map, Math });
const { buildMaterialOrder, buildMaterialOrderCsv } = commonJsModule.exports;

test("combines same-size supply and return flex before rounding boxes", () => {
  const rows = buildMaterialOrder({
    runs: [
      { id: "supply-1", type: "supply", size: "14", lengthFeet: 26.7 },
      { id: "return-1", type: "return", size: "14", lengthFeet: 26.7 },
    ],
    symbols: [],
    fittings: [],
    allowancePercent: 10,
  });
  const flex = rows.find((row) => row.item === "Flexible duct");
  assert.equal(flex.orderCount, 3);
  assert.equal(flex.measuredLengthFeet, 53.4);
  assert.deepEqual([...flex.sourceDrawingIds], ["supply-1", "return-1"]);
});

test("keeps fresh-air duct separate from flexible supply and return", () => {
  const rows = buildMaterialOrder({
    runs: [
      { id: "supply-1", type: "supply", size: "8", lengthFeet: 10 },
      { id: "fresh-1", type: "fresh", size: "8", lengthFeet: 10 },
    ],
    symbols: [],
    fittings: [],
    allowancePercent: 0,
  });
  assert.equal(rows.filter((row) => row.category === "Duct").length, 2);
});

test("groups rigid duct by construction and size without merging round metal with spiral", () => {
  const rows = buildMaterialOrder({
    runs: [], symbols: [], fittings: [], allowancePercent: 10, rigidStockLengthFeet: 5,
    rigidRuns: [
      { id: "rect-a", networkKind: "supply", construction: "rectangular", size: "24×12", lengthFeet: 12 },
      { id: "rect-b", networkKind: "return", construction: "rectangular", size: "24×12", lengthFeet: 8 },
      { id: "round-a", networkKind: "supply", construction: "round-metal", size: "10", lengthFeet: 10 },
      { id: "spiral-a", networkKind: "supply", construction: "spiral", size: "10", lengthFeet: 10 },
    ],
  });
  const rigid = rows.filter((row) => row.id.startsWith("rigid:"));
  assert.equal(rigid.length, 3);
  const rectangular = rigid.find((row) => row.item === "Rectangular sheet-metal duct");
  assert.equal(rectangular.measuredLengthFeet, 20);
  assert.equal(rectangular.orderCount, 5);
  assert.deepEqual([...rectangular.sourceDrawingIds], ["rect-a", "rect-b"]);
  assert.ok(rigid.some((row) => row.item === "Round metal pipe"));
  assert.ok(rigid.some((row) => row.item === "Spiral pipe"));
});

test("does not infer rigid length or stock quantity from an unverified sheet", () => {
  const rows = buildMaterialOrder({
    runs: [], symbols: [], fittings: [], allowancePercent: 10,
    rigidRuns: [{ id: "rect-a", networkKind: "supply", construction: "rectangular", size: "24×12", lengthFeet: null }],
  });
  assert.equal(rows[0].quantity, "Scale required");
  assert.equal(rows[0].orderCount, 0);
  assert.match(rows[0].breakdown, /no length or stock quantity inferred/);
});

test("blocks rigid stock ordering until connected fitting takeouts are explicit", () => {
  const rows = buildMaterialOrder({
    runs: [], symbols: [], fittings: [], allowancePercent: 10,
    rigidRuns: [{ id: "rect-a", networkKind: "supply", construction: "rectangular", size: "24×12", lengthFeet: null, lengthStatus: "takeout-required" }],
  });
  assert.equal(rows[0].quantity, "Takeout required");
  assert.equal(rows[0].orderCount, 0);
  assert.match(rows[0].breakdown, /finished length blocked/);
});

test("counts explicit rigid elbows separately by angle, construction, size, and style", () => {
  const rows = buildMaterialOrder({
    runs: [], rigidRuns: [], symbols: [], fittings: [], allowancePercent: 10,
    rigidFittings: [
      { id: "elbow-a", networkKind: "supply", construction: "rectangular", size: "24×12", angleDegrees: 90, rectangularStyle: "radius" },
      { id: "elbow-b", networkKind: "return", construction: "rectangular", size: "24×12", angleDegrees: 90, rectangularStyle: "radius" },
      { id: "elbow-c", networkKind: "supply", construction: "rectangular", size: "24×12", angleDegrees: 90, rectangularStyle: "square" },
      { id: "elbow-d", networkKind: "supply", construction: "round-metal", size: "10", angleDegrees: 45 },
    ],
  });
  const elbows = rows.filter((row) => row.id.startsWith("rigid-fitting:"));
  assert.equal(elbows.length, 3);
  assert.equal(elbows.find((row) => row.item.includes("radius"))?.orderCount, 2);
  assert.deepEqual([...(elbows.find((row) => row.item.includes("radius"))?.sourceDrawingIds || [])], ["elbow-a", "elbow-b"]);
});

test("does not double-count symbols that are already cans or boots", () => {
  const rows = buildMaterialOrder({
    runs: [],
    symbols: [
      { id: "can", kind: "diffuser", label: "SQUARE SUPPLY CAN", size: "12×12", neckSize: "8", variant: "supply-can" },
      { id: "boot", kind: "diffuser", label: "REGISTER BOOT", size: "12×4", neckSize: "6", variant: "boot" },
      { id: "return-can", kind: "returnGrille", label: "RECTANGULAR RETURN CAN", size: "20×12", neckSize: "12", variant: "return-can" },
    ],
    fittings: [],
    allowancePercent: 10,
  });
  assert.equal(rows.filter((row) => row.item.includes("can / ") || row.item.includes("plenum box")).length, 0);
});

test("distinguishes 45 degree wyes from 90 degree tees", () => {
  const rows = buildMaterialOrder({
    runs: [], symbols: [], allowancePercent: 10,
    fittings: [
      { id: "wye", style: "wye45", upstreamSize: "14", downstreamSize: "12", branchSize: "12" },
      { id: "tee", style: "tee90", upstreamSize: "14", downstreamSize: "12", branchSize: "12" },
    ],
  });
  assert.deepEqual(Array.from(rows, (row) => row.item).sort(), ["T Branch · 45° wye", "T Branch · 90° tee"]);
});

test("emits one Excel-friendly UTF-8 CSV table", () => {
  const rows = buildMaterialOrder({
    runs: [{ id: "supply-1", type: "supply", size: "14", lengthFeet: 26.7 }],
    symbols: [], fittings: [], allowancePercent: 10,
  });
  const csv = buildMaterialOrderCsv(rows, { project: "Test", system: "System 1", status: "DRAFT", scale: "Verified" });
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"Measured LF","Allowance %","Order LF","Package","Source objects"/);
  assert.doesNotMatch(csv, /Breakdown \(reference only\)/);
});
