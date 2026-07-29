import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const renderer = await loadTypescriptModule(
  new URL("../app/fieldRedlineRenderer.ts", import.meta.url),
);

function request(pixelSize, crop) {
  return { pixelSize, crop };
}

test("reserves a footer band without covering or distorting the plan", () => {
  const layout = renderer.resolveFieldRedlineRenderLayout(
    request(
      { width: 2048, height: 1152 },
      { x: 0, y: 0, width: 1600, height: 900 },
    ),
  );
  assert.equal(layout.narrowFooter, false);
  assert.ok(layout.footer.height >= 96);
  assert.equal(layout.footer.y + layout.footer.height, 1152);
  assert.ok(layout.plan.y + layout.plan.height <= layout.footer.y);
  assert.ok(
    Math.abs(layout.plan.width / layout.plan.height - 1600 / 900) < 1e-9,
  );
});

test("uses a taller stacked footer for narrow selected-area exports", () => {
  const layout = renderer.resolveFieldRedlineRenderLayout(
    request(
      { width: 600, height: 1600 },
      { x: 200, y: 100, width: 600, height: 1600 },
    ),
  );
  assert.equal(layout.narrowFooter, true);
  assert.ok(layout.footer.height >= 138);
  assert.ok(layout.plan.y + layout.plan.height <= layout.footer.y);
  assert.ok(
    Math.abs(layout.plan.width / layout.plan.height - 600 / 1600) < 1e-9,
  );
});

test("renderer applies committed-role, transient, style, and decode contracts", async () => {
  const source = await readFile(
    new URL("../app/fieldRedlineRenderer.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /FIELD_REDLINE_EXPORT_ROLE_ATTRIBUTE/);
  assert.match(source, /FIELD_REDLINE_TRANSIENT_ROLE_ATTRIBUTE/);
  assert.match(source, /redline-canvas-committed/);
  assert.match(source, /SVG_PRESENTATION_STYLE_ALLOWLIST/);
  assert.match(source, /getComputedStyle/);
  assert.match(source, /setAttribute\("preserveAspectRatio", "none"\)/);
  assert.match(source, /await image\.decode\(\)/);
  assert.match(
    source,
    /finally\s*\{\s*URL\.revokeObjectURL\(objectUrl\);/s,
  );
  assert.match(source, /request\.includedContent\.includes\("source-plan"\)/);
});
