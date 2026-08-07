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
