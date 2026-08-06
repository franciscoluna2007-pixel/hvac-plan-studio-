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

test("the product shell identifies the selected Material Cobalt Traverse direction", () => {
  assert.match(page, /<span>Draw &amp; Detail<\/span>/);
  assert.match(page, /data-visual-world="material-traverse"/);
  assert.match(page, /data-presentation="material-cobalt"/);
  assert.match(layout, /data-impeccable-direction="material-cobalt"/);
  assert.match(layout, /default: "HVAC Plan Studio.+Draw & Detail"/);
  assert.match(layout, /Plan, route, review, redline, and issue controlled HVAC work directly over the source PDF\./);
  assert.doesNotMatch(layout, /default: "HVAC Plan Studio.+Field (?:Command Console|Redline Studio)"/);
});

test("the interface exposes the selected neutral Material palette and disciplined cobalt accent", () => {
  for (const token of [
    "--material-plan: #ffffff",
    "--material-shell: #edf0ee",
    "--material-panel: #fbfcfb",
    "--material-panel-muted: #e3e7e4",
    "--material-ink: #202421",
    "--material-blue: #002fa7",
    "--material-blue-hover: #00288f",
    "--material-blue-pressed: #001f73",
    "--material-blue-soft: #e9efff",
  ]) {
    assert.match(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(styles, /\.brand-mark, \.project-home-brand > span[\s\S]*?background: var\(--material-blue\)/);
  assert.match(styles, /\.topbar \.top-actions > \.top-save-button[\s\S]*?background: var\(--material-blue\)/);
  assert.match(styles, /\.command-rail button\.active:not\(\.redline\)[\s\S]*?background: var\(--material-blue\)/);
});

test("domain and canvas semantics remain separate from the cobalt interface accent", () => {
  assert.match(styles, /--gd-confirm: var\(--material-success\) !important/);
  assert.match(styles, /--gd-warning: var\(--material-warning\) !important/);
  assert.match(styles, /--gd-critical: var\(--material-critical\) !important/);
  assert.match(styles, /\.command-rail button\.redline\.active[\s\S]*?background: var\(--material-redline\)/);
  assert.match(styles, /\.tool-icon\.blue \{ color: var\(--blue\); \}/);
  assert.match(styles, /\.tool-icon\.red \{ color: var\(--red\); \}/);
  assert.match(styles, /\.tool-icon\.green \{ color: var\(--green\); \}/);
  assert.match(styles, /:is\(\.plan-sheet, \.pdf-stage canvas\)[\s\S]*?background: var\(--material-plan\) !important/);
  assert.match(design, /Cobalt is the interface accent, not a blanket recolor/);
});

test("Material controls retain precise typography, depth, focus, and touch-safe states", () => {
  assert.match(styles, /font-family: var\(--font-geist-sans\)/);
  assert.match(styles, /--material-shadow-panel: 0 8px 24px/);
  assert.match(styles, /--material-shadow-plan: 0 16px 36px/);
  assert.match(styles, /:is\(button, input, select, textarea, summary\):focus-visible[\s\S]*?outline: 3px solid var\(--material-blue\) !important/);
  assert.match(styles, /@media \(hover: none\), \(pointer: coarse\)[\s\S]*?min-height: 48px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration: \.01ms !important/);
});

test("the Traverse composition keeps the four core destinations above the dominant plan", () => {
  assert.match(page, /data-layout="command-deck" data-visual-world="material-traverse" data-presentation="material-cobalt"/);
  assert.match(page, /aria-label="Plan workflow"/);
  assert.ok(page.indexOf("<span>Open plan</span>") < page.indexOf("<span>Draw HVAC</span>"));
  assert.ok(page.indexOf("<span>Draw HVAC</span>") < page.indexOf("<span>Materials</span>"));
  assert.ok(page.indexOf("<span>Materials</span>") < page.indexOf("<span>Export</span>"));
  assert.match(styles, /grid-template-areas:\s*"rail rail rail"\s*"tools canvas inspector"/);
  assert.match(styles, /grid-template-columns: 260px minmax\(520px, 1fr\) 288px/);
  assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*?grid-template-areas: "rail" "canvas"/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?grid-template-rows: 58px minmax\(0, 1fr\) 28px/);
});

test("the durable design document matches the shipped Material Cobalt interface", () => {
  assert.match(design, /Material Cobalt/);
  assert.match(design, /#002FA7/i);
  assert.match(design, /#EDF0EE/i);
  assert.match(design, /#FBFCFB/i);
  assert.match(design, /source (?:PDF|plan)[\s\S]*?(?:exact white|white)/i);
  assert.match(design, /Open Plan[\s\S]*?Draw HVAC[\s\S]*?Materials[\s\S]*?Export/);
  assert.equal(sidecar.schemaVersion, 2);
  assert.ok(sidecar.components.length >= 6, "the legacy sidecar remains readable until its separate refresh");
});
