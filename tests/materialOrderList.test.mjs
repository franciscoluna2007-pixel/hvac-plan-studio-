import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, finish, styles] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/FinishJobStudio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("presents one simple grouped material order list", () => {
  assert.match(page, /combined into simple order quantities/);
  assert.match(page, /categoryOrder = new Map\(\["Duct", "Fittings", "Air devices", "Equipment", "Accessories"\]/);
  assert.match(page, /className="material-order-group"/);
  assert.match(page, /View breakdown/);
  assert.doesNotMatch(page, /V106 · PLAN INTELLIGENCE/);
  assert.doesNotMatch(page, /DO NOT FABRICATE YET/);
});

test("uses purchase quantities on screen, in Finish, print, and CSV", () => {
  assert.match(page, /quantity: `\$\{rolls\} × 25-ft/);
  assert.match(page, /item: "T Branch", size: size\.split\("×"\).*quantity: `\$\{count\} each`/s);
  assert.match(page, /\["Category", "Item", "Size", "Order quantity"\]/);
  assert.match(page, /<th>Order quantity<\/th>/);
  assert.match(finish, /<small>\{row\.size\}<\/small>/);
  assert.match(styles, /\.material-order-list/);
});

test("keeps coordination findings advisory while materials and exports stay available", () => {
  assert.match(page, /Materials and exports remain available\./);
  assert.match(page, /className="material-advisory"/);
  assert.match(page, /onClick=\{exportPurchaseSheetCsv\}/);
});
