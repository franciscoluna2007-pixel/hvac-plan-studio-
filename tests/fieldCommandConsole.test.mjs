import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, layout, styles, design, sidecarSource] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../DESIGN.md", import.meta.url), "utf8"),
  readFile(new URL("../.impeccable/design.json", import.meta.url), "utf8"),
]);

const sidecar = JSON.parse(sidecarSource);

test("the product shell identifies HVAC Plan Studio as Draw & Detail on the Patternmaker layout table", () => {
  assert.match(page, /<span>Draw &amp; Detail<\/span>/);
  assert.match(page, /data-visual-world="patternmakers-layout-table"/);
  assert.match(layout, /default: "HVAC Plan Studio · Draw & Detail"/);
  assert.match(layout, /Plan, route, review, redline, and issue controlled HVAC work directly over the source PDF\./);
  assert.doesNotMatch(layout, /default: "HVAC Plan Studio · Field (?:Command Console|Redline Studio)"/);
  assert.match(layout, /summary_large_image/);
  assert.match(layout, /url: "\/og\.png"/);
});

test("the interface exposes the approved Patternmaker material and semantic color language", () => {
  for (const token of [
    "--pattern-kraft: #d8c49a",
    "--pattern-paper: #f7f4ea",
    "--pattern-plan: #ffffff",
    "--pattern-ink: #2b2b28",
    "--pattern-blue: #28527a",
    "--pattern-red: #a84537",
    "--pattern-zinc: #aeb1aa",
  ]) {
    assert.match(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(styles, /--signal-cyan: var\(--pattern-blue\)/);
  assert.match(styles, /--branch-gold: var\(--pattern-red\)/);
  assert.match(styles, /--pattern-kraft-texture: url\("\/materials\/pattern-kraft-fiber\.webp"\)/);
  assert.match(styles, /--pattern-zinc-texture: url\("\/materials\/pattern-aged-zinc\.webp"\)/);
  assert.match(styles, /--pattern-paper-texture: url\("\/materials\/pattern-ledger-paper\.webp"\)/);
  assert.match(styles, /\.command-rail button\.active \{[\s\S]*?background: var\(--pattern-blue\)/);
  assert.match(styles, /\.command-rail button\.redline\.active \{[\s\S]*?background: var\(--pattern-red\)/);
  assert.match(styles, /:is\(\.plan-sheet, \.pdf-stage canvas\) \{[\s\S]*?background-image: none/);
});

test("the Patternmaker display voice is self-hosted without changing technical plan text", () => {
  assert.match(layout, /import localFont from "next\/font\/local"/);
  assert.match(layout, /BarlowCondensed-SemiBold\.woff2/);
  assert.match(layout, /BarlowCondensed-Bold\.woff2/);
  assert.match(layout, /BarlowCondensed-ExtraBold\.woff2/);
  assert.match(layout, /variable: "--font-pattern-condensed"/);
  assert.match(styles, /font-family: var\(--font-pattern-condensed\)/);
  assert.match(styles, /font-family: var\(--font-geist-mono\)/);
});

test("squared instruments retain measured depth, focus, and touch-safe controls", () => {
  assert.match(styles, /--pattern-raised: 0 2px 3px #2b2b2840, 0 6px 14px #2b2b2820, inset 0 1px #ffffffd4/);
  assert.match(styles, /--instrument-shadow: var\(--pattern-raised\)/);
  assert.match(styles, /\.command-rail button \{[\s\S]*?min-height: 49px;[\s\S]*?border-radius: 2px;[\s\S]*?box-shadow: var\(--pattern-raised\)/);
  assert.match(styles, /@media \(pointer: coarse\) \{[\s\S]*?\.command-rail button,[\s\S]*?min-height: 48px/);
  assert.match(styles, /:is\(button, input, select, textarea\):focus-visible \{[\s\S]*?outline: 2px solid var\(--pattern-blue\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?transition: none !important/);
});

test("the layout table gives the plan measured trays, a steel rule, and a bottom job traveler", () => {
  assert.match(page, /data-layout="command-deck" data-visual-world="patternmakers-layout-table"/);
  assert.match(page, /className="command-rail"/);
  assert.match(page, /aria-label="Field command rail"/);
  assert.match(styles, /grid-template-areas: "rail tools canvas inspector"/);
  assert.match(styles, /--deck-rail: 58px/);
  assert.match(styles, /--deck-tools: 224px/);
  assert.match(styles, /--deck-inspector: 304px/);
  assert.match(styles, /grid-template-rows: 52px minmax\(0, 1fr\) 76px 34px/);
  assert.match(styles, /\.left-panel\.view-draw \.tool-list \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 899px\), \(orientation: portrait\) and \(pointer: coarse\)[\s\S]*?grid-template-rows: 56px minmax\(0, 1fr\) 58px 24px/);
  assert.ok(page.indexOf('className="workspace"') < page.indexOf('className="field-first-guide"'), "the job traveler should follow the worktable in visual and focus order");
});

test("the durable design artifacts match the shipped interface system", () => {
  assert.match(design, /Patternmaker(?:'|’)s Layout Table/);
  assert.match(design, /#d8c49a/i);
  assert.match(design, /#f7f4ea/i);
  assert.match(design, /#28527a/i);
  assert.match(design, /#a84537/i);
  assert.match(design, /source (?:PDF|plan)[\s\S]*?(?:true white|white)/i);
  assert.equal(sidecar.schemaVersion, 2);
  assert.match(sidecar.title, /Patternmaker(?:'|’)s Layout Table/);
  const sidecarContract = JSON.stringify(sidecar.extensions);
  assert.match(sidecarContract, /#d8c49a/i);
  assert.match(sidecarContract, /#ffffff/i);
  assert.match(sidecarContract, /52px/);
  assert.match(sidecarContract, /76px/);
  assert.match(sidecarContract, /34px/);
  assert.ok(sidecar.components.length >= 6, "the documented world should retain reusable instrument components");
});
