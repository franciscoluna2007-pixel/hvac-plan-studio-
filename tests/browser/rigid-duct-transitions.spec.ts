import { expect, test, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

test.setTimeout(120_000);

const planBytes = (() => {
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("Rigid transitions and terminal fixture", 72, 72);
  pdf.line(72, 100, 720, 100);
  return Buffer.from(pdf.output("arraybuffer"));
})();

async function openPlan(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "rigid-transitions-fixture.pdf",
    mimeType: "application/pdf",
    buffer: planBytes,
  });
  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible();
  await page.getByRole("button", { name: "100%", exact: true }).click();
  await page.getByLabel("Drawing scale").selectOption({ label: '1/4" = 1\'-0"' });
}

async function planPoint(page: Page, xRatio: number, yRatio: number) {
  const box = await page.locator("svg.drawing-layer").boundingBox();
  if (!box) throw new Error("Plan SVG has no browser bounds");
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

async function placeRigid(
  page: Page,
  construction: "rectangular" | "spiral",
  yRatio: number,
  network: "supply" | "return" = "supply",
  diameterInches = 8,
) {
  await page.getByRole("button", { name: "Draw HVAC", exact: true }).click();
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  const rigidTool = tools.locator(".rigid-duct-tool");
  await rigidTool.getByLabel("System").selectOption(network);
  await rigidTool.getByLabel("Construction").selectOption(construction);
  if (construction === "spiral") await rigidTool.getByLabel("Diameter, in").fill(String(diameterInches));
  await rigidTool.getByRole("button", { name: "Draw straight rigid duct" }).click();
  const start = await planPoint(page, .22, yRatio);
  const end = await planPoint(page, .60, yRatio);
  const before = await page.locator('g.rigid-duct[data-plan-drawing-id]').count();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('g.rigid-duct[data-plan-drawing-id]')).toHaveCount(before + 1);
  return page.locator('g.rigid-duct[data-plan-drawing-id]').nth(before);
}

test("loaded plan creates reducers plus reciprocal supply- and return-can collars", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  await openPlan(page);

  const rectangular = await placeRigid(page, "rectangular", .30);
  await page.getByRole("navigation", { name: "Plan workflow" }).getByRole("button", { name: "Selected", exact: true }).click();
  const straightProperties = page.locator(".rigid-properties");
  await straightProperties.getByLabel("Inside width, in").fill("30");
  await straightProperties.getByLabel("Inside height, in").fill("10");
  await expect(rectangular).toHaveAttribute("data-rigid-size", "30\u00D710");

  const transitionEditor = straightProperties.locator(".rigid-transition-editor");
  await transitionEditor.getByLabel("Straight end").selectOption("end");
  await transitionEditor.getByLabel("Outlet width, in").fill("25");
  await transitionEditor.getByLabel("Outlet height, in").fill("10");
  await transitionEditor.getByLabel("Alignment").selectOption("top-flat");
  await transitionEditor.getByLabel("Fitting length, in").fill("18");
  await transitionEditor.getByRole("button", { name: "Add transition" }).click();

  const transition = page.locator('g.rigid-transition[data-rigid-fitting="transition"]');
  await expect(transition).toHaveCount(1);
  await expect(transition).toHaveAttribute("data-rigid-inlet-size", "30\u00D710");
  await expect(transition).toHaveAttribute("data-rigid-outlet-size", "25\u00D710");
  await expect(transition).toHaveAttribute("data-rigid-length-inches", "18");
  await expect(transition).toHaveAttribute("data-rigid-alignment", "top-flat");
  await expect(transition).toHaveAttribute("data-rigid-inlet-connected", "true");
  await expect(transition).toHaveAttribute("data-rigid-outlet-connected", "false");

  const transitionProperties = page.locator(".rigid-properties");
  await transitionProperties.getByLabel("Finished straight, ft").fill("12");
  await transitionProperties.getByRole("button", { name: "Add straight from outlet" }).click();
  await expect(page.locator('g.rigid-duct[data-rigid-size="25\u00D710"]')).toHaveCount(1);
  await expect(transition).toHaveAttribute("data-rigid-outlet-connected", "true");

  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('g.rigid-duct[data-rigid-size="25\u00D710"]')).toHaveCount(0);
  await expect(transition).toHaveAttribute("data-rigid-outlet-connected", "false");
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator('g.rigid-duct[data-rigid-size="25\u00D710"]')).toHaveCount(1);
  await expect(transition).toHaveAttribute("data-rigid-outlet-connected", "true");

  const spiral = await placeRigid(page, "spiral", .64);
  await expect(spiral).toHaveAttribute("data-rigid-size", "8");
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  await tools.getByRole("button", { name: "Symbols", exact: true }).click();
  await tools.getByLabel("Category").selectOption("Supply air", { timeout: 8_000 });
  await tools.locator('.symbol-catalog-card[aria-label*="SQUARE SUPPLY CAN"]').click({ timeout: 8_000 });
  const spiralEnd = await planPoint(page, .60, .62);
  const supplyCans = page.locator('g[data-plan-drawing-id].variant-supply-can');
  const symbolCount = await supplyCans.count();
  await page.mouse.click(spiralEnd.x, spiralEnd.y - 16);
  await expect(supplyCans).toHaveCount(symbolCount + 1);
  await page.keyboard.press("Escape");
  await page.locator(".canvas-toolbar").getByRole("button", { name: "Diffuser", exact: true }).click();
  await supplyCans.last().click();
  await page.getByRole("navigation", { name: "Plan workflow" }).getByRole("button", { name: "Selected", exact: true }).click();
  const collarPanel = page.locator(".rigid-terminal-connection");
  await expect(collarPanel).toContainText("Matching");
  await collarPanel.getByRole("button", { name: "Attach rigid" }).click();
  const connectedCan = page.locator('g[data-rigid-terminal="supply-can-collar"]');
  await expect(connectedCan).toHaveCount(1);
  await expect(connectedCan).toHaveAttribute("data-rigid-terminal-connection", /:end$/);

  const returnSpiral = await placeRigid(page, "spiral", .80, "return", 12);
  await expect(returnSpiral).toHaveClass(/rigid-return/);
  await tools.getByRole("button", { name: "Symbols", exact: true }).click();
  await tools.getByLabel("Category").selectOption("Return air", { timeout: 8_000 });
  await tools.locator('.symbol-catalog-card[aria-label*="RECTANGULAR RETURN CAN"]').click({ timeout: 8_000 });
  const returnEnd = await planPoint(page, .60, .78);
  const returnCans = page.locator('g[data-plan-drawing-id].variant-return-can');
  const returnCanCount = await returnCans.count();
  await page.mouse.click(returnEnd.x, returnEnd.y - 16);
  await expect(returnCans).toHaveCount(returnCanCount + 1);
  await page.keyboard.press("Escape");
  await page.locator(".canvas-toolbar").getByRole("button", { name: "Return grille", exact: true }).click();
  await returnCans.last().click();
  await page.getByRole("navigation", { name: "Plan workflow" }).getByRole("button", { name: "Selected", exact: true }).click();
  await expect(collarPanel).toContainText("RIGID RETURN-CAN COLLAR");
  await expect(collarPanel).toContainText("Matching Ø12\"");
  await collarPanel.getByRole("button", { name: "Attach rigid" }).click();
  const connectedReturnCan = page.locator('g[data-rigid-terminal="return-can-collar"]');
  await expect(connectedReturnCan).toHaveCount(1);
  await expect(connectedReturnCan).toHaveAttribute("data-rigid-terminal-connection", /:end$/);
  await expect(returnSpiral).toHaveAttribute("data-rigid-end-connected", "true");

  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(connectedReturnCan).toHaveCount(0);
  await expect(returnSpiral).toHaveAttribute("data-rigid-end-connected", "false");
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Redo", exact: true }).click();
  await expect(connectedReturnCan).toHaveCount(1);
  await expect(returnSpiral).toHaveAttribute("data-rigid-end-connected", "true");
  await expect(returnCans).toHaveCount(returnCanCount + 1);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const stored = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("hvac-plan-studio:rigid-transitions-fixture"));
    return key ? JSON.parse(localStorage.getItem(key) || "{}") : null;
  });
  expect(stored?.version).toBe(13);
  expect(stored?.drawings.some((drawing: { rigidTransition?: unknown }) => drawing.rigidTransition)).toBe(true);
  expect(stored?.drawings.some((drawing: { symbol?: { rigidTerminal?: unknown } }) => drawing.symbol?.rigidTerminal)).toBe(true);

  await openPlan(page);
  await expect(page.locator('g[data-rigid-terminal="supply-can-collar"]')).toHaveCount(1);
  await expect(page.locator('g[data-rigid-terminal="return-can-collar"]')).toHaveCount(1);
  await expect(page.locator('g.rigid-duct.rigid-return[data-rigid-end-connected="true"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await expect(page.locator(".takeoff-row").filter({ hasText: "Rectangular transition" })).toHaveCount(1);
  await expect(page.locator(".takeoff-row").filter({ hasText: "Supply-can straight collar" })).toHaveCount(1);
  await expect(page.locator(".takeoff-row").filter({ hasText: "Return-can straight collar" })).toHaveCount(1);
  expect(errors).toEqual([]);
});
