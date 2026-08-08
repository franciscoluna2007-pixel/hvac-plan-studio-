import { expect, test, type Locator, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

type ScreenPoint = { x: number; y: number };

async function openBlankPlan(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("Snap index intersection browser fixture", 72, 72);
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "snap-index-intersection.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  });
  await expect(page.locator(".canvas.has-plan svg.drawing-layer")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
  await page.getByRole("button", { name: "100%", exact: true }).click();
}

async function pointOnPlan(page: Page, xRatio: number, yRatio: number): Promise<ScreenPoint> {
  const box = await page.locator("svg.drawing-layer").boundingBox();
  if (!box) throw new Error("Plan SVG has no browser bounds");
  return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
}

async function createSupplyRun(page: Page, start: ScreenPoint, end: ScreenPoint) {
  const runs = page.locator('g[data-plan-drawing-id]:has(> path.hit-line)');
  const before = await runs.count();
  await page
    .getByRole("complementary", { name: "HVAC plan tools" })
    .getByRole("button", { name: /^Supply run/ })
    .click();
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(end.x, end.y);
  await page.mouse.click(end.x, end.y, { button: "right" });
  await expect(runs).toHaveCount(before + 1);
  return runs.nth(before);
}

async function pathPoint(path: Locator, fraction: number): Promise<ScreenPoint> {
  return path.evaluate((element, position) => {
    const svgPath = element as SVGPathElement;
    const point = svgPath.getPointAtLength(svgPath.getTotalLength() * position);
    return { x: point.x, y: point.y };
  }, fraction);
}

async function pathEndpoints(path: Locator) {
  return {
    start: await pathPoint(path, 0),
    end: await pathPoint(path, 1),
  };
}

function segmentCrossing(
  first: Awaited<ReturnType<typeof pathEndpoints>>,
  second: Awaited<ReturnType<typeof pathEndpoints>>,
) {
  const denominator = (first.start.x - first.end.x) * (second.start.y - second.end.y)
    - (first.start.y - first.end.y) * (second.start.x - second.end.x);
  if (Math.abs(denominator) < 0.001) return null;
  const t = ((first.start.x - second.start.x) * (second.start.y - second.end.y)
    - (first.start.y - second.start.y) * (second.start.x - second.end.x)) / denominator;
  const u = -((first.start.x - first.end.x) * (first.start.y - second.start.y)
    - (first.start.y - first.end.y) * (first.start.x - second.start.x)) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return {
    x: first.start.x + t * (first.end.x - first.start.x),
    y: first.start.y + t * (first.end.y - first.start.y),
  };
}

async function planPointToScreen(page: Page, point: ScreenPoint): Promise<ScreenPoint> {
  return page.locator("svg.drawing-layer").evaluate((element, planPoint) => {
    const svg = element as SVGSVGElement;
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error("Plan SVG has no screen transform");
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = planPoint.x;
    svgPoint.y = planPoint.y;
    const screenPoint = svgPoint.matrixTransform(matrix);
    return { x: screenPoint.x, y: screenPoint.y };
  }, point);
}

test("a loaded plan snaps a new supply run to a Flatbush-indexed run intersection", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await openBlankPlan(page);

  const horizontal = await createSupplyRun(
    page,
    await pointOnPlan(page, 0.25, 0.5),
    await pointOnPlan(page, 0.75, 0.5),
  );
  const vertical = await createSupplyRun(
    page,
    await pointOnPlan(page, 0.5, 0.25),
    await pointOnPlan(page, 0.5, 0.75),
  );
  const crossing = segmentCrossing(
    await pathEndpoints(horizontal.locator("path.hit-line")),
    await pathEndpoints(vertical.locator("path.hit-line")),
  );
  expect(crossing).not.toBeNull();
  if (!crossing) throw new Error("Fixture runs did not cross");

  const crossingScreenPoint = await planPointToScreen(page, crossing);
  await page
    .getByRole("complementary", { name: "HVAC plan tools" })
    .getByRole("button", { name: /^Supply run/ })
    .click();
  await page.mouse.move(crossingScreenPoint.x + 7, crossingScreenPoint.y + 5);
  const marker = page.locator("g.snap-marker.snap-intersection");
  await expect(marker).toBeVisible();
  await expect(marker.locator("text")).toHaveText("INTERSECTION");

  await page.mouse.click(crossingScreenPoint.x + 7, crossingScreenPoint.y + 5);
  const newEnd = await pointOnPlan(page, 0.72, 0.7);
  await page.mouse.click(newEnd.x, newEnd.y);
  await page.mouse.click(newEnd.x, newEnd.y, { button: "right" });

  const runs = page.locator('g[data-plan-drawing-id]:has(> path.hit-line)');
  await expect(runs).toHaveCount(3);
  const committedStart = await pathPoint(runs.nth(2).locator("path.hit-line"), 0);
  expect(Math.hypot(committedStart.x - crossing.x, committedStart.y - crossing.y)).toBeLessThan(0.5);

  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(runs).toHaveCount(2);
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
