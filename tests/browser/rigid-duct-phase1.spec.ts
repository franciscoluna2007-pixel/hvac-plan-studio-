import { expect, test, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

test.setTimeout(90_000);

const planBytes = (() => {
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("Rigid duct Phase 1 loaded-plan fixture", 72, 72);
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
    name: "rigid-phase1-fixture.pdf",
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

async function placeRigid(page: Page, construction: "rectangular" | "round-metal" | "spiral", yRatio: number) {
  await page.getByRole("button", { name: "Draw HVAC", exact: true }).click();
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  await tools.locator(".rigid-duct-tool").getByLabel("Construction").selectOption(construction);
  await tools.locator(".rigid-duct-tool").getByRole("button", { name: "Draw straight rigid duct" }).click();
  const start = await planPoint(page, .24, yRatio);
  const end = await planPoint(page, .72, yRatio);
  const before = await page.locator('g.rigid-duct[data-plan-drawing-id]').count();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('g.rigid-duct[data-plan-drawing-id]')).toHaveCount(before + 1);
  return page.locator('g.rigid-duct[data-plan-drawing-id]').nth(before);
}

test("loaded plan supports true-width rigid placement, edit, one Undo, copy, schema round-trip, and Materials", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  await openPlan(page);

  const rectangular = await placeRigid(page, "rectangular", .30);
  await expect(rectangular).toHaveAttribute("data-rigid-size", "12×8");
  await expect(rectangular).toHaveAttribute("data-rigid-plan-width", "24.3000");
  await expect(rectangular).toHaveAttribute("data-rigid-length-feet", /\d+\.\d{3}/);
  await expect(rectangular.locator(".rigid-endpoint")).toHaveCount(2);

  await page.getByRole("navigation", { name: "Plan workflow" }).getByRole("button", { name: "Selected", exact: true }).click();
  const properties = page.locator(".rigid-properties");
  await properties.getByLabel("Inside width, in").fill("18");
  await expect(rectangular).toHaveAttribute("data-rigid-size", "18×8");
  await expect(rectangular).toHaveAttribute("data-rigid-plan-width", "36.4500");

  await page.getByRole("button", { name: "Draw HVAC", exact: true }).click();
  await page.getByRole("complementary", { name: "HVAC plan tools" }).getByRole("button", { name: "Select", exact: true }).click();
  const hit = rectangular.locator(".rigid-hit");
  const originalPath = await hit.getAttribute("d");
  const hitBox = await hit.boundingBox();
  if (!hitBox) throw new Error("Rigid hit path has no bounds");
  await page.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(hitBox.x + hitBox.width / 2 + 42, hitBox.y + hitBox.height / 2 + 28, { steps: 6 });
  await page.mouse.up();
  await expect(hit).not.toHaveAttribute("d", originalPath || "");
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(hit).toHaveAttribute("d", originalPath || "");

  await rectangular.focus();
  await expect(rectangular).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("toolbar", { name: "Selected HVAC object actions" }).getByRole("button", { name: "Copy & paste" }).click();
  const copyA = await planPoint(page, .35, .46);
  const copyB = await planPoint(page, .62, .46);
  await page.mouse.click(copyA.x, copyA.y);
  await page.mouse.click(copyB.x, copyB.y);
  await page.keyboard.press("Escape");
  await expect(page.locator('g.rigid-rectangular[data-plan-drawing-id]')).toHaveCount(3);

  await placeRigid(page, "round-metal", .62);
  await placeRigid(page, "spiral", .76);
  await expect(page.locator("g.rigid-round-metal .rigid-spiral-seam")).toHaveCount(0);
  await expect(page.locator("g.rigid-spiral .rigid-spiral-seam")).not.toHaveCount(0);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const storedVersion = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("hvac-plan-studio:rigid-phase1-fixture"));
    return key ? JSON.parse(localStorage.getItem(key) || "{}").version : null;
  });
  expect(storedVersion).toBe(10);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({ name: "rigid-phase1-fixture.pdf", mimeType: "application/pdf", buffer: planBytes });
  await expect(page.locator('g.rigid-duct[data-plan-drawing-id]')).toHaveCount(5);
  await expect(page.locator('g.rigid-rectangular[data-rigid-size="18×8"]')).toHaveCount(3);

  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await expect(page.locator(".takeoff-row").filter({ hasText: "Rectangular sheet-metal duct" })).toHaveCount(1);
  await expect(page.locator(".takeoff-row").filter({ hasText: "Round metal pipe" })).toHaveCount(1);
  await expect(page.locator(".takeoff-row").filter({ hasText: "Spiral pipe" })).toHaveCount(1);
  expect(errors).toEqual([]);
});
