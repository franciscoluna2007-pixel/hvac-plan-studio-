import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("selection-box preview renders without replacing the PDF workspace", async () => {
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true },
  });

  try {
    const { default: RedlineCanvasLayer } = await vite.ssrLoadModule(
      "/app/RedlineCanvasLayer.tsx",
    );
    const binding = {
      sourceFingerprint: "pdf-source-1",
      page: 1,
      pageCount: 1,
    };
    const markup = renderToStaticMarkup(
      RedlineCanvasLayer({
        binding,
        width: 1_200,
        height: 800,
        zoom: 1,
        interactive: true,
        layer: {
          id: "field-redlines",
          name: "Field redlines",
          visible: true,
          locked: false,
          opacity: 1,
          order: 0,
        },
        annotations: [],
        transient: {
          kind: "selection-box",
          start: { x: 0.1, y: 0.2 },
          end: { x: 0.4, y: 0.6 },
        },
      }),
    );

    assert.match(markup, /redline-transient-selection-box/);
    assert.match(markup, /x="114"/);
    assert.match(markup, /y="154"/);
    assert.match(markup, /width="372"/);
    assert.match(markup, /height="332"/);

    const eraserMarkup = renderToStaticMarkup(
      RedlineCanvasLayer({
        binding,
        width: 1_200,
        height: 800,
        zoom: 1,
        interactive: true,
        layer: {
          id: "field-redlines",
          name: "Field redlines",
          visible: true,
          locked: false,
          opacity: 0.1,
          order: 0,
        },
        annotations: [],
        transient: {
          kind: "eraser",
          point: { x: 0.5, y: 0.25 },
          size: 0.08,
        },
      }),
    );
    assert.match(eraserMarkup, /redline-transient-eraser/);
    assert.match(
      eraserMarkup,
      /redline-canvas-committed"[^>]*opacity="0\.1"/,
    );
    assert.match(eraserMarkup, /data-field-redline-transient-role="active-cursors"/);
    assert.match(eraserMarkup, /cx="600"/);
    assert.match(eraserMarkup, /cy="200"/);
    assert.match(eraserMarkup, /r="32"/);
    assert.match(eraserMarkup, /aria-hidden="true"/);

    const textMarkup = renderToStaticMarkup(
      RedlineCanvasLayer({
        binding,
        width: 1_200,
        height: 800,
        zoom: 1,
        interactive: true,
        layer: {
          id: "field-redlines",
          name: "Field redlines",
          visible: true,
          locked: false,
          opacity: 1,
          order: 0,
        },
        annotations: [{
          id: "text-1",
          kind: "text",
          layerId: "field-redlines",
          binding,
          style: {
            color: "#dc2626",
            strokeWidth: 0.002,
            opacity: 1,
            textScale: 1,
          },
          start: { x: 0.2, y: 0.3 },
          end: { x: 0.4, y: 0.4 },
          text: "MOVE AND RESIZE",
        }],
        selection: {
          annotationIds: ["text-1"],
        },
        onTextResizePointerDown() {},
      }),
    );

    assert.match(textMarkup, /redline-selection-overlay/);
    assert.match(textMarkup, /redline-selection-resize-handle/);
    assert.match(textMarkup, /redline-selection-resize-hit/);
    assert.match(textMarkup, /data-plan-edit-control="redline"/);

    const solidStyle = {
      color: "#0ea5e9",
      fillColor: "#0ea5e9",
      strokeWidth: 0.002,
      opacity: 1,
    };
    const outlineStyle = {
      color: "#dc2626",
      strokeWidth: 0.002,
      opacity: 1,
    };
    const shapeMarkup = renderToStaticMarkup(
      RedlineCanvasLayer({
        binding,
        width: 1_200,
        height: 800,
        zoom: 2,
        interactive: false,
        layer: {
          id: "field-redlines",
          name: "Field redlines",
          visible: true,
          locked: false,
          opacity: 1,
          order: 0,
        },
        annotations: [{
          id: "solid-square",
          kind: "rectangle",
          layerId: "field-redlines",
          binding,
          style: solidStyle,
          start: { x: 0.1, y: 0.1 },
          end: { x: 0.2, y: 0.2 },
        }, {
          id: "outline-circle",
          kind: "circle",
          layerId: "field-redlines",
          binding,
          style: outlineStyle,
          start: { x: 0.3, y: 0.1 },
          end: { x: 0.4, y: 0.2 },
        }, {
          id: "square-pen",
          kind: "ink",
          brushTip: "square",
          layerId: "field-redlines",
          binding,
          style: {
            color: "#dc2626",
            strokeWidth: 0.02,
            opacity: 1,
          },
          points: [{ x: 0.1, y: 0.5 }, { x: 0.2, y: 0.5 }],
        }, {
          id: "circle-pen",
          kind: "ink",
          brushTip: "circle",
          layerId: "field-redlines",
          binding,
          style: {
            color: "#2563eb",
            strokeWidth: 0.02,
            opacity: 1,
          },
          points: [{ x: 0.3, y: 0.5 }],
        }],
        transient: {
          kind: "annotations",
          annotations: [{
            id: "solid-circle-preview",
            kind: "circle",
            layerId: "field-redlines",
            binding,
            style: solidStyle,
            start: { x: 0.5, y: 0.1 },
            end: { x: 0.6, y: 0.2 },
          }, {
            id: "outline-square-preview",
            kind: "rectangle",
            layerId: "field-redlines",
            binding,
            style: outlineStyle,
            start: { x: 0.7, y: 0.1 },
            end: { x: 0.8, y: 0.2 },
          }],
        },
      }),
    );
    assert.match(
      shapeMarkup,
      /redline-rectangle[\s\S]*?<rect[^>]*fill="#0ea5e9"/,
    );
    assert.match(
      shapeMarkup,
      /redline-circle[\s\S]*?<ellipse[^>]*fill="none"/,
    );
    assert.match(
      shapeMarkup,
      /redline-transient-copy[\s\S]*?<ellipse[^>]*fill="#0ea5e9"[\s\S]*?<rect[^>]*fill="none"/,
    );
    assert.match(shapeMarkup, /aria-label="Square pen redline"/);
    assert.match(
      shapeMarkup,
      /stroke="#dc2626" stroke-width="16" stroke-linecap="square" stroke-linejoin="round" stroke-dasharray="0 8\.8"/,
    );
    assert.match(
      shapeMarkup,
      /<rect x="112" y="392" width="16" height="16" fill="#dc2626"/,
    );
    assert.match(shapeMarkup, /aria-label="Circle pen redline"/);
    assert.match(
      shapeMarkup,
      /<circle cx="360" cy="400" r="8" fill="#2563eb"/,
    );
  } finally {
    await vite.close();
  }
});
