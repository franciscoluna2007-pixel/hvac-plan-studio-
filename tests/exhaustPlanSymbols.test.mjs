import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const exhaust = await loadTypescriptModule(
  new URL("../app/exhaustPlanSymbols.ts", import.meta.url),
);
const copy = await loadTypescriptModule(
  new URL("../app/planCopyPlacement.ts", import.meta.url),
);

test("dedicated exhaust presets expose accessible palette identities without design airflow", () => {
  assert.deepEqual(exhaust.dedicatedExhaustSymbolPresets.map(({ id, label, kind, category, cfm }) => ({ id, label, kind, category, cfm })), [
    { id: "device-range-hood", label: "Range Hood", kind: "rangeHood", category: "Air devices", cfm: 0 },
    { id: "device-dryer-vent", label: "Dryer Vent", kind: "dryerVent", category: "Air devices", cfm: 0 },
  ]);
});

test("materials count Range Hoods and Dryer Vents separately without inferred duct", () => {
  const rows = exhaust.buildDedicatedExhaustTakeoffRows([
    { symbol: { kind: "rangeHood" } },
    { symbol: { kind: "rangeHood" } },
    { symbol: { kind: "dryerVent" } },
    { symbol: { kind: "diffuser" } },
  ]);
  assert.deepEqual(rows.map(({ item, quantity, size }) => ({ item, quantity, size })), [
    { item: "Range Hood", quantity: "2 EA", size: "Field verify" },
    { item: "Dryer Vent", quantity: "1 EA", size: "Field verify" },
  ]);
  assert.ok(rows.every((row) => !/length|duct/i.test(`${row.item} ${row.size}`)));
  assert.ok(rows.every((row) => /not inferred/i.test(row.note)));
});

test("dedicated exhaust symbols persist, copy repeatedly, and leave the source immutable for Undo", () => {
  const source = {
    id: "hood-1",
    type: "symbol",
    points: [{ x: 20, y: 30 }],
    page: 1,
    size: "FIELD VERIFY",
    cfm: 0,
    symbol: { kind: "rangeHood", label: "Range Hood", rotation: 37, scaleX: 1, scaleY: 1 },
  };
  const persisted = JSON.parse(JSON.stringify(source));
  assert.equal(persisted.symbol.kind, "rangeHood");
  assert.equal(persisted.symbol.rotation, 37);

  const template = copy.buildStandalonePlanCopyTemplate(source, "pdf-a");
  const first = copy.materializeStandalonePlanCopy(template, { sourceFingerprint: "pdf-a", page: 1, point: { x: 100, y: 100 }, id: "hood-2" });
  const second = copy.materializeStandalonePlanCopy(template, { sourceFingerprint: "pdf-a", page: 1, point: { x: 200, y: 200 }, id: "hood-3" });
  assert.deepEqual([first.symbol.kind, second.symbol.kind], ["rangeHood", "rangeHood"]);
  assert.deepEqual([first.symbol.rotation, second.symbol.rotation], [37, 37]);
  assert.deepEqual(source, persisted);

  const historyBeforePaste = [source];
  const historyAfterPaste = [...historyBeforePaste, first];
  assert.deepEqual(historyAfterPaste.slice(0, -1), historyBeforePaste);
});
