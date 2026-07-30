import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const labels = await loadTypescriptModule(
  new URL("../app/terminalPlanLabel.ts", import.meta.url),
);

test("catalog supply and return labels render as size only", () => {
  assert.equal(
    labels.compactTerminalPlanLabel({
      kind: "diffuser",
      size: "12×12",
      label: "4-WAY SUPPLY",
      usesCatalogLabel: true,
    }),
    "12×12",
  );
  assert.equal(
    labels.compactTerminalPlanLabel({
      kind: "returnGrille",
      size: "14×14",
      label: "RETURN GRILLE",
      usesCatalogLabel: true,
    }),
    "14×14",
  );
});

test("existing automatic labels lose only the redundant airflow word", () => {
  assert.equal(
    labels.compactTerminalPlanLabel({
      kind: "diffuser",
      size: "12x12",
      label: "12x12 SUPPLY",
    }),
    "12×12",
  );
  assert.equal(
    labels.compactTerminalPlanLabel({
      kind: "returnGrille",
      size: "20×12",
      label: "20×12 RETURN",
    }),
    "20×12",
  );
  assert.equal(
    labels.compactTerminalPlanLabel({
      kind: "diffuser",
      size: "12 x 12",
      label: "12 x 12 SUPPLY",
    }),
    "12×12",
  );
});

test("custom plan labels and non-terminal labels remain unchanged", () => {
  assert.equal(
    labels.compactTerminalPlanLabel({
      kind: "diffuser",
      size: "12×12",
      label: "PRIMARY BED",
    }),
    "PRIMARY BED",
  );
  assert.equal(
    labels.compactTerminalPlanLabel({
      kind: "equipment",
      size: "3 TON",
      label: "SYSTEM 1 · 3 TON AHU",
    }),
    "SYSTEM 1 · 3 TON AHU",
  );
  assert.equal(
    labels.compactTerminalPlanLabel({
      kind: "diffuser",
      size: "12×12",
      label: "NEXT TO DOOR",
    }),
    "NEXT TO DOOR",
  );
});
