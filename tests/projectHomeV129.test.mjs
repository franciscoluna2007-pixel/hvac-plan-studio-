import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homeUrl = new URL("../app/ProjectHome.tsx", import.meta.url);
const stylesUrl = new URL("../app/globals.css", import.meta.url);

test("v129 gives solo operators one clear job entry with compact plan choices", async () => {
  const home = await readFile(homeUrl, "utf8");
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(home, /> Open a plan\s*</);
  assert.match(home, /> Continue current job\s*</);
  assert.match(home, /aria-expanded=\{showPlanSources\}/);
  assert.match(home, /aria-controls="project-home-plan-sources"/);
  assert.match(home, /<strong>This device<\/strong>/);
  assert.match(home, /<small>Open PDF and start drawing<\/small>/);
  assert.match(home, /<strong>\{driveConfigured === false \? "Drive unavailable" : "Google Drive"\}<\/strong>/);
  assert.match(home, /<strong>Help me set up this plan<\/strong>/);
  assert.match(home, /Drop a PDF here to open it directly/);
  assert.doesNotMatch(home, /Preferred start on this device/);
  assert.doesNotMatch(home, /aria-pressed=\{pdfStartMode/);

  assert.match(styles, /\.project-home-plan-sources\s*\{/);
  assert.match(styles, /\.project-home-plan-source-buttons\s*\{/);
  assert.match(styles, /\.project-home-plan-source-buttons > button:focus-visible/);
  assert.match(styles, /\.project-home-projects\s*\{\s*margin-top: 0;/);
});

test("v129 keeps recent jobs immediately after the start area", async () => {
  const home = await readFile(homeUrl, "utf8");
  const heroIndex = home.indexOf('className="project-home-hero"');
  const recentIndex = home.indexOf("RECENT JOBS");

  assert.ok(heroIndex >= 0);
  assert.ok(recentIndex > heroIndex);
  assert.doesNotMatch(home.slice(heroIndex, recentIndex), /project-home-status-strip|project-home-workflow|project-home-coordination/);
  assert.match(home, /Open saved jobs/);
});
