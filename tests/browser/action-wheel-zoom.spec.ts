import { expect, test, type Locator, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

type ScreenPoint = { x: number; y: number };
type PlanPoint = { xRatio: number; yRatio: number };

async function openBlankPlan(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("Selected action controls zoom fixture", 72, 72);
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "action-wheel-zoom-fixture.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  });
  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "100%", exact: true }).click();
}

async function pointOnVisiblePlan(page: Page, xRatio: number, yRatio: number): Promise<ScreenPoint> {
  const [plan, canvas] = await Promise.all([
    page.locator("svg.drawing-layer").boundingBox(),
    page.locator(".canvas.has-plan").boundingBox(),
  ]);
  if (!plan || !canvas) throw new Error("Plan SVG or canvas has no browser bounds");
  const left = Math.max(plan.x, canvas.x);
  const top = Math.max(plan.y, canvas.y);
  const right = Math.min(plan.x + plan.width, canvas.x + canvas.width);
  const bottom = Math.min(plan.y + plan.height, canvas.y + canvas.height);
  if (right <= left || bottom <= top) throw new Error("Plan SVG is outside the visible canvas");
  return { x: left + (right - left) * xRatio, y: top + (bottom - top) * yRatio };
}

async function placeSymbol(
  page: Page,
  category: string,
  name: RegExp,
  planPoint: PlanPoint,
  selector: string,
) {
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  await page
    .getByRole("navigation", { name: "Plan workflow" })
    .getByRole("button", { name: /^(Symbols|Open HVAC symbols)$/ })
    .click();
  await expect(tools).toBeVisible();
  await page.getByLabel("Category").selectOption({ label: category });
  await page.getByRole("listitem", { name }).first().click();
  const symbols = page.locator(selector);
  const before = await symbols.count();
  const collapse = tools.getByRole("button", { name: "Collapse design tools" });
  if (await collapse.isVisible()) await collapse.click();
  const point = await pointOnVisiblePlan(page, planPoint.xRatio, planPoint.yRatio);
  await page.mouse.click(point.x, point.y);
  await expect(symbols).toHaveCount(before + 1);
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  return symbols.nth(before);
}

async function zoomPercent(page: Page) {
  const text = await page.locator(".canvas-toolbar > strong").innerText();
  return Number.parseInt(text, 10);
}

async function wheelTo(page: Page, anchor: Locator, target: number) {
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const current = await zoomPercent(page);
    if (current === target || (target !== 25 && target !== 1200 && Math.abs(current - target) <= 100)) return;
    const box = await anchor.boundingBox();
    const canvasBox = await page.locator(".canvas.has-plan").boundingBox();
    if (!canvasBox) throw new Error("Canvas has no browser bounds");
    const x = box
      ? Math.min(canvasBox.x + canvasBox.width - 4, Math.max(canvasBox.x + 4, box.x + box.width / 2))
      : canvasBox.x + canvasBox.width / 2;
    const y = box
      ? Math.min(canvasBox.y + canvasBox.height - 4, Math.max(canvasBox.y + 4, box.y + box.height / 2))
      : canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, current < target ? -900 : 900);
    await page.waitForTimeout(45);
  }
  const finalZoom = await zoomPercent(page);
  if (target === 25 || target === 1200) expect(finalZoom).toBe(target);
  else expect(Math.abs(finalZoom - target)).toBeLessThanOrEqual(100);
}

async function expectControlInsideCanvas(page: Page) {
  const wheel = page.locator(".symbol-action-wheel");
  await expect(wheel).toBeVisible();
  const [control, canvas] = await Promise.all([
    wheel.boundingBox(),
    page.locator(".canvas.has-plan").boundingBox(),
  ]);
  if (!control || !canvas) throw new Error("Action control or canvas has no bounds");
  expect(control.x).toBeGreaterThanOrEqual(canvas.x - 1);
  expect(control.y).toBeGreaterThanOrEqual(canvas.y - 1);
  expect(control.x + control.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
  expect(control.y + control.height).toBeLessThanOrEqual(canvas.y + canvas.height + 1);
  await expect(wheel.getByRole("button", { name: "Copy icon and place it with the mouse" })).toBeVisible();
  await expect(wheel.getByRole("button", { name: "Rotate left 15 degrees" })).toBeVisible();
  await expect(wheel.getByRole("button", { name: "Rotate right 15 degrees" })).toBeVisible();
  await expect(wheel.getByRole("button", { name: "Mirror icon" })).toBeVisible();
  await expect(wheel.getByRole("button", { name: "Use compact icon and label sizes" })).toBeVisible();
  await expect(wheel.getByRole("button", { name: "Delete icon" })).toBeVisible();
  await expect(wheel.getByRole("button", { name: "Close icon actions" })).toBeVisible();
  const targets = await wheel.getByRole("button").evaluateAll((buttons) =>
    buttons.map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
  );
  for (const target of targets) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
}

test("selected symbol actions stay bounded from minimum through the new maximum zoom", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openBlankPlan(page);
  const positions = {
    topLeft: { xRatio: 0.08, yRatio: 0.1 },
    topRight: { xRatio: 0.92, yRatio: 0.1 },
    bottomLeft: { xRatio: 0.08, yRatio: 0.88 },
    bottomRight: { xRatio: 0.92, yRatio: 0.88 },
    center: { xRatio: 0.5, yRatio: 0.5 },
  };

  const supply = await placeSymbol(page, "Supply air", /4-WAY SUPPLY · 12×12/i, positions.topLeft, 'g.symbol-diffuser[data-plan-drawing-id]');
  const returnTerminal = await placeSymbol(page, "Return air", /RETURN GRILLE · 14×14/i, positions.topRight, 'g.symbol-returnGrille[data-plan-drawing-id]');
  const equipment = await placeSymbol(page, "Equipment", /SYSTEM 1 · 3 TON AHU/i, positions.bottomLeft, 'g.symbol-equipment[data-plan-drawing-id]');
  const hood = await placeSymbol(page, "Air devices", /Range Hood/i, positions.bottomRight, 'g.symbol-rangeHood[data-plan-drawing-id]');
  const dryer = await placeSymbol(page, "Air devices", /Dryer Vent/i, positions.center, 'g.symbol-dryerVent[data-plan-drawing-id]');

  const cases = [
    { symbol: supply, zoom: 25 },
    { symbol: returnTerminal, zoom: 100 },
    { symbol: equipment, zoom: 300 },
    { symbol: hood, zoom: 700 },
    { symbol: dryer, zoom: 1200 },
  ];

  for (const item of cases) {
    await page.getByRole("button", { name: "100%", exact: true }).click();
    await item.symbol.focus();
    await wheelTo(page, item.symbol, item.zoom);
    await item.symbol.focus();
    await expect(item.symbol).toHaveAttribute("aria-pressed", "true");
    await expectControlInsideCanvas(page);
    await expect(page.locator(".symbol-action-wheel")).toHaveAttribute("data-wheel-layout", /wheel|strip/);
    await expect(page.locator(".symbol-resize-outline, .symbol-resize-handle, .rotation-ring, .symbol-label-outline, .symbol-label-size-handle")).toHaveCount(0);
  }

  expect(await zoomPercent(page)).toBe(1200);
  await dryer.focus();
  const originalTransform = await dryer.locator(":scope > g").first().getAttribute("transform");
  await page.locator(".symbol-action-wheel").getByRole("button", { name: "Rotate right 15 degrees" }).click();
  await expect(dryer.locator(":scope > g").first()).not.toHaveAttribute("transform", originalTransform || "");
  await page.keyboard.press("Escape");
  await expect(page.locator(".symbol-action-wheel")).toHaveCount(0);
  await expect(dryer).toHaveAttribute("aria-pressed", "false");
});

for (const viewport of [
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`selected controls remain in the ${viewport.name} canvas at maximum zoom`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openBlankPlan(page);
    const point = { xRatio: 0.5, yRatio: 0.5 };
    const hood = await placeSymbol(page, "Air devices", /Range Hood/i, point, 'g.symbol-rangeHood[data-plan-drawing-id]');
    const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
    const collapse = tools.getByRole("button", { name: "Collapse design tools" });
    if (await collapse.isVisible()) await collapse.click();
    await hood.focus();
    await wheelTo(page, hood, 1200);
    await hood.focus();
    await expectControlInsideCanvas(page);
    await expect(page.locator(".symbol-action-wheel")).toHaveAttribute(
      "data-wheel-layout",
      viewport.name === "mobile" ? "strip" : /wheel|strip/,
    );
  });
}
