import { expect, test, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

type ScreenPoint = { x: number; y: number };

async function openBlankPlan(page: Page) {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("HVAC browser interaction fixture", 72, 72);
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "browser-fixture.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  });
  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open plan", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Draw HVAC", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Materials", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
  await page.getByRole("button", { name: "100%", exact: true }).click();
}

async function pointOnPlan(page: Page, xRatio: number, yRatio: number): Promise<ScreenPoint> {
  const box = await page.locator("svg.drawing-layer").boundingBox();
  if (!box) throw new Error("Plan SVG has no browser bounds");
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

async function createSupplyRun(page: Page, yRatio: number) {
  const runs = page.locator('g[data-plan-drawing-id]:has(> path.hit-line)');
  const before = await runs.count();
  await page
    .getByRole("complementary", { name: "HVAC plan tools" })
    .getByRole("button", { name: /^Supply run/ })
    .click();
  const start = await pointOnPlan(page, 0.2, yRatio);
  const end = await pointOnPlan(page, 0.8, yRatio);
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(end.x, end.y);
  await page.mouse.click(end.x, end.y, { button: "right" });
  await expect(runs).toHaveCount(before + 1);
  return runs.nth(before);
}

async function centerOf(locator: ReturnType<Page["locator"]>): Promise<ScreenPoint> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Browser object has no bounds");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("ordinary wheel zoom stays centered on the cursor", async ({ page }) => {
  await openBlankPlan(page);
  const cursor = await pointOnPlan(page, 0.68, 0.42);
  const stage = page.locator(".pdf-stage");
  const beforeStage = await stage.boundingBox();
  if (!beforeStage) throw new Error("PDF stage has no bounds");
  const beforePlanPoint = {
    x: cursor.x - beforeStage.x,
    y: cursor.y - beforeStage.y,
  };

  await page.mouse.move(cursor.x, cursor.y);
  await page.mouse.wheel(0, -500);
  await expect(page.locator(".canvas-toolbar > strong")).not.toHaveText("100%");

  const zoomText = await page.locator(".canvas-toolbar > strong").innerText();
  const zoom = Number.parseInt(zoomText, 10) / 100;
  const afterStage = await stage.boundingBox();
  if (!afterStage) throw new Error("Zoomed PDF stage has no bounds");
  const afterPlanPoint = {
    x: (cursor.x - afterStage.x) / zoom,
    y: (cursor.y - afterStage.y) / zoom,
  };
  expect(Math.abs(afterPlanPoint.x - beforePlanPoint.x)).toBeLessThan(2);
  expect(Math.abs(afterPlanPoint.y - beforePlanPoint.y)).toBeLessThan(2);
  await expect(page.locator(".canvas.has-plan")).toBeFocused();
});

test("a direct supply-run drag is reversed by one Undo", async ({ page }) => {
  await openBlankPlan(page);
  const run = await createSupplyRun(page, 0.35);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const hitLine = run.locator("path.hit-line");
  const originalPath = await hitLine.getAttribute("d");
  const center = await centerOf(hitLine);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 42, center.y + 36, { steps: 6 });
  await page.mouse.up();
  await expect(hitLine).not.toHaveAttribute("d", originalPath || "");

  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(hitLine).toHaveAttribute("d", originalPath || "");
});

test("right-click Copy supports repeated paste and Escape exit", async ({ page }) => {
  await openBlankPlan(page);
  const run = await createSupplyRun(page, 0.38);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const center = await centerOf(run.locator("path.hit-line"));
  await page.mouse.click(center.x, center.y, { button: "right" });

  const menu = page.getByRole("menu", { name: "Supply assembly actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Copy" })).toBeFocused();
  await menu.getByRole("menuitem", { name: "Copy" }).click();
  await expect(page.getByText("Copy follows your mouse", { exact: true })).toBeVisible();

  const firstPaste = await pointOnPlan(page, 0.35, 0.68);
  const secondPaste = await pointOnPlan(page, 0.68, 0.72);
  await page.mouse.click(firstPaste.x, firstPaste.y);
  await page.mouse.click(secondPaste.x, secondPaste.y);
  await expect(page.locator('g[data-plan-drawing-id]:has(> path.hit-line)')).toHaveCount(3);

  await page.keyboard.press("Escape");
  await expect(page.getByText("Copy follows your mouse", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-plan-drawing-id^="copy-place-preview-"]')).toHaveCount(0);
});

test("T Branch press-drag-release splits only the selected trunk", async ({ page }) => {
  await openBlankPlan(page);
  const first = await createSupplyRun(page, 0.25);
  const second = await createSupplyRun(page, 0.4);
  await page.getByRole("button", { name: "Select", exact: true }).click();

  const firstId = await first.getAttribute("data-plan-drawing-id");
  const secondId = await second.getAttribute("data-plan-drawing-id");
  const firstPathBefore = await first.locator("path.hit-line").getAttribute("d");
  const secondPathBefore = await second.locator("path.hit-line").getAttribute("d");
  const target = await centerOf(first.locator("path.hit-line"));
  await page.mouse.click(target.x, target.y);
  await expect(first).toHaveAttribute("aria-pressed", "true");

  const planTools = page.getByRole("complementary", { name: "HVAC plan tools" });
  await planTools.getByRole("button", { name: "Draw", exact: true }).click();
  await planTools.getByRole("button", { name: /^T Branch/ }).click();
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y + 76, { steps: 6 });
  await page.mouse.up();

  const runs = page.locator('g[data-plan-drawing-id]:has(> path.hit-line)');
  await expect(runs).toHaveCount(3);
  await expect(page.locator("g.branch-fitting[data-plan-drawing-id]")).toHaveCount(1);
  await expect(page.locator(`g[data-plan-drawing-id="${secondId}"] > path.hit-line`)).toHaveAttribute("d", secondPathBefore || "");
  await expect(page.locator(`g[data-plan-drawing-id="${firstId}"] > path.hit-line`)).not.toHaveAttribute("d", firstPathBefore || "");
  await page.keyboard.press("Escape");
});
