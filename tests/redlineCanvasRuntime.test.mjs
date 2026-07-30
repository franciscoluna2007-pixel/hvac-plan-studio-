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
  } finally {
    await vite.close();
  }
});
