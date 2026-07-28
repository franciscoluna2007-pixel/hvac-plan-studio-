import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, assistant] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/MarkupAssistantStudio.tsx", import.meta.url), "utf8"),
]);

test("v129 exposes one consistently named Fix Plan route", () => {
  assert.match(page, /id: "check",\s*label: "Fix Plan"/);
  assert.match(page, /id: "markup-assistant",\s*label: "Open Fix Plan"/);
  assert.match(page, />Fix Plan<\/button>/);
  assert.doesNotMatch(page, /label: "Fix Problems"/);
  assert.doesNotMatch(page, />Problems<\/button>/);
  assert.doesNotMatch(page, />Plan problems<\/button>/);
  assert.doesNotMatch(page, /id: "plan-review"/);
  assert.doesNotMatch(page, /Open audit &amp; select first issue/);
  assert.doesNotMatch(page, /setRightTab\("checks"\)/);
  assert.doesNotMatch(page, /className="builder-current-step-summary"/);
  assert.doesNotMatch(page, /className="markup-assistant-launch"/);
});

test("issue routes retain their exact finding and drawing focus in Fix Plan", () => {
  assert.match(
    page,
    /const recommendation = markupRecommendations\.find\(\(candidate\) =>\s*candidate\.findingId === issue\.id/,
  );
  assert.match(page, /openMarkupAssistant\("fix-plan", recommendation\)/);
  assert.match(
    page,
    /focusDrawingOnPlan\(issue\.drawingId!, \{ avoidAssistant: true \}\)/,
  );
  assert.match(page, /focusedRecommendationId=\{assistantFocusedRecommendationId\}/);
  assert.match(page, /setAssistantFocusedRecommendationId\(focusedRecommendation\?\.id \|\| ""\)/);
  assert.match(page, /key=\{`plan-helper:\$\{assistantFocusedRecommendationId \|\| "general"\}`\}/);
  assert.match(assistant, /focusedRecommendationId\?: string/);
  assert.match(assistant, /setActiveFixId\(focusedFixAction\?\.id \|\| ""\)/);
});

test("Show where uses a semantic occluder and one focus path for immediate and cross-page focus", () => {
  assert.match(assistant, /data-plan-occluder="plan-helper"/);
  assert.match(
    page,
    /document\.querySelector<HTMLElement>\('\[data-plan-occluder="plan-helper"\]'\)/,
  );
  assert.match(page, /focusPlanPoint\(pending\.point, \{ avoidAssistant: pending\.avoidAssistant \}\)/);
  assert.match(page, /requestAnimationFrame\(\(\) => focusPlanPoint\(point, options\)\)/);
  assert.match(page, /target\.mode === "close-occluder"[\s\S]*?setShowMarkupAssistant\(false\)/);
  assert.match(page, /onFocusDrawing=\{\(drawingId\) => \{\s*focusDrawingOnPlan\(drawingId, \{ avoidAssistant: true \}\)/);
});
