import { expect, test, type Locator, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

test.setTimeout(90_000);

const planBytes = (() => {
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("Rigid duct compact review fixture", 72, 72);
  pdf.line(72, 100, 720, 100);
  return Buffer.from(pdf.output("arraybuffer"));
})();

async function uploadPlan(page: Page) {
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "rigid-review-refinements.pdf",
    mimeType: "application/pdf",
    buffer: planBytes,
  });
  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible();
}

async function openPlan(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await uploadPlan(page);
  await page.getByRole("button", { name: "100%", exact: true }).click();
  await page.getByLabel("Drawing scale").selectOption({ label: '3/16" = 1\'-0"' });
}

async function planPoint(page: Page, xRatio: number, yRatio: number) {
  const box = await page.locator("svg.drawing-layer").boundingBox();
  if (!box) throw new Error("Plan SVG has no browser bounds");
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

async function drawRigid(
  page: Page,
  yRatio: number,
  options: {
    construction?: "rectangular" | "round-metal" | "spiral";
    width?: string;
    height?: string;
    diameter?: string;
  } = {},
) {
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  const rigidTool = tools.locator(".rigid-duct-tool");
  await page.getByRole("button", { name: "Draw HVAC", exact: true }).click();
  const construction = options.construction || "rectangular";
  await rigidTool.getByLabel("Construction").selectOption(construction);
  if (construction === "rectangular") {
    await rigidTool.getByLabel("Width, in").fill(options.width || "40");
    await rigidTool.getByLabel("Height, in").fill(options.height || "10");
  } else {
    await rigidTool.getByLabel("Diameter, in").fill(options.diameter || "14");
  }
  await rigidTool.getByRole("button", { name: "Draw straight rigid duct" }).click();
  const start = await planPoint(page, .24, yRatio);
  const end = await planPoint(page, .70, yRatio);
  const before = await page.locator('g.rigid-duct[data-plan-drawing-id]').count();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  const straights = page.locator('g.rigid-duct[data-plan-drawing-id]');
  await expect(straights).toHaveCount(before + 1);
  return straights.nth(before);
}

async function numericAttribute(locator: Locator, name: string) {
  const value = Number(await locator.getAttribute(name));
  expect(Number.isFinite(value)).toBe(true);
  return value;
}

test("compact drafting keeps actual 40x10 data and Materials while connected selection stays quiet", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  await openPlan(page);

  const first = await drawRigid(page, .36);
  const second = await drawRigid(page, .58);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator(".canvas-toolbar > strong")).toHaveText("139%");
  await expect(first).toHaveAttribute("data-rigid-size", "40×10");
  await expect(first).toHaveAttribute("data-rigid-display-mode", "compact");
  const actualWidth = await numericAttribute(first, "data-rigid-plan-width");
  const compactWidth = await numericAttribute(first, "data-rigid-display-plan-width");
  expect(await numericAttribute(first, "data-rigid-display-screen-width")).toBeCloseTo(8, 2);
  const exactLength = await first.getAttribute("data-rigid-finished-length-feet");
  expect(compactWidth).toBeLessThan(actualWidth * .55);
  await expect(page.getByRole("button", { name: "Rigid: Compact", exact: true })).toBeVisible();

  for (let index = 0; index < 20; index += 1) {
    await page.getByRole("button", { name: "Zoom in" }).click();
  }
  await expect(page.locator(".canvas-toolbar > strong")).toHaveText("1200%");
  expect(await numericAttribute(first, "data-rigid-display-screen-width")).toBeCloseTo(8, 2);

  await page.getByRole("button", { name: "Rigid: Compact", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rigid: True width", exact: true })).toBeVisible();
  await expect(first).toHaveAttribute("data-rigid-display-mode", "true-width");
  expect(await numericAttribute(first, "data-rigid-display-plan-width")).toBeCloseTo(actualWidth, 3);
  await expect(first).toHaveAttribute("data-rigid-size", "40×10");
  await expect(first).toHaveAttribute("data-rigid-finished-length-feet", exactLength || "");
  await page.getByRole("button", { name: "Rigid: True width", exact: true }).click();
  await expect(first).toHaveAttribute("data-rigid-display-mode", "compact");

  await page.getByRole("button", { name: "Materials", exact: true }).click();
  const materialRow = page.locator(".takeoff-row").filter({ hasText: "Rectangular sheet-metal duct" });
  await expect(materialRow).toHaveCount(1);
  await expect(materialRow).toContainText("40×10");
  await materialRow.getByRole("button", { name: "Show on plan" }).click();
  await expect(page.locator("svg.connected-assembly-selection")).toBeVisible();
  await expect(page.locator("g.rigid-duct.active-plan-selection")).toHaveCount(1);
  await expect(page.locator("g.rigid-duct.assembly-plan-selection")).toHaveCount(1);
  await expect(page.locator("g.rigid-duct.selected-rigid")).toHaveCount(1);
  await expect(second.locator(".rigid-body")).toHaveCSS("opacity", "0.035");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("hvac-plan-studio:rigid-review-refinements"));
    const value = key ? JSON.parse(localStorage.getItem(key) || "{}") : null;
    return value ? { version: value.version, rigidCount: value.drawings?.filter((drawing: { rigid?: unknown }) => drawing.rigid).length } : null;
  });
  expect(saved).toEqual({ version: 11, rigidCount: 2 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await uploadPlan(page);
  const restored = page.locator('g.rigid-duct[data-plan-drawing-id]');
  await expect(restored).toHaveCount(2);
  await expect(restored.first()).toHaveAttribute("data-rigid-size", "40×10");
  await expect(restored.first()).toHaveAttribute("data-rigid-finished-length-feet", exactLength || "");
  await expect(restored.first()).toHaveAttribute("data-rigid-display-mode", "compact");
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 430, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".canvas.has-plan")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("rectangular, round metal, and spiral stay compact but retain distinct truthful symbols", async ({ page }) => {
  await openPlan(page);
  const rectangular = await drawRigid(page, .28, { width: "40", height: "10" });
  const round = await drawRigid(page, .50, { construction: "round-metal", diameter: "18" });
  const spiral = await drawRigid(page, .72, { construction: "spiral", diameter: "18" });

  for (const drawing of [rectangular, round, spiral]) {
    await expect(drawing).toHaveAttribute("data-rigid-display-mode", "compact");
    expect(await numericAttribute(drawing, "data-rigid-display-screen-width")).toBeCloseTo(8, 2);
  }
  await expect(rectangular).toHaveAttribute("data-rigid-size", "40×10");
  await expect(round).toHaveAttribute("data-rigid-size", "18");
  await expect(spiral).toHaveAttribute("data-rigid-size", "18");
  await expect(rectangular.locator(".rigid-round-band, .rigid-spiral-seam")).toHaveCount(0);
  expect(await round.locator(".rigid-round-band").count()).toBeGreaterThan(0);
  await expect(round.locator(".rigid-spiral-seam")).toHaveCount(0);
  expect(await spiral.locator(".rigid-spiral-seam").count()).toBeGreaterThan(0);
  await expect(spiral.locator(".rigid-round-band")).toHaveCount(0);

  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await expect(page.locator(".takeoff-row").filter({ hasText: "Rectangular sheet-metal duct" })).toContainText("40×10");
  await expect(page.locator(".takeoff-row").filter({ hasText: "Round metal pipe" })).toContainText("18");
  await expect(page.locator(".takeoff-row").filter({ hasText: "Spiral pipe" })).toContainText("18");
});

test("45 degree elbow click keeps its outlet cue and keyboard continuation is one Undo", async ({ page }) => {
  await openPlan(page);
  const straight = await drawRigid(page, .46);
  await page.getByRole("navigation", { name: "Plan workflow" }).getByRole("button", { name: "Selected", exact: true }).click();
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  const editor = tools.locator(".rigid-elbow-editor");
  await editor.getByLabel("Straight end").selectOption("end");
  await editor.getByLabel("Angle").selectOption("45");
  await editor.getByLabel("Turn").selectOption("right");
  await editor.getByLabel("Inlet takeout, in").fill("12");
  await editor.getByLabel("Outlet takeout, in").fill("18");
  await editor.getByRole("button", { name: "Add 45° elbow" }).click();

  const elbow = page.locator('g.rigid-elbow[data-rigid-angle="45"]');
  await expect(elbow).toHaveCount(1);
  await elbow.focus();
  const handle = elbow.locator('[data-rigid-continuation-handle="outlet"]');
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  if (!box) throw new Error("45 degree elbow outlet has no browser bounds");
  expect(box.width).toBeGreaterThanOrEqual(55);
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.click(center.x, center.y);
  await expect(page.locator('g.rigid-duct[data-plan-drawing-id]')).toHaveCount(1);
  await expect(elbow).toHaveAttribute("aria-pressed", "true");
  await expect(handle).toBeVisible();
  await page.getByRole("navigation", { name: "Plan workflow" }).getByRole("button", { name: "Selected", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "HVAC plan tools" }).locator(".rigid-properties")).toContainText("A click keeps the elbow selected and changes nothing");

  const properties = tools.locator(".rigid-properties");
  await expect(properties).toContainText("fitting centerline takeouts");
  await expect(properties).toContainText("not rectangular duct width or height");
  await properties.getByLabel("Finished straight, ft").fill("7.5");
  await properties.getByRole("button", { name: "Add straight from outlet" }).focus();
  await page.keyboard.press("Enter");
  const continuation = page.locator('g.rigid-duct[data-plan-drawing-id]').last();
  await expect(page.locator('g.rigid-duct[data-plan-drawing-id]')).toHaveCount(2);
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connected", "true");
  await expect(continuation).toHaveAttribute("data-rigid-start-connected", "true");
  await expect(continuation).toHaveAttribute("data-rigid-finished-length-feet", "7.500");
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('g.rigid-duct[data-plan-drawing-id]')).toHaveCount(1);
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connected", "false");
  await expect(straight).toHaveAttribute("data-rigid-end-connected", "true");
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator('g.rigid-duct[data-plan-drawing-id]')).toHaveCount(2);
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connected", "true");
});
