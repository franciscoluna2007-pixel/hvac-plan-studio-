import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

const reviewDir = path.resolve("review/plan-to-truck");
const outputPdf = path.join(reviewDir, "material-order-list.pdf");

async function openPlan(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.setFontSize(18);
  pdf.text("Plan-to-Truck material order review", 72, 72);
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "plan-to-truck-review.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  });
  await expect(page.locator("svg.drawing-layer")).toBeVisible();
  await page.getByRole("button", { name: "Fit", exact: true }).click();
}

async function drawRun(page: Page, buttonName: RegExp, yRatio: number) {
  const plan = await page.locator("svg.drawing-layer").boundingBox();
  if (!plan) throw new Error("Plan SVG has no bounds");
  await page.getByRole("complementary", { name: "HVAC plan tools" }).getByRole("button", { name: buttonName }).click();
  const start = { x: plan.x + plan.width * .2, y: plan.y + plan.height * yRatio };
  const end = { x: plan.x + plan.width * .8, y: plan.y + plan.height * yRatio };
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(end.x, end.y);
  await page.mouse.click(end.x, end.y, { button: "right" });
}

test("renders the actual Materials order sheet as a readable PDF", async ({ page }) => {
  await mkdir(reviewDir, { recursive: true });
  await openPlan(page);
  await drawRun(page, /^Supply run/, .32);
  await drawRun(page, /^Return duct/, .62);
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await expect(page.locator(".takeoff-row").filter({ hasText: "Flexible duct" })).toContainText("3 × 25-ft boxes");

  await page.locator("main").evaluate((main) => {
    for (const className of [...main.classList]) {
      if (className.startsWith("package-include-")) main.classList.remove(className);
    }
    main.classList.add("package-include-materials", "package-print-draft");
  });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: outputPdf,
    format: "Letter",
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
  });
  const rendered = await readFile(outputPdf);
  expect(rendered.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(rendered.length).toBeGreaterThan(10_000);
});
