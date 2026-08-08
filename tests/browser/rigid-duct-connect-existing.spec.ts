import { expect, test, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

test.setTimeout(90_000);

const planBytes = (() => {
  const pdf = new jsPDF({ unit: "pt", format: [792, 612], orientation: "landscape" });
  pdf.text("Rigid connect-existing review fixture", 72, 72);
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
    name: "rigid-connect-existing.pdf",
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

test("Connect existing reviews endpoint ownership, cancels safely, persists reciprocal topology, and is one Undo", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  await openPlan(page);

  await page.getByRole("button", { name: "Draw HVAC", exact: true }).click();
  const tools = page.getByRole("complementary", { name: "HVAC plan tools" });
  const rigidTool = tools.locator(".rigid-duct-tool");
  await rigidTool.getByLabel("Construction").selectOption("rectangular");
  await rigidTool.getByRole("button", { name: "Draw straight rigid duct" }).click();
  const upstreamStart = await planPoint(page, .25, .40);
  const upstreamEnd = await planPoint(page, .64, .40);
  await page.mouse.move(upstreamStart.x, upstreamStart.y);
  await page.mouse.down();
  await page.mouse.move(upstreamEnd.x, upstreamEnd.y, { steps: 8 });
  await page.mouse.up();

  const straights = page.locator('g.rigid-duct[data-plan-drawing-id]');
  await expect(straights).toHaveCount(1);
  const upstream = straights.first();
  await page.getByRole("navigation", { name: "Plan workflow" }).getByRole("button", { name: "Selected", exact: true }).click();
  const elbowEditor = tools.getByRole("group", { name: "Add an explicit elbow" });
  await elbowEditor.getByLabel("Straight end").selectOption("end");
  await elbowEditor.getByLabel("Angle").selectOption("90");
  await elbowEditor.getByLabel("Turn").selectOption("right");
  await elbowEditor.getByLabel("Elbow type").selectOption("radius");
  await elbowEditor.getByLabel("Inlet takeout, in").fill("12");
  await elbowEditor.getByLabel("Outlet takeout, in").fill("18");
  await elbowEditor.getByRole("button", { name: "Add 90° elbow" }).click();

  const elbow = page.locator('g.rigid-elbow[data-rigid-fitting="elbow"]');
  await expect(elbow).toHaveCount(1);
  const elbowId = await elbow.getAttribute("data-plan-drawing-id");
  const upstreamId = await upstream.getAttribute("data-plan-drawing-id");
  expect(elbowId).toBeTruthy();
  expect(upstreamId).toBeTruthy();

  const outletHandle = elbow.locator('[data-rigid-continuation-handle="outlet"]');
  const outletBox = await outletHandle.boundingBox();
  if (!outletBox) throw new Error("Open elbow outlet has no browser bounds");
  const outlet = { x: outletBox.x + outletBox.width / 2, y: outletBox.y + outletBox.height / 2 };

  await page.getByRole("button", { name: "Draw HVAC", exact: true }).click();
  await rigidTool.getByRole("button", { name: "Draw straight rigid duct" }).click();
  await page.mouse.move(outlet.x, outlet.y);
  await page.mouse.down();
  await page.mouse.move(outlet.x, outlet.y + 180, { steps: 10 });
  await page.mouse.up();
  await expect(straights).toHaveCount(2);

  const candidate = straights.last();
  const candidateId = await candidate.getAttribute("data-plan-drawing-id");
  const candidateStartBefore = await candidate.getAttribute("data-rigid-start");
  const candidateEndBefore = await candidate.getAttribute("data-rigid-end");
  expect(candidateId).toBeTruthy();
  await expect(candidate).toHaveAttribute("data-rigid-start-connected", "false");
  await expect(candidate).toHaveAttribute("data-rigid-end-connected", "false");

  await elbow.focus();
  await page.getByRole("navigation", { name: "Plan workflow" }).getByRole("button", { name: "Selected", exact: true }).click();
  const reviewSection = tools.getByRole("region", { name: "Connect an existing rigid straight" });
  await expect(reviewSection).toContainText("1 SAFE ENDPOINT");
  const reviewButton = reviewSection.getByRole("button", { name: "Review existing straight" });
  await expect(reviewButton).toBeEnabled();
  await reviewButton.click();

  await expect(reviewSection).toContainText("Elbow vertex and outlet axis stay fixed");
  await expect(reviewSection).toContainText("One Undo restores both objects");
  await expect(page.locator('[data-rigid-connect-preview="true"]')).toBeVisible();
  await expect(candidate).toHaveClass(/rigid-connect-candidate/);

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-rigid-connect-preview="true"]')).toHaveCount(0);
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connected", "false");
  await expect(candidate).toHaveAttribute("data-rigid-start-connected", "false");
  await expect(candidate).toHaveAttribute("data-rigid-start", candidateStartBefore || "");
  await expect(candidate).toHaveAttribute("data-rigid-end", candidateEndBefore || "");

  await reviewButton.click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator('[data-rigid-connect-preview="true"]')).toHaveCSS("display", "none");
  await page.emulateMedia({ media: "screen" });
  await reviewSection.getByRole("button", { name: "Connect existing" }).click();

  await expect(elbow).toHaveAttribute("data-rigid-outlet-connected", "true");
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connection", `${candidateId}:start`);
  await expect(candidate).toHaveAttribute("data-rigid-start-connected", "true");
  await expect(candidate).toHaveAttribute("data-rigid-start-connection", `${elbowId}:outlet`);
  await expect(candidate).toHaveAttribute("data-rigid-end-connected", "false");
  await expect(candidate).not.toHaveAttribute("data-rigid-start", candidateStartBefore || "");
  await expect(candidate).toHaveAttribute("data-rigid-end", candidateEndBefore || "");
  await expect(straights).toHaveCount(2);
  await expect(elbow).toHaveCount(1);

  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connected", "false");
  await expect(candidate).toHaveAttribute("data-rigid-start-connected", "false");
  await expect(candidate).toHaveAttribute("data-rigid-start", candidateStartBefore || "");
  await expect(candidate).toHaveAttribute("data-rigid-end", candidateEndBefore || "");
  await expect(upstream).toHaveAttribute("data-rigid-end-connection", `${elbowId}:inlet`);

  await page.locator(".canvas-edit-actions").getByRole("button", { name: "Redo", exact: true }).click();
  await expect(elbow).toHaveAttribute("data-rigid-outlet-connection", `${candidateId}:start`);
  await expect(candidate).toHaveAttribute("data-rigid-start-connection", `${elbowId}:outlet`);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const savedVersion = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("hvac-plan-studio:rigid-connect-existing"));
    return key ? JSON.parse(localStorage.getItem(key) || "{}").version : null;
  });
  expect(savedVersion).toBe(12);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const input = document.querySelector('input.file-input[type="file"]');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith("__reactProps")));
  });
  await page.locator('input.file-input[type="file"]').setInputFiles({
    name: "rigid-connect-existing.pdf",
    mimeType: "application/pdf",
    buffer: planBytes,
  });
  const restoredElbow = page.locator(`g.rigid-elbow[data-plan-drawing-id="${elbowId}"]`);
  const restoredCandidate = page.locator(`g.rigid-duct[data-plan-drawing-id="${candidateId}"]`);
  await expect(restoredElbow).toHaveAttribute("data-rigid-outlet-connection", `${candidateId}:start`);
  await expect(restoredCandidate).toHaveAttribute("data-rigid-start-connection", `${elbowId}:outlet`);

  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await expect(page.locator(".takeoff-row").filter({ hasText: "Rectangular sheet-metal duct" })).toHaveCount(1);
  await expect(page.locator(".takeoff-row").filter({ hasText: "90° Rectangular sheet-metal radius elbow" })).toHaveCount(1);
  expect(errors).toEqual([]);
});
