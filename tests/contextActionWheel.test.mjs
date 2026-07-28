import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const [
  {
    PLAN_CONTEXT_WHEEL_ACTION_IDS,
    contextWheelActionPosition,
    nextContextWheelActionIndex,
    planContextWheelCaption,
  },
  component,
] = await Promise.all([
  loadTypescriptModule(new URL("../app/contextActionWheel.ts", import.meta.url)),
  readFile(new URL("../app/PlanSymbolActionWheel.tsx", import.meta.url), "utf8"),
]);

test("uses object-specific captions and action contracts", () => {
  assert.equal(planContextWheelCaption("icon"), "ICON");
  assert.equal(planContextWheelCaption("run"), "RUN");
  assert.equal(planContextWheelCaption("fitting"), "FITTING");

  assert.deepEqual(
    [...PLAN_CONTEXT_WHEEL_ACTION_IDS.run],
    [
      "label-smaller",
      "label-larger",
      "label-reset",
      "extend-b",
      "split",
      "extend-a",
      "delete",
      "close",
    ],
  );
  assert.ok(!PLAN_CONTEXT_WHEEL_ACTION_IDS.fitting.includes("mirror"));
  assert.ok(!PLAN_CONTEXT_WHEEL_ACTION_IDS.fitting.includes("duplicate"));
  assert.deepEqual(
    [...PLAN_CONTEXT_WHEEL_ACTION_IDS.fitting],
    ["inspect-connections", "edit-properties", "delete", "close"],
  );
});

test("supports circular arrow navigation plus Home and End", () => {
  assert.equal(nextContextWheelActionIndex(-1, "ArrowRight", 8), 0);
  assert.equal(nextContextWheelActionIndex(-1, "ArrowLeft", 8), 7);
  assert.equal(nextContextWheelActionIndex(7, "ArrowDown", 8), 0);
  assert.equal(nextContextWheelActionIndex(0, "ArrowUp", 8), 7);
  assert.equal(nextContextWheelActionIndex(4, "Home", 8), 0);
  assert.equal(nextContextWheelActionIndex(4, "End", 8), 7);
  assert.equal(nextContextWheelActionIndex(4, "Enter", 8), null);
  assert.equal(nextContextWheelActionIndex(0, "ArrowRight", 0), null);
});

test("places perimeter actions on the ring and rejects invalid slots", () => {
  const positions = Array.from({ length: 7 }, (_, index) =>
    contextWheelActionPosition(index, 7)
  );
  assert.equal(new Set(positions.map(({ left, top }) => `${left}:${top}`)).size, 7);
  for (const position of positions) {
    assert.ok(position.left >= 14 && position.left <= 86);
    assert.ok(position.top >= 14 && position.top <= 86);
  }
  assert.deepEqual(contextWheelActionPosition(-1, 7), { left: 50, top: 50 });
  assert.deepEqual(contextWheelActionPosition(7, 7), { left: 50, top: 50 });
});

test("renders a roving accessible toolbar and keeps the legacy icon API", () => {
  assert.match(component, /variant\?: "icon"/);
  assert.match(component, /variant: "run"/);
  assert.match(component, /variant: "fitting"/);
  assert.match(component, /role="toolbar"/);
  assert.match(component, /aria-label=\{`\$\{caption\} actions for \$\{props\.label\}`\}/);
  assert.match(component, /tabIndex=\{safeFocusIndex === index \? 0 : -1\}/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /onInspectConnections: \(\) => void/);
  assert.match(component, /onEditProperties: \(\) => void/);
  assert.match(component, /splitActive: boolean/);
  assert.match(component, /aria-pressed=\{pressed\}/);
});
