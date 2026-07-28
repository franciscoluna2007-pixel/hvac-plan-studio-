import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

async function loadMarkupAssistantModule() {
  const sourcePath = new URL("../app/markupAssistant.ts", import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const isolatedSource = source.replace(
    /import\s*\{[\s\S]*?\}\s*from "\.\/planIntelligence";/,
    `
const findingRecommendedAction = (finding) => \`Review \${finding.title}\`;
const findingWhyItMatters = (finding) => \`Why \${finding.title} matters\`;
const summarizePlanFindings = (findings) => ({
  score: Math.max(0, 100 - findings.filter((finding) => !finding.resolved).length * 10),
});
`,
  );
  assert.notEqual(isolatedSource, source, "the plan-intelligence import should be isolated");

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "markup-assistant-test-"));
  const isolatedPath = join(temporaryDirectory, "markupAssistant.ts");
  await writeFile(isolatedPath, isolatedSource, "utf8");
  try {
    return await loadTypescriptModule(pathToFileURL(isolatedPath));
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

const { buildMarkupRecommendations } = await loadMarkupAssistantModule();

function finding(overrides = {}) {
  return {
    id: "finding-1",
    severity: "info",
    category: "Coordination",
    title: "Coordinate note",
    detail: "A field note needs review.",
    reference: "Sheet M1",
    evidenceFingerprint: "evidence-1",
    resolved: false,
    ...overrides,
  };
}

function build(findings, overrides = {}) {
  return buildMarkupRecommendations({
    findings,
    branchOpportunities: [],
    sizingCandidateCount: 0,
    scaleVerified: true,
    designCfm: 1_200,
    ...overrides,
  });
}

test("recommendation priority is deterministic and independent of input order", () => {
  const rows = [
    finding({
      id: "later",
      title: "Field note",
      evidenceFingerprint: "later-evidence",
    }),
    finding({
      id: "next",
      severity: "warning",
      category: "Return paths",
      title: "Bedroom return path",
      evidenceFingerprint: "next-evidence",
    }),
    finding({
      id: "first",
      severity: "critical",
      category: "Connections",
      title: "Disconnected terminal",
      evidenceFingerprint: "first-evidence",
    }),
    finding({
      id: "resolved",
      severity: "critical",
      category: "Connections",
      title: "Resolved connection",
      evidenceFingerprint: "resolved-evidence",
      resolved: true,
    }),
  ];

  const forward = build(rows);
  const reverse = build(rows.toReversed());

  assert.deepEqual(
    forward.map(({ id, priorityTier, priorityScore }) => ({ id, priorityTier, priorityScore })),
    reverse.map(({ id, priorityTier, priorityScore }) => ({ id, priorityTier, priorityScore })),
  );
  assert.deepEqual(
    forward.map((row) => [row.id, row.priorityTier, row.priorityScore]),
    [
      ["assistant-first", "do-first", 100],
      ["assistant-next", "next", 70],
      ["assistant-later", "later", 30],
      ["assistant-resolved", "later", 0],
    ],
  );
  assert.match(forward[0].priorityReason, /Fix this first/i);
  assert.match(forward[1].priorityReason, /before the field package/i);
});

test("blank terminal-run details create one synthetic field-detail recommendation", () => {
  const recommendations = build([], {
    runNumberCandidateCount: 3,
    runNumberEvidenceFingerprint: "run-number-proof",
  });

  assert.equal(recommendations.length, 1);
  assert.deepEqual(
    {
      id: recommendations[0].id,
      category: recommendations[0].category,
      priorityTier: recommendations[0].priorityTier,
      priorityScore: recommendations[0].priorityScore,
      severity: recommendations[0].severity,
      action: recommendations[0].action,
    },
    {
      id: "assistant-run-details",
      category: "Field details",
      priorityTier: "next",
      priorityScore: 55,
      severity: "warning",
      action: "focus",
    },
  );
  assert.match(recommendations[0].title, /3 terminal runs need field numbers/i);
  assert.match(recommendations[0].evidenceFingerprint, /run-number-proof/);
  assert.deepEqual(recommendations[0].relatedDrawingIds, []);
});

test("zero run-number candidates do not invent a field-detail recommendation", () => {
  const recommendations = build([], {
    runNumberCandidateCount: 0,
    runNumberEvidenceFingerprint: "unused-proof",
  });

  assert.equal(
    recommendations.some((recommendation) => recommendation.id === "assistant-run-details"),
    false,
  );
});
