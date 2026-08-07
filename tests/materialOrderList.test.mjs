import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, finish, styles, materialOrder] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/FinishJobStudio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/materialOrder.ts", import.meta.url), "utf8"),
]);

test("presents one simple grouped material order list", () => {
  assert.match(page, /combined into simple order quantities/);
  assert.match(page, /className="material-order-group"/);
  assert.match(page, /View breakdown/);
  assert.match(page, /Show on plan/);
  assert.match(styles, /\.material-row-actions/);
});

test("uses one shared quantity engine for screen, print, and CSV", () => {
  assert.match(page, /return buildMaterialOrder\(\{/);
  assert.match(page, /buildMaterialOrderCsv\(rows/);
  assert.match(page, /<th>Order quantity<\/th><th>How calculated<\/th>/);
  assert.match(materialOrder, /item: group\.material === "flex" \? "Flexible duct"/);
  assert.match(finish, /<small>\{row\.size\}<\/small>/);
});

test("keeps scale uncertainty visible without blocking Materials", () => {
  assert.match(page, /DRAFT · SCALE NOT VERIFIED/);
  assert.match(page, /DRAFT — NOT FOR INSTALLATION/);
  assert.match(page, /onClick=\{exportPurchaseSheetCsv\}/);
});

test("includes a source-linked Plan-to-Truck checklist", () => {
  assert.match(page, /PLAN-TO-TRUCK CHECKLIST/);
  assert.match(page, /activeMaterialInstallChecklist\(\)\[row\.id\]/);
  assert.match(page, /showMaterialSources\(row\)/);
});
