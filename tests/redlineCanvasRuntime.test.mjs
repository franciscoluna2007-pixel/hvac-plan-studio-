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
  } finally {
    await vite.close();
  }
});
