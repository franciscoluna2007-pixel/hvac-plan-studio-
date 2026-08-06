import { expect, test, type Locator, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

type ScreenPoint = { x: number; y: number };

async function openBlankPlan(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("Return T Branch browser fixture", 72, 72);
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "return-branch-fixture.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  });
  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "100%", exact: true }).click();
}

async function pointOnPlan(page: Page, xRatio: number, yRatio: number): Promise<ScreenPoint> {
  const box = await page.locator("svg.drawing-layer").boundingBox();
  if (!box) throw new Error("Plan SVG has no browser bounds");
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

async function centerOf(locator: Locator): Promise<ScreenPoint> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Plan object has no browser bounds");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function createReturnRun(page: Page) {
  const runs = page.locator('g[aria-label$="return duct run"]:has(> path.hit-line)');
  await page.getByRole("complementary", { name: "HVAC plan tools" }).getByRole("button", { name: /^Return duct/ }).click();
  const start = await pointOnPlan(page, 0.2, 0.38);
  const end = await pointOnPlan(page, 0.8, 0.38);
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(end.x, end.y);
  await page.mouse.click(end.x, end.y, { button: "right" });
  await expect(runs).toHaveCount(1);
  return runs.first();
}

async function placeReturnBranch(page: Page) {
  const original = await createReturnRun(page);
  const originalId = await original.getAttribute("data-plan-drawing-id");
  const originalPath = await original.locator("path.hit-line").getAttribute("d");
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  const target = await centerOf(original.locator("path.hit-line"));
  await page.mouse.click(target.x, target.y);
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  await tools.getByRole("button", { name: "Draw", exact: true }).click();
  await tools.getByRole("button", { name: /^T Branch/ }).click();
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y + 74, { steps: 6 });
  await page.mouse.up();
  return { originalId, originalPath };
}

test("return T Branch press-drag-release splits once, rotates connected, and Undo restores each topology", async ({ page }) => {
  await openBlankPlan(page);
  const { originalId, originalPath } = await placeReturnBranch(page);
  const returnRuns = page.locator('g[aria-label$="return duct run"]:has(> path.hit-line)');
  const fitting = page.locator("g.branch-fitting[data-plan-drawing-id]");
  await expect(returnRuns).toHaveCount(2);
  await expect(fitting).toHaveCount(1);
  await expect(fitting.locator(".connected-port")).toHaveCount(2);
  await expect(fitting.locator(".disconnected-port")).toHaveCount(1);
  await expect(page.locator('g[aria-label$="supply duct run"]:has(> path.hit-line)')).toHaveCount(0);

  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  await fitting.focus();
  const legBeforeRotation = await fitting.locator("path.fitting-leg").nth(2).getAttribute("d");
  const handle = fitting.locator(".rotation-handle-hit");
  const handleCenter = await centerOf(handle);
  await page.mouse.move(handleCenter.x, handleCenter.y);
  await page.mouse.down();
  await page.mouse.move(handleCenter.x + 55, handleCenter.y - 34, { steps: 6 });
  await page.mouse.up();
  await expect(fitting.locator("path.fitting-leg").nth(2)).not.toHaveAttribute("d", legBeforeRotation || "");
  await expect(fitting.locator(".connected-port")).toHaveCount(2);

  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(fitting.locator("path.fitting-leg").nth(2)).toHaveAttribute("d", legBeforeRotation || "");
  await expect(returnRuns).toHaveCount(2);
  await expect(fitting.locator(".connected-port")).toHaveCount(2);

  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(returnRuns).toHaveCount(1);
  await expect(fitting).toHaveCount(0);
  await expect(page.locator(`g[data-plan-drawing-id="${originalId}"] > path.hit-line`)).toHaveAttribute("d", originalPath || "");
});

test("supply T Branch still uses the protected direct-placement path", async ({ page }) => {
  await openBlankPlan(page);
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  await tools.getByRole("button", { name: /^Supply run/ }).click();
  const start = await pointOnPlan(page, 0.2, 0.3);
  const end = await pointOnPlan(page, 0.8, 0.3);
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(end.x, end.y);
  await page.mouse.click(end.x, end.y, { button: "right" });
  const run = page.locator('g[aria-label$="supply duct run"]:has(> path.hit-line)').first();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const target = await centerOf(run.locator("path.hit-line"));
  await page.mouse.click(target.x, target.y);
  await tools.getByRole("button", { name: "Draw", exact: true }).click();
  await tools.getByRole("button", { name: /^T Branch/ }).click();
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y + 70, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('g[aria-label$="supply duct run"]:has(> path.hit-line)')).toHaveCount(2);
  await expect(page.locator("g.branch-fitting[data-plan-drawing-id]")).toHaveCount(1);
});
