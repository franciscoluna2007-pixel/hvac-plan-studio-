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

test("desktop review covers Project Home, Materials, Export, and compact Plan Check", async ({ page }) => {
  await openLoadedPlan(page);

  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "HVAC plan inspector" })).toBeVisible();
  await page.screenshot({ path: path.join(reviewDir, "material-desktop-materials.png"), fullPage: false });

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.locator(".markup-assistant-studio").getByRole("heading", { name: /items? to review/ })).toBeVisible();
  await page.screenshot({ path: path.join(reviewDir, "material-desktop-plan-check.png"), fullPage: false });
  await page.getByRole("button", { name: "Close Plan Check" }).click();

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Finish the Job" })).toBeVisible();
  await page.screenshot({ path: path.join(reviewDir, "material-desktop-export.png"), fullPage: false });
  await page.getByRole("button", { name: "Close Finish the Job" }).last().click();

  await page.getByRole("button", { name: "Open Project Home" }).click();
  await expect(page.getByRole("dialog", { name: "HVAC Plan Studio jobs" })).toBeVisible();
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(reviewDir, "material-desktop-home.png"), fullPage: false });
});
