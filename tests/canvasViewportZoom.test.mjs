import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescriptModule } from "./load-typescript-module.mjs";

const zoom = await loadTypescriptModule(
  new URL("../app/canvasViewportZoom.ts", import.meta.url),
);

test("mouse wheel zoom remains smooth and centered on the cursor", () => {
  const factor = zoom.wheelZoomFactor({ deltaY: -120, deltaMode: 0, ctrlKey: false });
  assert.ok(factor > 1 && factor < 1.3);
  const currentZoom = 1;
  const nextZoom = currentZoom * factor;
  const camera = { x: 40, y: 30 };
  const cursor = { x: 300, y: 220 };
  const before = {
    x: (cursor.x - camera.x) / currentZoom,
    y: (cursor.y - camera.y) / currentZoom,
  };
  const nextCamera = zoom.cameraForCursorZoom({ camera, cursor, currentZoom, nextZoom });
  const after = {
    x: (cursor.x - nextCamera.x) / nextZoom,
    y: (cursor.y - nextCamera.y) / nextZoom,
  };
  assert.ok(Math.abs(before.x - after.x) < 1e-9);
  assert.ok(Math.abs(before.y - after.y) < 1e-9);
});

test("line-mode wheel deltas use the same cursor-centered zoom path", () => {
  assert.ok(
    zoom.wheelZoomFactor({ deltaY: 3, deltaMode: 1, ctrlKey: false }) < 1,
  );
});

test("page-mode and horizontal-routed wheel deltas remain visible across browsers", () => {
  assert.ok(
    zoom.wheelZoomFactor({
      deltaY: 1,
      deltaMode: 2,
      ctrlKey: false,
      viewportHeight: 700,
    }) < 0.9,
  );
  assert.ok(
    zoom.wheelZoomFactor({
      deltaX: -120,
      deltaY: 0,
      deltaMode: 0,
      ctrlKey: false,
    }) > 1,
  );
});
