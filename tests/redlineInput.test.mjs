import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescriptModule } from "./load-typescript-module.mjs";

const input = await loadTypescriptModule(
  new URL("../app/redlineInput.ts", import.meta.url),
);

const {
  createRedlineStrokeDraft,
  normalizeCoalescedRedlineSamples,
  normalizeRedlinePointerSample,
  redlinePointerCanDraw,
  simplifyRedlineStroke,
} = input;

const viewport = {
  left: 100,
  top: 50,
  width: 800,
  height: 600,
};

test("normalizes pointer input to deterministic 0-1 PDF page coordinates", () => {
  assert.deepEqual(normalizeRedlinePointerSample({
    clientX: 500,
    clientY: 350,
    pressure: 1.5,
    timeStamp: -4,
    pointerId: 9,
    pointerType: "pen",
  }, viewport), {
    x: 0.5,
    y: 0.5,
    pressure: 1,
    t: 0,
    pointerId: 9,
    pointerType: "pen",
  });
  assert.deepEqual(normalizeRedlinePointerSample({
    clientX: 0,
    clientY: 900,
    pressure: 0,
    buttons: 1,
    pointerType: "mouse",
  }, viewport), {
    x: 0,
    y: 1,
    pressure: 0.5,
    t: 0,
    pointerId: 0,
    pointerType: "mouse",
  });
  assert.equal(normalizeRedlinePointerSample({
    clientX: 10,
    clientY: 10,
  }, { ...viewport, width: 0 }), null);
});

test("collects, sorts, deduplicates, and appends coalesced pointer samples", () => {
  const event = {
    clientX: 500,
    clientY: 350,
    pressure: 0.8,
    timeStamp: 30,
    pointerId: 7,
    pointerType: "pen",
    getCoalescedEvents: () => [
      {
        clientX: 340,
        clientY: 230,
        pressure: 0.4,
        timeStamp: 20,
      },
      {
        clientX: 180,
        clientY: 110,
        pressure: 0.2,
        timeStamp: 10,
      },
      {
        clientX: 180,
        clientY: 110,
        pressure: 0.2,
        timeStamp: 10,
      },
    ],
  };
  const samples = normalizeCoalescedRedlineSamples(event, viewport);
  assert.deepEqual(samples.map(({ x, y, t }) => ({ x, y, t })), [
    { x: 0.1, y: 0.1, t: 10 },
    { x: 0.3, y: 0.3, t: 20 },
    { x: 0.5, y: 0.5, t: 30 },
  ]);
  assert.ok(samples.every((sample) =>
    sample.pointerId === 7 && sample.pointerType === "pen"));
  assert.deepEqual(
    normalizeCoalescedRedlineSamples(event, viewport, samples.at(-1))
      .map((sample) => sample.t),
    [],
  );
});

test("coalesced input cap preserves the current pointer endpoint", () => {
  const samples = normalizeCoalescedRedlineSamples({
    clientX: 900,
    clientY: 650,
    pressure: 0.7,
    timeStamp: 301,
    pointerId: 4,
    pointerType: "pen",
    getCoalescedEvents: () => Array.from({ length: 300 }, (_, index) => ({
      clientX: 100 + index,
      clientY: 50 + index,
      pressure: 0.5,
      timeStamp: index + 1,
    })),
  }, viewport);
  assert.equal(samples.length, 256);
  assert.equal(samples.at(-1).t, 301);
  assert.deepEqual(
    { x: samples.at(-1).x, y: samples.at(-1).y },
    { x: 1, y: 1 },
  );
});

test("keeps spatially distinct browser samples that share a timestamp", () => {
  const previous = {
    x: 0.1,
    y: 0.1,
    pressure: 0.5,
    t: 20,
    pointerId: 7,
    pointerType: "pen",
  };
  const samples = normalizeCoalescedRedlineSamples({
    clientX: 340,
    clientY: 230,
    pressure: 0.5,
    timeStamp: 20,
    pointerId: 7,
    pointerType: "pen",
    getCoalescedEvents: () => [
      {
        clientX: 260,
        clientY: 170,
        pressure: 0.5,
        timeStamp: 20,
      },
      {
        clientX: 340,
        clientY: 230,
        pressure: 0.5,
        timeStamp: 20,
      },
    ],
  }, viewport, previous);

  assert.deepEqual(
    samples.map(({ x, y, t }) => ({ x, y, t })),
    [
      { x: 0.2, y: 0.2, t: 20 },
      { x: 0.3, y: 0.3, t: 20 },
    ],
  );
});

test("rejects non-primary, secondary-button, touch, and pen-palm input", () => {
  assert.equal(redlinePointerCanDraw({
    pointerType: "pen",
    button: 0,
    isPrimary: true,
  }), true);
  assert.equal(redlinePointerCanDraw({
    pointerType: "mouse",
    button: 2,
    isPrimary: true,
  }), false);
  assert.equal(redlinePointerCanDraw({
    pointerType: "touch",
    button: 0,
    isPrimary: true,
  }), false);
  assert.equal(redlinePointerCanDraw({
    pointerType: "touch",
    button: 0,
    isPrimary: true,
  }, {
    allowTouch: true,
    activePointerType: "pen",
  }), false);
  assert.equal(redlinePointerCanDraw({
    pointerType: "touch",
    button: 0,
    isPrimary: true,
  }, {
    allowTouch: true,
  }), true);
});

test("simplifies strokes deterministically while preserving endpoints and pressure", () => {
  const straight = Array.from({ length: 101 }, (_, index) => ({
    x: index / 100,
    y: index / 100,
    pressure: 0.5,
    t: index,
  }));
  const first = simplifyRedlineStroke(straight, 0.001);
  const second = simplifyRedlineStroke(straight, 0.001);
  assert.deepEqual(first, second);
  assert.deepEqual(first, [straight[0], straight.at(-1)]);

  const pressureChange = simplifyRedlineStroke([
    { x: 0, y: 0, pressure: 0.1 },
    { x: 0.5, y: 0.5, pressure: 1 },
    { x: 1, y: 1, pressure: 0.1 },
  ], {
    tolerance: 0.01,
    pressureTolerance: 0.05,
  });
  assert.equal(pressureChange.length, 3);

  const capped = simplifyRedlineStroke(
    Array.from({ length: 40 }, (_, index) => ({
      x: index / 39,
      y: index % 2 ? 1 : 0,
    })),
    { tolerance: 0.00001, maxPoints: 8 },
  );
  assert.equal(capped.length, 8);
  assert.deepEqual(capped[0], { x: 0, y: 0 });
  assert.deepEqual(capped.at(-1), { x: 1, y: 1 });
});

test("builds an ink/highlighter draft without retaining pointer identity", () => {
  const draft = createRedlineStrokeDraft({
    kind: "highlighter",
    page: 2,
    samples: [
      {
        x: 0.1,
        y: 0.2,
        pressure: 0.4,
        t: 1,
        pointerId: 3,
        pointerType: "pen",
      },
      {
        x: 0.8,
        y: 0.7,
        pressure: 0.6,
        t: 2,
        pointerId: 3,
        pointerType: "pen",
      },
    ],
  });
  assert.equal(draft.kind, "highlighter");
  assert.equal(draft.page, 2);
  assert.equal("pointerId" in draft.points[0], false);
  assert.equal(createRedlineStrokeDraft({
    kind: "ink",
    page: 0,
    samples: [],
  }), null);

  const shapePen = createRedlineStrokeDraft({
    kind: "ink",
    brushTip: "circle",
    page: 1,
    samples: [{
      x: 0.25,
      y: 0.4,
      pointerId: 8,
      pointerType: "pen",
    }],
  });
  assert.equal(shapePen.brushTip, "circle");
  assert.equal(shapePen.points.length, 1);

  const highlighter = createRedlineStrokeDraft({
    kind: "highlighter",
    brushTip: "square",
    page: 1,
    samples: [{
      x: 0.2,
      y: 0.3,
      pointerId: 8,
      pointerType: "pen",
    }],
  });
  assert.equal("brushTip" in highlighter, false);
});
