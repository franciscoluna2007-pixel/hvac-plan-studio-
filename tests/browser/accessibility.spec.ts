import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("project home reports accessibility violations and blocks critical failures", async ({ page }, testInfo) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Open a plan", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();

  const blockingViolations = results.violations.filter((violation) => violation.impact === "critical");

  await testInfo.attach("axe-accessibility-report", {
    body: Buffer.from(JSON.stringify(results.violations, null, 2)),
    contentType: "application/json",
  });

  const seriousCount = results.violations.filter((violation) => violation.impact === "serious").length;
  if (seriousCount > 0) {
    testInfo.annotations.push({
      type: "accessibility-backlog",
      description: `${seriousCount} serious axe rule groups require follow-up`,
    });
  }

  expect(pageErrors).toEqual([]);
  expect(blockingViolations).toEqual([]);
});
