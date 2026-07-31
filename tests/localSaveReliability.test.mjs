import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, styles] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("flushes the latest local drawing when the app is hidden or closed", () => {
  assert.match(page, /window\.addEventListener\("pagehide", flushPendingSave\)/);
  assert.match(page, /document\.addEventListener\("visibilitychange", flushWhenHidden\)/);
  assert.match(page, /document\.visibilityState === "hidden"/);
  assert.match(page, /saveProjectRef\.current\?\.\(\)/);
  assert.match(page, /removeEventListener\("pagehide", flushPendingSave\)/);
  assert.match(page, /removeEventListener\("visibilitychange", flushWhenHidden\)/);
});

test("shows saved, limited, and blocked states accessibly on desktop and mobile", () => {
  assert.match(page, /saveState === "limited"[\s\S]*?"Saved · limited"/);
  assert.match(page, /saveState === "error"[\s\S]*?"Save blocked"/);
  assert.match(page, /role="status"[\s\S]*?aria-live="polite"/);
  assert.match(page, /Browser storage is full; export or save a cloud revision before closing/);
  assert.match(styles, /\.studio-save-state\.limited/);
  assert.match(styles, /\.studio-save-state\.error/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.studio-save-state \{[\s\S]*?max-width: 94px/);
  assert.doesNotMatch(
    styles,
    /@media \(max-width: 760px\)[\s\S]*?\.project-name,\s*\.studio-save-state \{ display: none;/,
  );
});
