import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadTypescriptModule } from "./load-typescript-module.mjs";

const source = await readFile(new URL("../app/planSetExport.ts", import.meta.url), "utf8");
const planSet = await loadTypescriptModule(
  new URL("../app/planSetExport.ts", import.meta.url),
);

test("plan-set filename is safe and keeps the PDF extension", () => {
  assert.equal(planSet.safePlanSetFilename("Ella / Easter Plan", "IFC 2"), "Ella-Easter-Plan-IFC-2.pdf");
});

test("title block and scale are reserved for the cover sheet", () => {
  assert.equal(planSet.pageHasPlanTitleBlock(1), true);
  assert.equal(planSet.pageHasPlanTitleBlock(2), false);
  assert.equal(planSet.pageHasPlanTitleBlock(18), false);
  assert.match(source, /document\.addPage\(\[canvas\.width, canvas\.height\]\)/);
  assert.doesNotMatch(source, /document\.addPage\(\[canvas\.width, canvas\.height\], orientation\)/);
});

test("cover title block writes project, revision, and scale with a right-aligned scale field", () => {
  const calls = [];
  const writer = new Proxy({}, {
    get: (_target, method) => (...args) => calls.push([method, ...args]),
  });
  planSet.drawPlanTitleBlock(writer, 1000, 700, {
    projectName: "Ella Easter Plan",
    systemName: "System 1",
    revision: "IFC-2",
    scale: '1/4" = 1\'-0"',
  });
  assert.ok(calls.some(([method, value]) => method === "text" && value === "Ella Easter Plan"));
  assert.ok(calls.some(([method, value]) => method === "text" && value === "System 1   REV IFC-2"));
  assert.ok(calls.some(([method, value, _x, _y, options]) =>
    method === "text" && value === 'SCALE 1/4" = 1\'-0"' && options?.align === "right"));
});

test("email draft contains the reviewed recipient, message, and attached PDF", () => {
  const email = planSet.buildPlanEmailMessage({
    to: "foreman@example.com",
    subject: "Ella plan set",
    message: "Please review the attached plan.",
    filename: "ella-ifc-2.pdf",
    pdfBase64: "JVBERi0xLjQ=",
  });
  assert.match(email, /^To: foreman@example\.com/m);
  assert.match(email, /^Subject: Ella plan set/m);
  assert.match(email, /Content-Type: application\/pdf; name="ella-ifc-2\.pdf"/);
  assert.match(email, /Content-Disposition: attachment; filename="ella-ifc-2\.pdf"/);
  assert.match(email, /Please review the attached plan\./);
  assert.match(email, /JVBERi0xLjQ=/);
});
