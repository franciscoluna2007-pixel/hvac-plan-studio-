import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("reserves plan panning for a stable right-click drag", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /if \(!pdf \|\| event\.button !== 2 \|\| draft\.length\) return;/);
  assert.match(source, /pan\.frameId = requestAnimationFrame\(\(\) =>/);
  assert.doesNotMatch(source, /naturalLeftPan|spacePanRef|panMomentumRef/);
  assert.match(source, /Right-click drag pans anywhere · left-click selects\/draws/);
  assert.match(source, /Right-click and drag anywhere to pan the plan\. Left-click stays reserved for drawing and selecting\./);
});

test("provides a searchable HVAC catalog and wheel rotation before placement", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const presetCount = [...source.matchAll(/\{ id: "(?:supply|return|equipment|device|control)-/g)].length;

  assert.ok(presetCount >= 80, `expected at least 80 HVAC presets, found ${presetCount}`);
  assert.match(source, /function symbolFamily\(preset: SymbolPreset\)/);
  assert.match(source, /className="symbol-catalog-grid"/);
  assert.match(source, /Search name, size or family/);
  assert.match(source, /if \(symbolPreview && symbolTools\.includes\(activeTool as SymbolKind\)\)/);
  assert.match(source, /setPlacementRotation\(\(current\) => \(current \+ direction \* step \+ 360\) % 360\)/);
  assert.match(source, /rotation: placementRotation/);
  assert.match(source, /Shift\+wheel 45°/);
});

test("places T/Y fittings anywhere on a trunk and supports a second-click branch attachment", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const \[pendingBranchFittingId, setPendingBranchFittingId\]/);
  assert.match(source, /function attachPendingBranchRun\(point: Point\)/);
  assert.match(source, /connectedIds: \[upstream\.id, downstream\.id, branchRun\?\.id \|\| ""\]/);
  assert.match(source, /Trunk split and fitting placed · now click any blue branch run to attach Port 3/);
  assert.match(source, /Pick Port 3 run on plan/);
  assert.match(source, /Place fitting on any supply run/);
  assert.doesNotMatch(source, /No crossing route found · move the fitting closer to both existing runs/);
});

test("guides T/Y placement with numbered ports, endpoint previews, and recovery actions", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /className={`branch-workflow-hud/);
  assert.match(source, /Pick trunk/);
  assert.match(source, /Split \+ place/);
  assert.match(source, /Attach Port 3/);
  assert.match(source, /candidateEndpoint:/);
  assert.match(source, /THIS END MOVES TO PORT 3/);
  assert.match(source, /BRANCH RUN SELECTED/);
  assert.match(source, /Change Port 3/);
  assert.match(source, /Undo connection/);
  assert.match(source, /connection-confirmed-label/);
  assert.match(styles, /\.branch-fitting \.connected-port \.fitting-port/);
  assert.match(styles, /\.branch-fitting \.disconnected-port \.fitting-port/);
});

test("supports a continuous branch pass with manual junction suggestions", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /type BranchOpportunity =/);
  assert.match(source, /function branchOpportunities\(\): BranchOpportunity\[\]/);
  assert.match(source, /function focusNextBranchOpportunity\(opportunities = branchOpportunities\(\)\)/);
  assert.match(source, /Find next suggested T\/Y/);
  assert.match(source, /Next suggested T\/Y/);
  assert.match(source, /Suggestions only highlight likely junctions\. You confirm every fitting\./);
  assert.match(source, /className="branch-opportunity-marker"/);
  assert.match(source, /SUGGESTED T\/Y/);
  assert.match(source, /Branch pass continues/);
  assert.match(styles, /\.branch-pass-summary/);
  assert.match(styles, /\.branch-opportunity-marker circle/);
});

test("includes distinct vertical equipment symbols with supply and return plenums", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /id: "equipment-vertical-airhandler"/);
  assert.match(source, /id: "equipment-vertical-furnace"/);
  assert.match(source, /variant === "vertical-air-handler"/);
  assert.match(source, /variant === "vertical-furnace"/);
  assert.match(source, /className="supply-plenum vertical-plenum"/);
  assert.match(source, /className="return-plenum vertical-plenum"/);
});

test("provides a reviewed system airflow setup without automatic duct edits", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /function airflowSetupSummary\(\)/);
  assert.match(source, /const targetCfm = equipment\.reduce/);
  assert.match(source, /function updateActiveSystemTonnage\(tons: number\)/);
  assert.match(source, /Primary equipment tonnage · 400 CFM per ton/);
  assert.match(source, /Supply scheduled/);
  assert.match(source, /Return scheduled/);
  assert.match(source, /Even-division values are coordination checks—not room-load calculations/);
  assert.match(source, /no duct sizes changed/);
  assert.match(source, /size recommendation/);
  assert.match(styles, /\.system-airflow-setup/);
  assert.match(styles, /\.airflow-balance-grid/);
  assert.match(styles, /\.airflow-progress-row/);
});

test("builds a reviewed room-by-room balancing workspace", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /SYSTEM BALANCING WORKSPACE/);
  assert.match(source, /function suggestedRoomAirflowTargets\(/);
  assert.match(source, /function terminalCfmProposals\(/);
  assert.match(source, /function applySelectedCfmProposals\(/);
  assert.match(source, /Net room air/);
  assert.match(source, /Equal splits are proposals—not room-load calculations/);
  assert.match(source, /System return total/);
  assert.match(source, /Recalculate targets/);
  assert.match(source, /Apply \{selectedCfmProposalIds\.length\} selected CFM/);
  assert.match(styles, /\.balance-workspace/);
  assert.match(styles, /\.balance-room-card/);
  assert.match(styles, /\.cfm-review-tray/);
  assert.match(styles, /\.balance-run-row/);
});

test("keeps airflow calculations safe and auxiliary equipment out of design CFM", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /const primaryAirflowEquipmentVariants = new Set/);
  assert.match(source, /"vertical-air-handler"/);
  assert.match(source, /"vertical-furnace"/);
  const primaryVariants = source.match(/const primaryAirflowEquipmentVariants = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
  assert.doesNotMatch(primaryVariants, /"condenser"|"heat-pump"|"mini-split"/);
  assert.match(source, /isPrimaryAirflowEquipment\(drawing\) && drawingSystem\(drawing\) === activeSystem/);
  assert.match(source, /const allowedResidentialFlexSizes = \["4", "6", "7", "8", "10", "12", "14", "16"\]/);
  assert.match(source, /allowedResidentialFlexSizes\.includes\(residentialFlexMax\)/);
  assert.match(source, /setSelectedSizingIds\(\[\]\)/);
  assert.match(source, /REFERENCE EQUIPMENT/);
  assert.match(source, /excluded from indoor design airflow/);
  assert.match(styles, /\.auxiliary-equipment-note/);

  const networkBody = source.slice(
    source.indexOf("function calculateAirflowNetwork()"),
    source.indexOf("function airflowNetwork()"),
  );
  assert.doesNotMatch(networkBody, /const nearest|const candidates/);
});

test("builds a prioritized plan review queue with hard critical blockers", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /SMART PLAN REVIEW/);
  assert.match(source, /function reviewedIssueRows\(issues = validationIssues\(\)\)/);
  assert.match(source, /linkedRfi && \["approved", "closed"\]\.includes\(linkedRfi\.status\)/);
  assert.match(source, /linkedPunch\?\.status === "resolved"/);
  assert.match(source, /const resolvedByDecision = issue\.severity !== "critical" && Boolean\(decisionComplete\)/);
  assert.match(source, /Critical issues stay open until the drawing condition is fixed/);
  assert.match(source, /Accept with note/);
  assert.match(source, /Create RFI/);
  assert.match(source, /Add punch item/);
  assert.match(source, /Show plan issue markers/);
  assert.match(source, /function reviewIssueReference\(issue: ValidationIssue\)/);
  assert.match(source, /PENDING CLOSEOUT/);
  assert.match(source, /if \(event\.button !== 0\) return;/);
  assert.match(styles, /\.review-queue-row/);
  assert.match(styles, /\.review-marker\.critical/);
  assert.match(styles, /\.recorded-decision\.pending/);
});

test("jumps review and field links to the correct drawing sheet", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /function focusDrawingOnPlan\(drawingId: string\)/);
  assert.match(source, /pendingFocusRef\.current = \{ page: drawing\.page, point \}/);
  assert.match(source, /renderedPageNumber !== drawing\.page/);
  assert.match(source, /pending\.page !== pageNumber \|\| renderedPageNumber !== pageNumber/);
  assert.match(source, /x: viewport\.clientWidth \/ 2 - point\.x \* zoomRef\.current/);
  assert.match(source, /focusDrawingOnPlan\(item\.drawingId\)/);
  assert.match(source, /focusDrawingOnPlan\(run\.drawing\.id\)/);
});

test("uses per-system release checklists and fingerprinted field revisions", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /fieldChecklistBySystem\?: Record<string, Record<string, boolean>>/);
  assert.match(source, /project\.fieldChecklistBySystem \|\| \(project\.fieldChecklist \? \{ "system-1": project\.fieldChecklist \} : \{\}\)/);
  assert.match(source, /function systemDrawingSignature\(systemId = activeSystem\)/);
  assert.match(source, /function systemReleaseSignature\(systemId = activeSystem\)/);
  assert.match(source, /pdfFingerprint/);
  assert.match(source, /scaleVerified/);
  assert.match(source, /const stale = Boolean\(latestRelease && \(!signatureMatches \|\| !gatesClear\)\)/);
  assert.match(source, /gateSnapshot: summary\.gates\.map/);
  assert.match(source, /issueSnapshot: activeReviewedIssueRows\.map/);
  assert.match(source, /Every release stores a drawing fingerprint/);
  assert.match(source, /ISSUE CONTROLLED FIELD REVISION/);
  assert.match(source, /function exportReleaseManifestCsv\(\)/);
  assert.match(source, /RFI &amp; CHANGE LOG/);
  assert.doesNotMatch(source, /checked=\{Boolean\(fieldChecklist\[/);
  assert.match(styles, /\.release-approval-card/);
  assert.match(styles, /\.release-history/);
});

test("blocks orphan runs and preserves device face and neck sizes in takeoff", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /function buildFieldConnectionModel\(systemId: string\)/);
  assert.match(source, /const physicallyAttached = \[run\.points\[0\], run\.points\[run\.points\.length - 1\]\]\.some/);
  assert.match(source, /const connected = !hasFittingProblem/);
  assert.match(source, /connected: connection\.connected/);
  assert.match(source, /Open or detached T\/Y port/);
  assert.match(source, /const neckSize = drawing\.symbol\?\.neckSize/);
  assert.match(source, /Supply can \/ plenum box", size: `Ø\$\{group\.neckSize\}" neck`/);
  assert.match(source, /`\$\{group\.size\} face · match \$\{group\.label\.toLowerCase\(\)\}`/);
  assert.match(source, />Review connected sizes</);
  assert.match(source, />Review CFM split</);
});

test("requires traceable RFI approvals and invalidates changed responses", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /approvalBy\?: string/);
  assert.match(source, /approvedAt\?: string/);
  assert.match(source, /if \(approvalContentChanged && \["approved", "closed"\]\.includes\(item\.status\)\)/);
  assert.match(source, /next\.status = "answered"/);
  assert.match(source, /if \(!next\.response\.trim\(\) \|\| !next\.approvalBy\?\.trim\(\)\) return item/);
  assert.match(source, /Approved · response \+ name required/);
  assert.match(source, /Closed · approval required/);
});

test("provides touch-sized review controls and a mobile full-panel workflow", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /@media \(pointer: coarse\)/);
  assert.match(styles, /\.workspace-subtabs button,[\s\S]*min-height: 44px/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\.app-shell\.wide-inspector \.canvas-area \{ display: none; \}/);
  assert.match(styles, /\.app-shell\.wide-inspector \.right-panel \{ width: 100%; height: 100%;/);
});
