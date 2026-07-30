import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const marks = await loadTypescriptModule(
  new URL("../app/redlineMark.ts", import.meta.url),
);

test("round and square mark tools reuse safe redline callout kinds", () => {
  assert.equal(marks.isRedlineMarkTool("round-mark"), true);
  assert.equal(marks.isRedlineMarkTool("square-mark"), true);
  assert.equal(marks.isRedlineMarkTool("circle"), false);
  assert.equal(marks.redlineMarkAnnotationKind("round-mark"), "circle");
  assert.equal(marks.redlineMarkAnnotationKind("square-mark"), "rectangle");
});

test("a one-tap mark uses the selected preset and stays square in screen pixels", () => {
  const bounds = marks.redlineMarkBounds({
    center: { x: 0.5, y: 0.5 },
    pointer: { x: 0.5, y: 0.5 },
    pageAspectRatio: 1.5,
    size: "large",
  });

  assert.equal(bounds.usedPreset, true);
  const pixelWidth = (bounds.end.x - bounds.start.x) * 1_200;
  const pixelHeight = (bounds.end.y - bounds.start.y) * 800;
  assert.ok(Math.abs(pixelWidth - pixelHeight) < 0.0001);
  assert.ok(pixelWidth > 90);
});

test("dragging overrides the mark preset and keeps the mark inside the PDF page", () => {
  const dragged = marks.redlineMarkBounds({
    center: { x: 0.95, y: 0.95 },
    pointer: { x: 0.75, y: 0.9 },
    pageAspectRatio: 1.25,
    size: "small",
  });

  assert.equal(dragged.usedPreset, false);
  assert.equal(dragged.end.x, 1);
  assert.equal(dragged.end.y, 1);
  assert.ok(dragged.start.x >= 0);
  assert.ok(dragged.start.y >= 0);
  const pixelWidth = (dragged.end.x - dragged.start.x) * 1_000;
  const pixelHeight = (dragged.end.y - dragged.start.y) * 800;
  assert.ok(Math.abs(pixelWidth - pixelHeight) < 0.0001);
});

test("very small drags and micro quick-click marks remain available", () => {
  const micro = marks.redlineMarkBounds({
    center: { x: 0.5, y: 0.5 },
    pointer: { x: 0.5, y: 0.5 },
    pageAspectRatio: 1,
    size: "micro",
  });
  const preciseDrag = marks.redlineMarkBounds({
    center: { x: 0.5, y: 0.5 },
    pointer: { x: 0.5005, y: 0.5005 },
    pageAspectRatio: 1,
    size: "large",
  });

  assert.equal(micro.usedPreset, true);
  assert.ok(micro.end.x - micro.start.x < 0.01);
  assert.equal(preciseDrag.usedPreset, false);
  assert.ok(preciseDrag.end.x - preciseDrag.start.x < 0.002);
});

test("solid mark styling follows the selected redline color", () => {
  const style = marks.redlineMarkStyle({
    color: "#7c3aed",
    fillColor: "#ffffff",
    strokeWidth: 0.002,
    opacity: 0.65,
  });

  assert.equal(style.color, "#7c3aed");
  assert.equal(style.fillColor, "#7c3aed");
  assert.equal(style.opacity, 0.65);
});

test("returning to an outline shape removes the solid mark fill", () => {
  const style = marks.redlineOutlineStyle({
    color: "#7c3aed",
    fillColor: "#7c3aed",
    strokeWidth: 0.002,
    opacity: 0.65,
  });

  assert.equal(style.color, "#7c3aed");
  assert.equal("fillColor" in style, false);
  assert.equal(style.opacity, 0.65);
});
