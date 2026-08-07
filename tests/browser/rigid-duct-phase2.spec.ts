import { expect, test, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

test.setTimeout(90_000);

const planBytes = (() => {
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("Rigid duct Phase 2 topology fixture", 72, 72);
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
    name: "rigid-phase2-topology.pdf",
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

test("explicit rigid elbow continues by press-drag-release with reciprocal topology and atomic Undo", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  await openPlan(page);

  await page.getByRole("button", { name: "Draw HVAC", exact: true }).click();
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  await tools.locator(".rigid-duct-tool").getByLabel("Construction").selectOption("rectangular");
  await tools.locator(".rigid-duct-tool").getByRole("button", { name: "Draw straight rigid duct" }).click();
  const start = await planPoint(page, .25, .44);
  const end = await planPoint(page, .70, .44);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();

  const straight = page.locator('g.rigid-duct[data-plan-drawing-id]').first();
  await expect(straight).toHaveAttribute("data-rigid-length-status", "ready");
  const centerlineFeet = Number(await straight.getAttribute("data-rigid-length-feet"));

  await page.getByRole("navigation", { name: "Plan workflow" }).getByRole("button", { name: "Selected", exact: true }).click();
  const editor = page.getByRole("complementary", { name: "HVAC plan tools" }).locator(".rigid-elbow-editor");
  await editor.getByLabel("Straight end").selectOption("end");
  await editor.getByLabel("Angle").selectOption("90");
  await editor.getByLabel("Turn").selectOption("right");
  await editor.getByLabel("Elbow type").selectOption("radius");
  await editor.getByLabel("Inlet takeout, in").fill("12");
  await editor.getByLabel("Outlet takeout, in").fill("18");
  await editor.getByRole("button", { name: "Add 90° elbow" }).click();

  const elbow = page.locator('g.rigid-elbow[data-rigid-fitting="elbow"]');
  await expect(elbow).toHaveCount(1);
  await expect(elbow).toHaveAttribute("data-rigid-angle", "90");
  await expect(elbow).toHaveAttribute("data-rigid-inlet-connected", "true");
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connected", "false");
  await expect(elbow.locator(".rigid-elbow-port-status .connected")).toHaveCount(1);
  await expect(elbow.locator(".rigid-elbow-port-status .open")).toHaveCount(1);
  await expect(straight).toHaveAttribute("data-rigid-length-status", "ready");
  expect(Number(await straight.getAttribute("data-rigid-finished-length-feet"))).toBeCloseTo(centerlineFeet - 1, 2);

  const originalVertex = await elbow.getAttribute("data-rigid-vertex");
  await page.getByRole("button", { name: "Draw HVAC", exact: true }).click();
  await page.getByRole("complementary", { name: "HVAC plan tools" }).getByRole("button", { name: "Select", exact: true }).click();
  const hitBox = await straight.locator(".rigid-hit").boundingBox();
  if (!hitBox) throw new Error("Rigid straight hit target is missing");
  await page.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(hitBox.x + hitBox.width / 2 + 28, hitBox.y + hitBox.height / 2 + 20, { steps: 6 });
  await page.mouse.up();
  await expect(elbow).not.toHaveAttribute("data-rigid-vertex", originalVertex || "");
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(elbow).toHaveAttribute("data-rigid-vertex", originalVertex || "");

  await elbow.focus();
  await page.getByRole("navigation", { name: "Plan workflow" }).getByRole("button", { name: "Selected", exact: true }).click();
  const fittingProperties = page.getByRole("complementary", { name: "HVAC plan tools" }).locator(".rigid-properties");
  await fittingProperties.getByLabel("Inlet takeout, in").fill("24");
  await fittingProperties.getByLabel("Inlet takeout, in").press("Enter");
  expect(Number(await straight.getAttribute("data-rigid-finished-length-feet"))).toBeCloseTo(centerlineFeet - 2, 2);
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  expect(Number(await straight.getAttribute("data-rigid-finished-length-feet"))).toBeCloseTo(centerlineFeet - 1, 2);

  await elbow.focus();
  const continuationHandle = elbow.locator('[data-rigid-continuation-handle="outlet"]');
  await expect(continuationHandle).toBeVisible();
  const continuationBox = await continuationHandle.boundingBox();
  if (!continuationBox) throw new Error("Open elbow continuation handle is missing browser bounds");
  const continuationStart = {
    x: continuationBox.x + continuationBox.width / 2,
    y: continuationBox.y + continuationBox.height / 2,
  };
  await page.mouse.move(continuationStart.x, continuationStart.y);
  await page.mouse.down();
  await page.mouse.move(continuationStart.x, continuationStart.y + 160, { steps: 10 });
  await page.mouse.up();

  const rigidStraights = page.locator('g.rigid-duct[data-plan-drawing-id]');
  await expect(rigidStraights).toHaveCount(2);
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connected", "true");
  const continuation = rigidStraights.last();
  await expect(continuation).toHaveAttribute("data-rigid-start-connected", "true");
  await expect(continuation).toHaveAttribute("data-rigid-end-connected", "false");
  await expect(continuation).toHaveAttribute("data-rigid-length-status", "ready");
  const continuationCenterline = Number(await continuation.getAttribute("data-rigid-length-feet"));
  expect(Number(await continuation.getAttribute("data-rigid-finished-length-feet"))).toBeCloseTo(continuationCenterline - 1.5, 2);

  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(rigidStraights).toHaveCount(1);
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connected", "false");
  await elbow.focus();
  await expect(elbow.locator('[data-rigid-continuation-handle="outlet"]')).toBeVisible();
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Redo", exact: true }).click();
  await expect(rigidStraights).toHaveCount(2);
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connected", "true");

  const continuationEndBeforeEdit = await continuation.getAttribute("data-rigid-end");
  await continuation.focus();
  const freeEndpoint = continuation.locator(".rigid-endpoint-hit").nth(1);
  const freeEndpointBox = await freeEndpoint.boundingBox();
  if (!freeEndpointBox) throw new Error("Continuation free endpoint is missing browser bounds");
  await page.mouse.move(freeEndpointBox.x + freeEndpointBox.width / 2, freeEndpointBox.y + freeEndpointBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(freeEndpointBox.x + freeEndpointBox.width / 2 + 45, freeEndpointBox.y + freeEndpointBox.height / 2 + 70, { steps: 8 });
  await page.mouse.up();
  await expect(continuation).not.toHaveAttribute("data-rigid-end", continuationEndBeforeEdit || "");
  const elbowVertex = (await elbow.getAttribute("data-rigid-vertex"))?.split(",").map(Number);
  const continuedStart = (await continuation.getAttribute("data-rigid-start"))?.split(",").map(Number);
  const continuedEnd = (await continuation.getAttribute("data-rigid-end"))?.split(",").map(Number);
  expect(continuedStart?.[0]).toBeCloseTo(elbowVertex?.[0] || 0, 2);
  expect(continuedStart?.[1]).toBeCloseTo(elbowVertex?.[1] || 0, 2);
  expect(continuedEnd?.[0]).toBeCloseTo(elbowVertex?.[0] || 0, 2);
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(continuation).toHaveAttribute("data-rigid-end", continuationEndBeforeEdit || "");

  await elbow.focus();
  await page.keyboard.press("Delete");
  await expect(elbow).toHaveCount(0);
  await expect(straight).toHaveAttribute("data-rigid-finished-length-feet", centerlineFeet.toFixed(3));
  await expect(continuation).toHaveAttribute("data-rigid-start-connected", "false");
  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(elbow).toHaveCount(1);
  await expect(continuation).toHaveAttribute("data-rigid-start-connected", "true");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const storedVersion = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("hvac-plan-studio:rigid-phase2-topology"));
    return key ? JSON.parse(localStorage.getItem(key) || "{}").version : null;
  });
  expect(storedVersion).toBe(11);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({ name: "rigid-phase2-topology.pdf", mimeType: "application/pdf", buffer: planBytes });
  await expect(page.locator('g.rigid-elbow[data-rigid-fitting="elbow"]')).toHaveCount(1);
  await expect(page.locator('g.rigid-duct[data-plan-drawing-id]')).toHaveCount(2);
  await expect(page.locator('g.rigid-elbow[data-rigid-fitting="elbow"]')).toHaveAttribute("data-rigid-outlet-connected", "true");

  await page.getByRole("button", { name: "Materials", exact: true }).click();
  const elbowRow = page.locator(".takeoff-row").filter({ hasText: "90° Rectangular sheet-metal radius elbow" });
  await expect(elbowRow).toHaveCount(1);
  await expect(elbowRow).toContainText("1");

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".rigid-elbow-port-status")).toHaveCSS("display", "none");
  expect(errors).toEqual([]);
});
