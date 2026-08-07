import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("System Balancing inspector keeps readable roles and explains T Branch colors", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const readability = styles.slice(
    styles.indexOf("/* System Balancing readability."),
    styles.indexOf("/* Local operational-panel refinement:"),
  );

  assert.match(page, /const activeNetworkBalanceRows = networkBalanceRows\(\)/);
  assert.match(page, /aria-label="T Branch fitting status"/);
  assert.match(page, /Yellow fitting body: normal\./);
  assert.match(page, /Red port or leg: disconnected or undersized\./);
  assert.match(page, /undersized port.*red on this system; no detached or missing ports are reported\./s);

  assert.match(readability, /\.balance-workspace \{[\s\S]*font-size: 16px;/);
  assert.match(readability, /\.balance-workspace :is\(small, label, em\) \{[\s\S]*font-size: 14px;/);
  assert.match(readability, /\.balance-system-hero strong \{[\s\S]*24px/);
  assert.match(readability, /\.balance-system-grid strong \{[\s\S]*22px/);
  assert.match(readability, /\.network-airflow-grid strong \{[\s\S]*20px/);
  assert.match(readability, /\.balance-workspace button,[\s\S]*min-height: 44px/);
  assert.match(readability, /outline: 3px solid var\(--material-blue\)/);
  assert.doesNotMatch(readability, /\.branch-fitting|drawingColors|\.duct-line/);

  assert.match(page, /supply: "#2b83ff"/);
  assert.match(page, /return: "#ef5350"/);
  assert.match(page, /fresh: "#45d18b"/);
});
