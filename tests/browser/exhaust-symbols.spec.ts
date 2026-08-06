import { expect, test, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

async function openBlankPlan(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("Dedicated exhaust symbols browser fixture", 72, 72);
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  const planFile = {
    name: "exhaust-symbols-fixture.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  };
  await page.locator('input.file-input[type="file"]').setInputFiles(planFile);
  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "100%", exact: true }).click();
  return planFile;
}

async function pointOnPlan(page: Page, xRatio: number, yRatio: number) {
  const box = await page.locator("svg.drawing-layer").boundingBox();
  if (!box) throw new Error("Plan SVG has no browser bounds");
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

test("Range Hood and Dryer Vent place, copy/Undo, serialize, and count independently", async ({ page }) => {
  const planFile = await openBlankPlan(page);
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  await tools.getByRole("button", { name: "Symbols", exact: true }).click();
  await page.getByLabel("Category").selectOption({ label: "Air devices" });

  const hoodPalette = page.getByRole("listitem", { name: /Range Hood/ });
  const dryerPalette = page.getByRole("listitem", { name: /Dryer Vent/ });
  await expect(hoodPalette).toBeVisible();
  await expect(dryerPalette).toBeVisible();

  await hoodPalette.click();
  const hoodPoint = await pointOnPlan(page, 0.38, 0.4);
  await page.mouse.click(hoodPoint.x, hoodPoint.y);
  await dryerPalette.click();
  const dryerPoint = await pointOnPlan(page, 0.62, 0.4);
  await page.mouse.click(dryerPoint.x, dryerPoint.y);
  await page.keyboard.press("Escape");

  const hoods = page.locator('g.symbol-rangeHood[data-plan-drawing-id][role="button"]');
  const dryers = page.locator('g.symbol-dryerVent[data-plan-drawing-id][role="button"]');
  await expect(hoods).toHaveCount(1);
  await expect(dryers).toHaveCount(1);
  await expect(hoods.first()).toHaveAccessibleName(/Range Hood.*HVAC symbol/i);
  await expect(dryers.first()).toHaveAccessibleName(/Dryer Vent.*HVAC symbol/i);

  await page.waitForFunction(() => {
    const persisted = Object.values(localStorage).join("\n");
    return persisted.includes('"kind":"rangeHood"') && persisted.includes('"kind":"dryerVent"');
  });
  const persisted = await page.evaluate(() => Object.values(localStorage).join("\n"));
  expect(persisted).toContain('"kind":"rangeHood"');
  expect(persisted).toContain('"kind":"dryerVent"');

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles(planFile);
  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible({ timeout: 15_000 });
  await expect(hoods).toHaveCount(1);
  await expect(dryers).toHaveCount(1);

  await page.keyboard.press("v");
  await hoods.first().focus();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  const copiedPoint = await pointOnPlan(page, 0.5, 0.68);
  await page.mouse.click(copiedPoint.x, copiedPoint.y);
  await page.keyboard.press("Escape");
  await expect(hoods).toHaveCount(2);
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(hoods).toHaveCount(1);

  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await page.getByRole("tablist", { name: "HVAC Takeoff Center" }).getByRole("tab", { name: "Materials", exact: true }).click();
  const hoodRow = page.locator(".takeoff-row").filter({ hasText: "Range Hood" });
  const dryerRow = page.locator(".takeoff-row").filter({ hasText: "Dryer Vent" });
  await expect(hoodRow).toBeVisible();
  await expect(dryerRow).toBeVisible();
  await expect(hoodRow).toContainText("1 EA");
  await expect(dryerRow).toContainText("1 EA");
  await expect(hoodRow).not.toContainText("LF");
  await expect(dryerRow).not.toContainText("LF");
});
