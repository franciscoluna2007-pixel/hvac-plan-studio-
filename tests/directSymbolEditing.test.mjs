import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [page, layout, styles, readme, roadmap] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../ROADMAP.md", import.meta.url), "utf8"),
]);

test("v126 editing remains available through direct drag and Selected properties", () => {
  assert.match(page, /labelOffset\?: Point/);
  assert.match(page, /labelScale\?: number/);
  assert.match(page, /\{ kind: "symbol-label";[\s\S]*?originalOffset: Point/);
  assert.match(page, /\{ kind: "symbol-label-resize";[\s\S]*?originalScale: number/);
  assert.match(page, /function startSymbolLabelDrag\(/);
  assert.match(page, /function startSymbolLabelResize\(/);
  assert.match(page, /drag\.kind === "symbol-label"/);
  assert.match(page, /drag\.kind === "symbol-label-resize"/);
  assert.match(
    page,
    /if \(activeEditPointerIdRef\.current === event\.pointerId && !dragRef\.current\) \{\s*activeEditPointerIdRef\.current = null;/,
  );

  assert.match(page, /PLAN ICON SIZE/);
  assert.match(page, /LABEL POSITION &amp; SIZE/);
  assert.match(page, /Use Smaller or Larger for precise plan-icon sizing without covering the drawing/);
  assert.match(page, /Drag the label beside the icon/);
  assert.match(page, /import SymbolActionWheel from "\.\/PlanSymbolActionWheel"/);
  assert.match(page, /positionSymbolActionWheel\(\{/);
  assert.match(page, /<SymbolActionWheel[\s\S]*?x=\{selectedSymbolWheel\.center\.x\}[\s\S]*?y=\{selectedSymbolWheel\.center\.y\}/);
  assert.doesNotMatch(page, /className=\{`symbol-resize-handle/);
  assert.doesNotMatch(page, /className="rotation-ring"/);
  assert.match(styles, /\.symbol-action-wheel\s*\{/);
  assert.match(styles, /\.symbol-wheel-action/);
});

test("v126 gives new supply and return runs independent Fine defaults without restyling legacy work", () => {
  assert.match(
    page,
    /const \[runLineWeights, setRunLineWeights\] = useState\(\{\s*supply: 0\.1,\s*return: 0\.1\s*\}\)/,
  );
  assert.match(
    page,
    /lineWeight:\s*activeTool === "supply" \|\| activeTool === "return"\s*\?\s*runLineWeights\[activeTool\]\s*:\s*0\.2/,
  );
  assert.match(
    page,
    /setRunLineWeights\(\(current\) => \(\{ \.\.\.current, \[runType\]: lineWeight \}\)\)/,
  );
  assert.match(
    page,
    /const runType = selected\?\.type === "return"[\s\S]*?: selected\?\.type === "supply"[\s\S]*?: activeTool === "return" \? "return" : "supply";/,
  );
  assert.match(
    page,
    /function normalizedRunLineWeight\(value\?: number\) \{\s*return \[0\.1, 0\.2, 0\.3\]\.includes\(Number\(value\)\) \? Number\(value\) : 0\.2;\s*\}/,
  );
});

test("v126 applies explicit size defaults to new symbols and placement previews", () => {
  const placement = page.slice(
    page.indexOf("function placeSymbol"),
    page.indexOf("function segmentIntersection"),
  );
  assert.match(placement, /scaleX: defaultSymbolScale\(kind\)/);
  assert.match(placement, /scaleY: defaultSymbolScale\(kind\)/);
  assert.match(placement, /labelScale: defaultSymbolLabelScale\(kind\)/);

  const preview = page.slice(
    page.indexOf("{symbolPreview &&"),
    page.indexOf("{snapMarker &&"),
  );
  assert.match(preview, /scaleX: defaultSymbolScale\(symbolPreview\.kind\)/);
  assert.match(preview, /scaleY: defaultSymbolScale\(symbolPreview\.kind\)/);
  assert.match(preview, /labelScale: defaultSymbolLabelScale\(symbolPreview\.kind\)/);
});

test("v150 metadata uses one reviewed command-deck social card without legacy mock imagery", async () => {
  assert.match(layout, /\bimages\s*:/);
  assert.match(layout, /summary_large_image/);
  assert.match(layout, /\/og\.png/);
  await access(new URL("../public/og.png", import.meta.url));

  const generatedPromotionalImages = [
    "../public/og-v121.png",
    "../public/og-v122.png",
    "../public/og-v123.png",
    "../public/og-v125.png",
    "../public/hvac-plan-studio-solo-operator-social.png",
  ];
  for (const relativePath of generatedPromotionalImages) {
    await assert.rejects(
      access(new URL(relativePath, import.meta.url)),
      (error) => error?.code === "ENOENT",
      `${relativePath} legacy preview should not exist`,
    );
  }

  assert.match(readme, /v126\s+[—-]\s+Direct Symbol Editing/i);
  assert.match(readme, /Removes generated promotional mockups/i);
  assert.match(readme, /approved real product capture or remain image-free/i);

  assert.match(roadmap, /\| v126 \| Direct Symbol Editing \| Shipped \|/);
  assert.match(roadmap, /## v126\s+[—-]\s+Direct Symbol Editing/i);
  assert.match(roadmap, /Removal of generated promotional raster assets/i);
});
