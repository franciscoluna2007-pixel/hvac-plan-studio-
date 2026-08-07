import { expect, test, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

async function openLoadedPlan(page: Page) {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.setFontSize(18);
  pdf.text("Airflow sizing chart review", 72, 72);
  pdf.rect(72, 100, 648, 420);

  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "airflow-sizing-review.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  });

  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible();
  const scrim = page.getByRole("button", { name: "Close open workspace drawer" });
  if (await scrim.isVisible().catch(() => false)) await scrim.click();
  expect(pageErrors).toEqual([]);
}

async function openAirflowChart(page: Page) {
  await page.getByRole("tab", { name: "Airflow", exact: true }).click();
  await page.getByRole("button", { name: "Adjust airflow chart", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Airflow capacity chart" })).toBeVisible();
}

test("uploaded airflow chart is editable, persistent in-session, responsive, and geometry-safe", async ({ page }) => {
  await openLoadedPlan(page);
  const drawingIdsBefore = await page.locator("[data-plan-drawing-id]").evaluateAll((elements) =>
    [...new Set(elements.map((element) => element.getAttribute("data-plan-drawing-id")).filter(Boolean))].sort()
  );

  await openAirflowChart(page);
  await expect(page.getByRole("dialog", { name: "Airflow capacity chart" })).toBeFocused();
  await expect(page.getByLabel("14 inch flexible duct design airflow")).toHaveValue("700");
  await page.getByRole("tab", { name: /Round \/ spiral/ }).click();
  await expect(page.getByLabel("14 inch round metal pipe design airflow")).toHaveValue("750");
  await page.getByRole("tab", { name: /Rectangular/ }).click();
  await expect(page.getByLabel("42 by 12 rectangular duct design airflow")).toHaveValue("3050");

  await page.getByRole("tab", { name: /Flexible duct/ }).click();
  await page.getByLabel("14 inch flexible duct design airflow").fill("725");
  await page.getByLabel("Move up one size after").fill("30");

  await page.setViewportSize({ width: 390, height: 844 });
  const dialogBox = await page.getByRole("dialog", { name: "Airflow capacity chart" }).boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(391);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.getByRole("button", { name: "Save chart", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAirflowChart(page);
  await expect(page.getByLabel("14 inch flexible duct design airflow")).toHaveValue("725");
  await expect(page.getByLabel("Move up one size after")).toHaveValue("30");
  await page.getByRole("button", { name: "Close airflow capacity chart" }).click();

  const drawingIdsAfter = await page.locator("[data-plan-drawing-id]").evaluateAll((elements) =>
    [...new Set(elements.map((element) => element.getAttribute("data-plan-drawing-id")).filter(Boolean))].sort()
  );
  expect(drawingIdsAfter).toEqual(drawingIdsBefore);
});
