import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

const reviewDir = path.resolve("review/material-production");
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test.beforeAll(async () => {
  await mkdir(reviewDir, { recursive: true });
});

async function openLoadedPlan(page: Page) {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.setFontSize(18);
  pdf.text("HVAC Plan Studio Material review", 72, 72);
  pdf.setDrawColor(80);
  pdf.rect(72, 100, 648, 420);
  pdf.line(360, 100, 360, 520);
  pdf.line(72, 310, 720, 310);

  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "material-review-plan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  });

  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible();
  await expect(page.locator('[data-visual-world="material-traverse"][data-presentation="material-cobalt"]')).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  const scrim = page.getByRole("button", { name: "Close open workspace drawer" });
  if (await scrim.isVisible().catch(() => false)) await scrim.click();
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.waitForTimeout(150);
}

async function rgb(locator: Locator, property: "color" | "backgroundColor" | "outlineColor") {
  return locator.evaluate((element, key) => getComputedStyle(element)[key], property);
}

function parseRgb(value: string) {
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Unable to parse color ${value}`);
  return channels;
}

function relativeLuminance(value: string) {
  const channels = parseRgb(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string) {
  const high = Math.max(relativeLuminance(first), relativeLuminance(second));
  const low = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (high + 0.05) / (low + 0.05);
}

for (const viewport of viewports) {
  test(`loaded Material production workspace renders at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openLoadedPlan(page);

    await expect(page.getByRole("button", { name: "Open plan", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Draw HVAC", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Materials", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
    await expect(page.locator(".canvas.has-plan")).toBeVisible();

    const plan = await page.locator("svg.drawing-layer").boundingBox();
    expect(plan).not.toBeNull();
    expect(plan!.x).toBeGreaterThanOrEqual(0);
    expect(plan!.x + plan!.width).toBeLessThanOrEqual(viewport.width + 1);

    await page.screenshot({
      path: path.join(reviewDir, `material-${viewport.name}.png`),
      fullPage: false,
    });
  });
}

test("cobalt brand, primary, hover, active, focus, selected, and disabled states remain legible", async ({ page }) => {
  await openLoadedPlan(page);

  const brandMark = page.locator(".brand-mark");
  const brandName = page.locator(".brand strong");
  const save = page.locator(".top-save-button");
  const draw = page.getByRole("button", { name: "Draw HVAC", exact: true });

  expect(await rgb(brandMark, "backgroundColor")).toBe("rgb(0, 47, 167)");
  expect(await rgb(brandName, "color")).toBe("rgb(0, 47, 167)");

  const saveText = await rgb(save, "color");
  const saveDefault = await rgb(save, "backgroundColor");
  expect(saveDefault).toBe("rgb(0, 47, 167)");
  expect(contrast(saveText, saveDefault)).toBeGreaterThanOrEqual(4.5);

  await save.hover();
  await expect.poll(() => rgb(save, "backgroundColor")).toBe("rgb(0, 40, 143)");
  expect(contrast(await rgb(save, "color"), await rgb(save, "backgroundColor"))).toBeGreaterThanOrEqual(4.5);

  await draw.click();
  expect(await rgb(draw, "backgroundColor")).toBe("rgb(0, 47, 167)");
  expect(contrast(await rgb(draw, "color"), await rgb(draw, "backgroundColor"))).toBeGreaterThanOrEqual(4.5);

  const selectedTool = page
    .getByRole("complementary", { name: "HVAC plan tools" })
    .getByRole("button", { name: "Select V", exact: true });
  await selectedTool.click();
  expect(await rgb(selectedTool, "backgroundColor")).toBe("rgb(233, 239, 255)");
  expect(contrast(await rgb(selectedTool, "color"), await rgb(selectedTool, "backgroundColor"))).toBeGreaterThanOrEqual(4.5);

  await save.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(save).toBeFocused();
  expect(await rgb(save, "outlineColor")).toBe("rgb(0, 47, 167)");
  const outlineWidth = await save.evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(outlineWidth).toBe("3px");

  const disabledSelected = page
    .getByRole("navigation", { name: "Plan workflow" })
    .getByRole("button", { name: "Selected", exact: true });
  await expect(disabledSelected).toBeDisabled();
  const disabledOpacity = await disabledSelected.evaluate((element) => Number(getComputedStyle(element).opacity));
  expect(disabledOpacity).toBeLessThanOrEqual(0.46);
});

test("desktop review covers Project Home, Materials, Export, and focused Connection Check", async ({ page }) => {
  await openLoadedPlan(page);

  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "HVAC plan inspector" })).toBeVisible();
  await expect(page.getByText("combined into simple order quantities")).toBeVisible();
  await expect(page.locator(".plan-check-strip")).toHaveCount(0);
  await page.screenshot({ path: path.join(reviewDir, "material-desktop-materials.png"), fullPage: false });

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Finish the Job" })).toBeVisible();
  await page.getByRole("button", { name: /Check connections/ }).click();
  await expect(page.getByRole("complementary", { name: "HVAC plan inspector" })).toBeVisible();
  const inspectorTabs = page.getByRole("complementary", { name: "HVAC plan inspector" }).getByRole("tab");
  await expect(inspectorTabs).toHaveCount(4);
  for (const name of ["Connections", "Layers", "Airflow", "Materials"]) {
    await expect(inspectorTabs.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByLabel("Connection Check").getByText("Connection Check", { exact: true })).toBeVisible();
  await expect(page.locator(".markup-assistant-studio")).toHaveCount(0);
  await page.screenshot({ path: path.join(reviewDir, "material-desktop-connection-check.png"), fullPage: false });

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Finish the Job" })).toBeVisible();
  await page.screenshot({ path: path.join(reviewDir, "material-desktop-export.png"), fullPage: false });
  await page.getByRole("button", { name: "Close Finish the Job" }).last().click();

  await page.getByRole("button", { name: "Open Project Home" }).click();
  await expect(page.getByRole("dialog", { name: "HVAC Plan Studio jobs" })).toBeVisible();
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(reviewDir, "material-desktop-home.png"), fullPage: false });
});

test("Materials combines same-size supply and return flex and traces both plan sources", async ({ page }) => {
  await openLoadedPlan(page);
  const plan = page.locator("svg.drawing-layer");
  const box = await plan.boundingBox();
  if (!box) throw new Error("Plan SVG has no bounds");
  const drawRun = async (buttonName: RegExp, y: number) => {
    await page.getByRole("complementary", { name: "HVAC plan tools" }).getByRole("button", { name: buttonName }).click();
    const start = { x: box.x + box.width * .2, y: box.y + box.height * y };
    const end = { x: box.x + box.width * .8, y: box.y + box.height * y };
    await page.mouse.click(start.x, start.y);
    await page.mouse.click(end.x, end.y);
    await page.mouse.click(end.x, end.y, { button: "right" });
  };
  await drawRun(/^Supply run/, .32);
  await drawRun(/^Return duct/, .62);

  await page.getByRole("button", { name: "Materials", exact: true }).click();
  const flexibleRows = page.locator(".takeoff-row").filter({ hasText: "Flexible duct" });
  await expect(flexibleRows).toHaveCount(1);
  await expect(flexibleRows).toContainText("3 × 25-ft boxes");
  await page.getByRole("button", { name: "View breakdown" }).click();
  await expect(flexibleRows).toContainText("supply + return");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download list" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks);
  expect([...csv.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(csv.toString("utf8")).toContain('"Measured LF","Allowance %","Order LF","Package","Source objects"');
  expect(csv.toString("utf8")).not.toContain("Breakdown (reference only)");
  await flexibleRows.getByRole("button", { name: "Show on plan" }).click();
  await expect(page.locator('g[data-plan-drawing-id][aria-pressed="true"]')).toHaveCount(2);

  await page.getByRole("tab", { name: "Installer checklist" }).click();
  await expect(page.getByText("PLAN-TO-TRUCK CHECKLIST", { exact: true })).toBeVisible();
  const packedFlex = page.getByRole("checkbox", { name: /Packed Flexible duct 14/ });
  await packedFlex.check();
  await expect(page.getByText("1/2 READY", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(reviewDir, "material-desktop-installer-checklist.png"), fullPage: false });
  await page.getByRole("tab", { name: "Order list" }).click();
  await page.getByRole("tab", { name: "Installer checklist" }).click();
  await expect(packedFlex).toBeChecked();
});

test("Connection Check names an open T Branch and takes the user to it", async ({ page }) => {
  await openLoadedPlan(page);
  const plan = page.locator("svg.drawing-layer");
  const box = await plan.boundingBox();
  if (!box) throw new Error("Plan SVG has no bounds");
  const start = { x: box.x + box.width * .2, y: box.y + box.height * .42 };
  const end = { x: box.x + box.width * .8, y: box.y + box.height * .42 };
  await page.getByRole("complementary", { name: "HVAC plan tools" }).getByRole("button", { name: /^Supply run/ }).click();
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(end.x, end.y);
  await page.mouse.click(end.x, end.y, { button: "right" });
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const run = page.locator('g[data-plan-drawing-id]:has(> path.hit-line)').first();
  const runBox = await run.locator("path.hit-line").boundingBox();
  if (!runBox) throw new Error("Run has no bounds");
  const target = { x: runBox.x + runBox.width / 2, y: runBox.y + runBox.height / 2 };
  await page.mouse.click(target.x, target.y);
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  await tools.getByRole("button", { name: "Draw", exact: true }).click();
  await tools.getByRole("button", { name: /^T Branch/ }).click();
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y + 70, { steps: 5 });
  await page.mouse.up();

  await page.getByRole("tab", { name: "Connections" }).click();
  const check = page.getByLabel("Connection Check");
  await expect(check.getByText("T Branch not connected", { exact: true })).toBeVisible();
  await check.getByRole("button", { name: /T Branch not connected/ }).click();
  await expect(page.locator("g.branch-fitting[aria-pressed=\"true\"]")).toHaveCount(1);
  await expect(page.locator(".markup-assistant-studio")).toHaveCount(0);
});
