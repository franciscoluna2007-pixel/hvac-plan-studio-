import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const { planFocusTarget } = await loadTypescriptModule(
  new URL("../app/planFocus.ts", import.meta.url),
);

const viewport = {
  left: 200,
  top: 80,
  right: 1400,
  bottom: 880,
  width: 1200,
  height: 800,
};

test("centers Show where in the uncovered canvas beside Plan Helper", () => {
  const target = planFocusTarget(viewport, {
    left: 800,
    top: 80,
    right: 1400,
    bottom: 880,
    width: 600,
    height: 800,
  });

  assert.deepEqual(target, {
    x: 300,
    y: 400,
    mode: "visible-region",
  });
});

test("falls back to the full viewport when Plan Helper covers nearly all canvas", () => {
  const target = planFocusTarget(viewport, {
    left: 220,
    top: 80,
    right: 1400,
    bottom: 880,
    width: 1180,
    height: 800,
  });

  assert.deepEqual(target, {
    x: 600,
    y: 400,
    mode: "close-occluder",
  });
});

test("uses the full viewport when there is no helper", () => {
  assert.deepEqual(planFocusTarget(viewport, null), {
    x: 600,
    y: 400,
    mode: "full-viewport",
  });
});

test("keeps a non-overlapping helper open", () => {
  assert.deepEqual(planFocusTarget(viewport, {
    left: 1450,
    top: 80,
    right: 1900,
    bottom: 880,
    width: 450,
    height: 800,
  }), {
    x: 600,
    y: 400,
    mode: "full-viewport",
  });
});
