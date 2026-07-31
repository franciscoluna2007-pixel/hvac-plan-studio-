import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const lifecycle = await loadTypescriptModule(
  new URL("../app/pointerLifecycle.ts", import.meta.url),
);

test("canvas ownership stays latched for the full pointer gesture", () => {
  const owners = new Map();

  assert.equal(
    lifecycle.latchCanvasPointerOwner(owners, 11, "redline"),
    "redline",
  );
  assert.equal(
    lifecycle.canvasPointerOwner(owners, 11, "plan"),
    "redline",
    "a mid-gesture UI mode change must not reroute the pointer",
  );
  assert.equal(
    lifecycle.latchCanvasPointerOwner(owners, 11, "plan"),
    "redline",
    "a second down cannot steal an already-latched pointer",
  );
  assert.equal(lifecycle.releaseCanvasPointerOwner(owners, 11), "redline");
  assert.equal(lifecycle.canvasPointerOwner(owners, 11, "plan"), "plan");
});

test("owner cleanup is scoped and does not interrupt the other editor", () => {
  const owners = new Map([
    [1, "plan"],
    [2, "redline"],
    [3, "plan"],
  ]);

  lifecycle.releaseCanvasPointersByOwner(owners, "redline");
  assert.deepEqual([...owners.entries()], [
    [1, "plan"],
    [3, "plan"],
  ]);

  lifecycle.releaseCanvasPointersByOwner(owners, "plan");
  assert.equal(owners.size, 0);
});

test("a missed mouse or pen release self-heals on the next hover move", () => {
  assert.equal(
    lifecycle.shouldCancelStaleRedlinePointerMove({
      activePointerId: 7,
      eventPointerId: 7,
      pointerType: "mouse",
      buttons: 0,
      pressure: 0,
    }),
    true,
  );
  assert.equal(
    lifecycle.shouldCancelStaleRedlinePointerMove({
      activePointerId: 7,
      eventPointerId: 7,
      pointerType: "pen",
      buttons: 0,
      pressure: 0,
    }),
    true,
  );
});

test("valid drags and unrelated pointers are never cancelled", () => {
  for (const input of [
    {
      activePointerId: 7,
      eventPointerId: 7,
      pointerType: "mouse",
      buttons: 1,
      pressure: 0,
    },
    {
      activePointerId: 7,
      eventPointerId: 7,
      pointerType: "pen",
      buttons: 0,
      pressure: 0.4,
    },
    {
      activePointerId: 7,
      eventPointerId: 7,
      pointerType: "touch",
      buttons: 0,
      pressure: 0,
    },
    {
      activePointerId: 7,
      eventPointerId: 8,
      pointerType: "mouse",
      buttons: 0,
      pressure: 0,
    },
  ]) {
    assert.equal(
      lifecycle.shouldCancelStaleRedlinePointerMove(input),
      false,
    );
  }
});

test("a missed plan release completes instead of rolling placed work back", () => {
  for (const pointerType of ["mouse", "pen"]) {
    assert.equal(
      lifecycle.shouldCompleteStalePlanPointerMove({
        activeEditPointerId: 12,
        eventPointerId: 12,
        pointerType,
        buttons: 0,
        pressure: 0,
      }),
      true,
    );
  }
});

test("active, touch, and unrelated plan pointers are never auto-completed", () => {
  for (const input of [
    {
      activeEditPointerId: 12,
      eventPointerId: 12,
      pointerType: "mouse",
      buttons: 1,
      pressure: 0,
    },
    {
      activeEditPointerId: 12,
      eventPointerId: 12,
      pointerType: "pen",
      buttons: 0,
      pressure: 0.4,
    },
    {
      activeEditPointerId: 12,
      eventPointerId: 12,
      pointerType: "touch",
      buttons: 0,
      pressure: 0,
    },
    {
      activeEditPointerId: 12,
      eventPointerId: 13,
      pointerType: "mouse",
      buttons: 0,
      pressure: 0,
    },
  ]) {
    assert.equal(
      lifecycle.shouldCompleteStalePlanPointerMove(input),
      false,
    );
  }
});
