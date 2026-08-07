import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

const reviewDir = process.env.SYSTEM_BALANCE_REVIEW_DIR;
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function openAirflowWorkspace(page: Page) {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("System Balancing readability fixture", 72, 72);
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "system-balance-readability.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  });
  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible();

  const inspector = page.getByRole("complementary", { name: "HVAC plan inspector" });
  if (!await inspector.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /Inspector/ }).click();
  }
  await inspector.getByRole("tab", { name: "Airflow", exact: true }).click();
  await expect(page.locator(".balance-workspace")).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
}

async function fontSize(locator: Locator) {
  return locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
}

async function renderedHeight(locator: Locator) {
  return locator.evaluate((element) => element.getBoundingClientRect().height);
}

for (const viewport of viewports) {
  test(`System Balancing is readable at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openAirflowWorkspace(page);

    const workspace = page.locator(".balance-workspace");
    await expect(workspace.getByText("SYSTEM BALANCING WORKSPACE")).toBeVisible();
    await expect(workspace.getByText("T Branch colors")).toBeVisible();
    await expect(workspace.getByText("Yellow fitting body: normal.")).toBeVisible();
    await expect(workspace.getByText("Red port or leg: disconnected or undersized.")).toBeVisible();
    await expect(workspace.getByText("0 detached · 0 missing · 0 undersized.")).toBeVisible();

    expect(await fontSize(workspace.locator(".balance-workspace-header strong"))).toBeGreaterThanOrEqual(16);
    expect(await fontSize(workspace.locator(".balance-workspace-header small"))).toBeGreaterThanOrEqual(14);
    expect(await fontSize(workspace.locator(".balance-system-hero strong"))).toBeGreaterThanOrEqual(24);
    expect(await fontSize(workspace.locator(".balance-system-hero p"))).toBeGreaterThanOrEqual(14);
    expect(await fontSize(workspace.locator(".balance-system-grid span").first())).toBeGreaterThanOrEqual(14);
    expect(await fontSize(workspace.locator(".balance-system-grid strong").first())).toBeGreaterThanOrEqual(20);
    expect(await fontSize(workspace.locator(".balance-fitting-legend span").first())).toBeGreaterThanOrEqual(14);
    expect(await renderedHeight(workspace.getByRole("tab", { name: "System", exact: true }))).toBeGreaterThanOrEqual(44);
    expect(await renderedHeight(workspace.getByRole("button", { name: "Select unit" }))).toBeGreaterThanOrEqual(44);

    const box = await workspace.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);

    if (reviewDir) {
      await mkdir(reviewDir, { recursive: true });
      await page.screenshot({ path: path.join(reviewDir, `system-balance-${viewport.name}.png`), fullPage: false });
    }
  });
}

test("both desktop operational panels remain readable without taking over the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAirflowWorkspace(page);
  const [left, canvas, right] = await Promise.all([
    page.getByRole("complementary", { name: "HVAC plan tools" }).boundingBox(),
    page.locator('[aria-label="Plan canvas workspace"]').boundingBox(),
    page.getByRole("complementary", { name: "HVAC plan inspector" }).boundingBox(),
  ]);
  if (!left || !canvas || !right) throw new Error("Desktop workspace regions are missing browser bounds");
  expect(left.width).toBeGreaterThanOrEqual(300);
  expect(left.width).toBeLessThanOrEqual(340);
  expect(right.width).toBeGreaterThanOrEqual(300);
  expect(right.width).toBeLessThanOrEqual(340);
  expect(canvas.width).toBeGreaterThan(left.width);
  expect(canvas.width).toBeGreaterThan(right.width);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
