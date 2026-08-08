import { expect, test } from "@playwright/test";

const labEnabled = process.env.EXPERIMENT_LAB_BROWSER_ENABLED === "1";

async function openEnabledLab(page: import("@playwright/test").Page) {
  await page.goto("/experiment-lab");
  await expect(page.locator("main.experiment-lab-shell")).toHaveAttribute("data-hydrated", "true");
}

test("default build keeps the Experiment Lab direct route unavailable", async ({ page }) => {
  test.skip(labEnabled, "The separate enabled-route run covers the real Lab UI.");
  const response = await page.goto("/experiment-lab");
  expect(response?.status()).toBe(404);
  await expect(page.getByText(/not found|404/i).first()).toBeVisible();
});

test.describe("Experiment Lab", () => {
  test.skip(!labEnabled, "The Lab UI runs only against an explicitly enabled isolated build.");

  test("live-redraws real geometry and records evidence only after Run", async ({ page }) => {
    const mutatingRequests: string[] = [];
    page.on("request", (request) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
        mutatingRequests.push(`${request.method()} ${request.url()}`);
      }
    });
    await openEnabledLab(page);
    const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));

    await expect(page.getByRole("heading", { name: "Elbow tangent trim" })).toBeVisible();
    await expect(page.getByTestId("baseline-canvas").locator("svg")).toBeVisible();
    await expect(page.getByTestId("candidate-canvas").locator("svg")).toBeVisible();
    const baselineCanvasBox = await page.getByTestId("baseline-canvas").boundingBox();
    const baselineShapeBox = await page.getByTestId("baseline-canvas").locator(".lab-live-centerline").boundingBox();
    expect(baselineShapeBox?.width).toBeGreaterThan((baselineCanvasBox?.width ?? 0) * .3);
    expect(baselineShapeBox?.height).toBeGreaterThan((baselineCanvasBox?.height ?? 0) * .3);
    expect(baselineShapeBox?.width).toBeLessThan((baselineCanvasBox?.width ?? Number.POSITIVE_INFINITY) * .95);
    expect(baselineShapeBox?.height).toBeLessThan((baselineCanvasBox?.height ?? Number.POSITIVE_INFINITY) * .95);
    await expect(page.getByRole("button", { name: "Export evidence" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Copy receipt" })).toBeDisabled();

    const baselinePathBefore = await page.getByTestId("baseline-canvas").locator(".lab-live-centerline").getAttribute("d");
    const candidatePathBefore = await page.getByTestId("candidate-canvas").locator(".lab-live-centerline").getAttribute("d");
    const takeout = page.getByRole("spinbutton", { name: "Outlet takeout" });
    await takeout.fill("36");
    await expect(takeout).toHaveValue("36");
    await expect(page.getByTestId("baseline-canvas").locator(".lab-live-centerline")).not.toHaveAttribute("d", baselinePathBefore ?? "");
    await expect(page.getByTestId("candidate-canvas").locator(".lab-live-centerline")).not.toHaveAttribute("d", candidatePathBefore ?? "");
    await expect(page.getByText("Ready to compare")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export evidence" })).toBeDisabled();

    await page.getByRole("button", { name: "Run comparison" }).click();
    await expect(page.getByText("Last run: match")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export evidence" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Copy receipt" })).toBeEnabled();
    await expect(page.getByTestId("overlay-canvas")).toBeVisible();
    await expect(page.getByRole("table", { name: "Geometry comparison metrics" })).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);
    expect(mutatingRequests).toEqual([]);
  });

  test("rejects an invalid reducer without turning it into positive evidence", async ({ page }) => {
    await openEnabledLab(page);
    await page.getByRole("button", { name: "Rectangular reducer outline" }).click();
    await page.getByRole("spinbutton", { name: "Outlet width" }).fill("36");

    await expect(page.getByTestId("baseline-canvas")).toContainText("cannot be drawn");
    await expect(page.getByTestId("candidate-canvas")).toContainText("cannot be drawn");
    await page.getByRole("button", { name: "Run comparison" }).click();
    await expect(page.getByText("Input rejected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export evidence" })).toBeEnabled();
    await page.getByRole("tab", { name: "Receipt" }).click();
    await expect(page.getByText("invalid-rectangular-reducer")).toBeVisible();
    await expect(page.getByText("Run did not match")).toBeVisible();
  });

  test("invalidates a completed receipt on every geometry input change", async ({ page }) => {
    await openEnabledLab(page);
    await page.getByRole("button", { name: "Run comparison" }).click();
    await expect(page.getByRole("button", { name: "Export evidence" })).toBeEnabled();

    await page.getByRole("spinbutton", { name: "Outlet takeout" }).fill("32");
    await expect(page.getByText("Ready to compare")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export evidence" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Copy receipt" })).toBeDisabled();
    await expect(page.getByTestId("baseline-canvas").locator("svg")).toBeVisible();
    await expect(page.getByTestId("candidate-canvas").locator("svg")).toBeVisible();
  });

  test("keeps live controls before redraws and touch-sized on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openEnabledLab(page);

    const runButton = page.getByRole("button", { name: "Run comparison" });
    const baselineHeading = page.getByText("Product baseline redraw");
    const runBox = await runButton.boundingBox();
    const baselineBox = await baselineHeading.boundingBox();
    expect(runBox?.y).toBeLessThan(baselineBox?.y ?? Number.POSITIVE_INFINITY);
    expect(runBox?.height).toBeGreaterThanOrEqual(48);

    await runButton.click();
    const copyButton = page.getByRole("button", { name: "Copy receipt" });
    const copyBox = await copyButton.boundingBox();
    expect(copyBox?.height).toBeGreaterThanOrEqual(48);
    expect(copyBox?.width).toBeGreaterThanOrEqual(48);
  });

  test("evidence tabs use linked tab semantics and keyboard navigation", async ({ page }) => {
    await openEnabledLab(page);
    const inputs = page.getByRole("tab", { name: "Inputs" });
    await inputs.focus();
    await inputs.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Differences" })).toBeFocused();
    await expect(page.getByRole("tab", { name: "Differences" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "lab-tab-differences");
  });
});
