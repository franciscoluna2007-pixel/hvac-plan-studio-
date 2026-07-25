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

test("adds secure cloud projects, revisions, collaborators, and Drive packages", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/CloudProjectsPanel.tsx", import.meta.url), "utf8");
  const cloud = await readFile(new URL("../app/cloudProjects.ts", import.meta.url), "utf8");
  const drive = await readFile(new URL("../app/googleDrive.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /Project Hub/);
  assert.match(page, /buildProjectSnapshot/);
  assert.match(page, /restoreCloudRevision/);
  assert.match(panel, /Save current plan as project/);
  assert.match(panel, /Save a cloud revision/);
  assert.match(panel, /Invite a collaborator/);
  assert.match(panel, /Create Drive package/);
  assert.match(cloud, /from\("project_revisions"\)/);
  assert.match(cloud, /from\("project_members"\)/);
  assert.match(cloud, /claim_project_invitations/);
  assert.match(drive, /saveProjectPackageToDrive/);
  assert.match(drive, /application\/json/);
  assert.match(styles, /\.cloud-projects-drawer/);
  assert.match(styles, /\.cloud-revision-list/);
});

test("builds v106 Project Home, guided setup, and an RLS-safe cloud summary", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../app/ProjectHome.tsx", import.meta.url), "utf8");
  const setup = await readFile(new URL("../app/GuidedProjectSetup.tsx", import.meta.url), "utf8");
  const cloud = await readFile(new URL("../app/cloudProjects.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260724170000_project_home_cards.sql", import.meta.url), "utf8");

  assert.match(page, /showProjectHome/);
  assert.match(page, /<ProjectHome/);
  assert.match(page, /<GuidedProjectSetup/);
  assert.match(page, /AI Plan Reader v105 · Plan Intelligence v106/);
  assert.match(page, /applyPendingProjectSetup/);
  assert.match(page, /sourceFileName/);
  assert.match(page, /pendingProjectSetupRef\.current = null/);
  assert.match(page, /addEventListener\("cancel", handleFilePickerCancel\)/);
  assert.match(page, /const modalWorkspaceActive = showProjectHome \|\| showProjectSetup \|\| showPlanIntelligence \|\| showFieldPackageComposer \|\| showSystemBalanceStudio/);
  assert.match(page, /inert=\{modalWorkspaceActive \? true : undefined\}/);
  assert.match(home, /Turn HVAC plan PDFs into evidence, markups, and source-backed takeoffs/);
  assert.match(home, /AI plan intelligence &amp; takeoff/);
  assert.doesNotMatch(home, /FIELD PRODUCTION|Field-first workflow|Installer-ready/);
  assert.match(home, /Manual geometry stays manual/);
  assert.match(home, /PLAN REVIEW QUEUE/);
  assert.match(home, /handleDialogKeyDown/);
  assert.match(home, /onOpenProjectHub\(project\.id\)/);
  assert.match(setup, /Guided setup · about 60 seconds/);
  assert.match(setup, /Setup never draws, reroutes, resizes, reconnects, balances, or numbers ductwork/);
  assert.match(setup, /400 CFM per ton/);
  assert.match(setup, /"4\.5"/);
  assert.match(setup, /handleDialogKeyDown/);
  assert.match(cloud, /list_project_home_cards/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /private\.is_project_member\(p\.id\)/);
  assert.match(migration, /revoke all on function public\.list_project_home_cards\(\) from anon/);
  assert.match(styles, /\.project-home-overlay/);
  assert.match(styles, /\.project-setup-overlay/);
  assert.match(styles, /\.project-home-notice/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(layout, /HVAC Plan Studio/);
  assert.doesNotMatch(layout, /Starter Project/);
});

test("keeps the accurate manual takeoff engine while v106 removes field operations from primary navigation", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const cloud = await readFile(new URL("../app/cloudProjects.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260724210000_field_production_takeoff_center.sql", import.meta.url), "utf8");

  assert.match(page, /V106 · PLAN INTELLIGENCE/);
  assert.match(page, /HVAC Takeoff Center/);
  assert.doesNotMatch(page, />Field<\/button>/);
  assert.doesNotMatch(page, /Field mode<\/button>/);
  assert.match(page, /Flex quantity uses your rule/);
  assert.match(page, /Math\.ceil\(orderLength \/ 25\)/);
  assert.match(page, /Your drawing stays manual/);
  assert.match(page, /createTakeoffPackage/);
  assert.match(page, /saveProjectPackageToDrive/);
  assert.match(cloud, /saveCloudTakeoffPackage/);
  assert.match(styles, /\.production-hero/);
  assert.match(styles, /\.package-history/);
  assert.match(migration, /create table if not exists public\.project_takeoff_packages/);
  assert.match(migration, /private\.can_edit_project\(project_id\)/);
  assert.match(migration, /revision\.project_id = project_id/);
});

test("implements the Figma cloud dock, safe restore flow, and distinct terminal can icons", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/CloudProjectsPanel.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /supply-can-square/);
  assert.match(page, /return-can-rect/);
  assert.match(page, /variant === "supply-can"/);
  assert.match(page, /variant === "return-can"/);
  assert.match(page, /cloud-open/);
  assert.match(panel, /Search cloud projects/);
  assert.match(panel, /Review restore/);
  assert.match(panel, /Open as working copy/);
  assert.match(panel, /The latest cloud revision is never overwritten/);
  assert.match(styles, /\.app-shell\.cloud-open \.workspace/);
  assert.match(styles, /\.cloud-restore-confirm/);
  assert.match(styles, /\.hvac-symbol \.supply-can-body/);
  assert.match(styles, /\.hvac-symbol \.return-can-body/);
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

test("makes run size primary, supports one-inch size choices, and directly resizes icons", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /const runSizeOptions = \["4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"\]/);
  assert.match(source, /className={`run-size-default \$\{selectedRun \? "editing" : ""\}`}/);
  assert.match(source, /NEW RUN DEFAULT/);
  assert.match(source, /scaleX\?: number/);
  assert.match(source, /scaleY\?: number/);
  assert.match(source, /kind: "symbol-resize"/);
  assert.match(source, /function startSymbolResize/);
  assert.match(source, /className="symbol-resize-handle"/);
  assert.match(source, /hold Shift to keep its proportions/);
  assert.match(source, /Reset size/);
  assert.doesNotMatch(source, /className="fitting-core"/);
  assert.match(styles, /\.run-size-default/);
  assert.match(styles, /\.hvac-symbol \.symbol-resize-handle/);
});

test("controls fitting text, connects equipment at plenums, and repositions plan labels", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /const \[showFittingLabels, setShowFittingLabels\] = useState\(false\)/);
  assert.match(source, /Show or hide T\/Y fitting names and three-size labels/);
  assert.match(source, /<DraftingCompass size=\{14\} \/> T\/Y Text/);
  assert.match(source, /\{showFittingLabels && <text/);
  assert.match(source, /function equipmentPlenumPorts\(selected: Drawing\)/);
  assert.match(source, /returnRunId\?: string/);
  assert.match(source, /LIVE \{ductType\.toUpperCase\(\)\} PLENUM CONNECTION/);
  assert.match(source, /Attach \{ductType\}/);
  assert.match(source, /SUPPLY PLENUM/);
  assert.match(source, /RETURN PLENUM/);
  assert.match(source, /linkRunToMatchingEquipmentPlenum/);
  assert.match(source, /kind: "label"/);
  assert.match(source, /function startRunLabelDrag/);
  assert.match(source, /labelOffset\?: Point/);
  assert.match(source, /className={`run-label \$\{drawing\.labelOffset \? "custom-position" : ""\}`}/);
  assert.match(source, /Reset position/);
  assert.match(source, /usesCatalogLabel/);
  assert.match(source, /Rename any placed symbol—including linear supplies and returns/);
  assert.doesNotMatch(source, /className="symbol-elevation"/);
  assert.match(styles, /\.drawing-layer text\.run-label/);
  assert.match(styles, /\.hvac-symbol \.equipment-plenum-port/);
});

test("keeps the system completion engine with plan-focused defaults", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../app/workflowEngine.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(workflow, /export function buildSystemWorkflow/);
  assert.match(workflow, /"runs"[\s\S]*"branches"[\s\S]*"connections"[\s\S]*"airflow"[\s\S]*"review"[\s\S]*"release"/);
  assert.match(page, /NEXT SAFE ACTION/);
  assert.match(page, /Continue system/);
  assert.doesNotMatch(page, /className="field-workflow-hud"/);
  assert.match(page, /workflowSummary:/);
  assert.match(page, /const \[showCfmLabels, setShowCfmLabels\] = useState\(false\)/);
  assert.match(page, /const \[showLengthLabels, setShowLengthLabels\] = useState\(false\)/);
  assert.match(styles, /--blue: #2f80ff/);
  assert.match(styles, /--red: #f0525a/);
  assert.match(styles, /--green: #35c98b/);
  assert.match(styles, /--yellow: #f7b733/);
  assert.match(styles, /--cyan: #2ccce4/);
});

test("verifies Google Drive packages against immutable cloud revisions", async () => {
  const panel = await readFile(new URL("../app/CloudProjectsPanel.tsx", import.meta.url), "utf8");
  const cloud = await readFile(new URL("../app/cloudProjects.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260724120000_system_completion_and_verified_drive_sync.sql", import.meta.url), "utf8");

  assert.match(panel, /PROJECT INTELLIGENCE · V100/);
  assert.match(panel, /snapshot: revision\.snapshot/);
  assert.doesNotMatch(panel, /const snapshot = buildSnapshot\(\);[\s\S]{0,300}latestRevision/);
  assert.match(panel, /Open package/);
  assert.match(panel, /LEGACY PACKAGE · RESYNC/);
  assert.match(panel, /recordDrivePackageSync/);
  assert.match(cloud, /drive_synced_revision_number/);
  assert.match(cloud, /workflow_summary/);
  assert.match(cloud, /record_drive_package_sync/);
  assert.match(migration, /add column if not exists workflow_summary jsonb/);
  assert.match(migration, /drive_synced_revision_number bigint/);
  assert.match(migration, /create or replace function public\.record_drive_package_sync/);
});

test("ships the v100 Project Intelligence Hub with secure coordination and review-only decisions", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/CloudProjectsPanel.tsx", import.meta.url), "utf8");
  const palette = await readFile(new URL("../app/ProjectCommandPalette.tsx", import.meta.url), "utf8");
  const cloud = await readFile(new URL("../app/cloudProjects.ts", import.meta.url), "utf8");
  const drive = await readFile(new URL("../app/googleDrive.ts", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../app/workflowEngine.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260724140000_project_intelligence_hub.sql", import.meta.url), "utf8");
  const releaseMigration = await readFile(new URL("../supabase/migrations/20260724143000_cloud_field_release_integrity.sql", import.meta.url), "utf8");

  assert.match(page, /AI Plan Reader v105 · Plan Intelligence v106/);
  assert.match(page, /ProjectCommandPalette/);
  assert.match(page, /const key = event\.key\.toLowerCase\(\)/);
  assert.match(page, /\(event\.ctrlKey \|\| event\.metaKey\) && key === "k"/);
  assert.match(panel, /Command Center/);
  assert.match(panel, /Plan review items/);
  assert.match(panel, /Revision approvals/);
  assert.match(panel, /PROJECT EVIDENCE/);
  assert.match(panel, /drawing geometry changes only when you edit it/);
  assert.match(panel, /Project-safe save is locked/);
  assert.match(panel, /mutationLockRef/);
  assert.match(palette, /Review-only intelligence · geometry stays manual/);
  assert.match(cloud, /from\("project_work_items"\)/);
  assert.match(cloud, /from\("project_comments"\)/);
  assert.match(cloud, /from\("project_approvals"\)/);
  assert.match(cloud, /from\("project_files"\)/);
  assert.match(cloud, /issue_project_field_release/);
  assert.match(drive, /checkDriveConfiguration/);
  assert.match(drive, /response\.status !== 401/);
  assert.match(workflow, /buildProjectIntelligenceSummary/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke update on public\.projects/);
  assert.match(migration, /revoke insert on public\.project_activity/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set workflow_summary = next_workflow_summary/);
  assert.match(releaseMigration, /create table if not exists public\.project_field_releases/);
  assert.match(releaseMigration, /lock table public\.project_work_items in share mode/);
  assert.match(releaseMigration, /latest_revision\.release_fingerprint <> expected_release_fingerprint/);
  assert.match(releaseMigration, /approval\.status = 'approved'/);
  assert.match(page, /workingCloudRevisionFingerprint === currentCloudReleaseFingerprint/);
  assert.match(styles, /\.cloud-executive-metrics/);
  assert.match(styles, /\.command-palette-overlay/);
});

test("ships v107 public guest access, subscription readiness, and protected owner analytics", async () => {
  const home = await readFile(new URL("../app/ProjectHome.tsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/CloudProjectsPanel.tsx", import.meta.url), "utf8");
  const reader = await readFile(new URL("../app/AIPlanWorkspace.tsx", import.meta.url), "utf8");
  const analytics = await readFile(new URL("../app/productAnalytics.ts", import.meta.url), "utf8");
  const owner = await readFile(new URL("../app/OwnerAnalytics.tsx", import.meta.url), "utf8");
  const entitlements = await readFile(new URL("../app/entitlements.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260725163857_owner_analytics_and_subscription_readiness.sql", import.meta.url), "utf8");

  assert.match(home, /Open a plan — no account/);
  assert.match(home, /The drawing workspace is open to everyone/);
  assert.match(home, /Save projects in the cloud/);
  assert.match(home, /PROFESSIONAL · COMING SOON/);
  assert.match(home, /Make every new plan revision faster to review/);
  assert.match(panel, /Continue without an account/);
  assert.match(panel, /Sign-in is only required for cloud projects, cross-device access, revision history, and collaboration/);
  assert.match(panel, /no limits enforced yet/);
  assert.match(reader, /KEEP THE VALUE YOU JUST CREATED/);
  assert.match(reader, /Save with a cloud project/);
  assert.match(entitlements, /revisionComparison: true/);
  assert.match(analytics, /BLOCKED_PROPERTY_PATTERN/);
  assert.match(analytics, /drive_package_saved/);
  assert.match(analytics, /cloud_revision_saved/);
  assert.match(analytics, /takeoff_package_saved/);
  assert.match(owner, /PRIVATE OWNER VIEW/);
  assert.match(owner, /Unique workspace visitors/i);
  assert.match(migration, /alter table public\.account_access enable row level security/);
  assert.match(migration, /alter table public\.usage_events enable row level security/);
  assert.match(migration, /grant insert\(visitor_id, session_id, event_name, page_path, app_version, properties\)/);
  assert.match(migration, /grant update\(display_name, avatar_url\)/);
  assert.match(migration, /app_role in \('owner', 'admin'\)/);
  assert.match(migration, /Owner analytics access required/);
  assert.match(migration, /analytics_properties_safe/);
  assert.match(migration, /entry\.key not in/);
  assert.doesNotMatch(migration, /provider_payload/);
});

test("uses nominal icon sizes, accurate equipment identities, and selected placement data", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const mark = await readFile(new URL("../public/hvac-plan-studio-v98-mark.svg", import.meta.url));

  assert.match(page, /const nominalScale = parts\.length > 1/);
  assert.match(page, /size: selected\.size/);
  assert.doesNotMatch(page, /id: "symbol-preview"[\s\S]{0,120}size: ""/);
  assert.match(page, /equipment-heatpump-airhandler/);
  assert.match(page, /OUTDOOR HEAT PUMP · 3 TON/);
  assert.match(page, /equipment-supply-plenum/);
  assert.match(page, /equipment-return-plenum/);
  assert.match(page, /if \(variant === "furnace"\) return horizontalUnit\("FUR", "flame"\)/);
  assert.match(page, /equipmentTypeName\(drawing\.symbol\.variant\)/);
  assert.ok(mark.byteLength > 500);
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

test("keeps completed T/Y fittings readable and reveals numbered ports only while connecting", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /const fittingFullyConnected = portStates\.every\(\(state\) => state\.connected\)/);
  assert.match(source, /const showPortGuides = pendingBranchFittingId === drawing\.id/);
  assert.match(source, /\{showPortGuides && \[inlet, outlet, branchPort\]\.map/);
  assert.match(source, /const showRunNodeHandles = runSelected \|\| Boolean\(branchCandidateClass\)/);
  assert.match(source, /\{showRunNodeHandles && drawing\.points\.map/);
  assert.match(source, /className={`branch-fitting \$\{fittingFullyConnected \? "complete-fitting" : "open-fitting"\}/);
  assert.match(source, /textAnchor="middle"/);
  assert.match(styles, /\.branch-fitting \.fitting-label \{/);
  assert.match(styles, /paint-order: stroke/);
  assert.match(styles, /\.branch-fitting\.showing-port-guides \.fitting-label/);
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

test("supports the field run-first T/Y workflow", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /const \[branchWorkflow, setBranchWorkflow\] = useState<"run-first" \| "place-first">\("run-first"\)/);
  assert.match(source, /const \[queuedBranchRunId, setQueuedBranchRunId\]/);
  assert.match(source, /function armRunFirstBranch\(point: Point\)/);
  assert.match(source, /function queuedBranchRoute\(center: Point, mainId: string, mainAngle: number\)/);
  assert.match(source, /if \(branchWorkflow === "run-first" && !queuedBranchRunId\)/);
  assert.match(source, /Branch run armed · click this trunk location to split, rotate, size and connect the T\/Y/);
  assert.match(source, /PORT 3 RUN ARMED/);
  assert.match(source, /Run first/);
  assert.match(source, /Place first/);
  assert.match(source, /Pick next diffuser run/);
  assert.match(source, /The closest end of this run will move to Port 3/);
  assert.match(styles, /\.branch-mode-toggle/);
  assert.match(styles, /\.branch-run-armed-card/);
  assert.match(styles, /\.branch-run-armed \.duct-line/);
  assert.match(styles, /\.branch-run-pick \.duct-line/);
});

test("deletes runs and icons without leaving the page or broken drawing references", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /function removeDeletedDrawingReferences\(current: Drawing\[\], idsToDelete: string\[\]\)/);
  assert.match(source, /deleted\.has\(drawing\.symbol\.connectedRunId\)/);
  assert.match(source, /deleted\.has\(id\) \? "" : id/);
  assert.match(source, /function clearDeletedDrawingState\(idsToDelete: string\[\]\)/);
  assert.match(source, /setSelectionBox\(null\)/);
  assert.match(source, /if \(event\.key === "Delete" \|\| event\.key === "Backspace"\) \{\s*event\.preventDefault\(\);\s*deleteSelected\(\);/);
  assert.match(source, /Icon deleted · connected ductwork kept · Undo restores it/);
  assert.match(source, /Run deleted · connected icons and fitting ports safely detached · Undo restores it/);
});

test("deletes complete or incomplete T/Y fittings without leaving a stale selection", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /if \(selectedId && !drawings\.some\(\(drawing\) => drawing\.id === selectedId\)\)/);
  assert.match(source, /if \(!upstream \|\| !downstream \|\| upstream\.points\.length < 2 \|\| downstream\.points\.length < 2\)/);
  assert.match(source, /clearDeletedDrawingState\(\[fitting\.id\]\)/);
  assert.match(source, /T\/Y fitting deleted · incomplete routes kept in place · Undo restores it/);
  assert.match(source, /T\/Y fitting deleted · main run healed · branch route kept · Undo restores it/);
  assert.doesNotMatch(source, /setSelectedId\(branchId\)/);
  assert.match(source, /selectedDrawing\?\.fitting \? <div className="fitting-properties">/);
  assert.match(source, /\{selectedRun && <div className="engineering-properties">/);
});

test("keeps the workspace recoverable and matches T/Y legs to run line weights", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /class WorkspaceErrorBoundary extends Component/);
  assert.match(source, /Your plan is still saved/);
  assert.match(source, /Reload saved plan/);
  assert.match(source, /setUndoStack\(\(stack\) => \[\.\.\.stack, drawings\]\)/);
  assert.doesNotMatch(source, /setDrawings\(\(current\) => \{\s*setUndoStack/);
  assert.match(source, /lineWeight\?: number/);
  assert.match(source, /const \[runLineWeight, setRunLineWeight\] = useState\(0\.2\)/);
  assert.match(source, /0\.10 mm · Fine/);
  assert.match(source, /0\.20 mm · Standard/);
  assert.match(source, /function fittingPortVisual\(fitting: Drawing, port: 0 \| 1 \| 2\)/);
  assert.match(source, /strokeWidth: portVisuals\[0\]\.strokeWidth/);
  assert.match(source, /portSizes\.join\("×"\)/);
  assert.match(source, /connected T\/Y leg matched automatically/);
  assert.match(source, /lineWeight: normalizedRunLineWeight\(drawing\.lineWeight\)/);
  assert.match(styles, /\.line-weight-control/);
  assert.match(styles, /\.workspace-recovery-screen/);
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
  assert.match(source, /Planning airflow · editable 400 CFM per ton/);
  assert.match(source, /Supply scheduled/);
  assert.match(source, /Return vs planning baseline/);
  assert.match(source, /Even-division values are coordination checks—not room-load calculations/);
  assert.match(source, /no duct sizes changed/);
  assert.match(source, /velocity-screened candidates/);
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
  assert.match(source, /Review and save targets before applying/);
  assert.match(source, /Return vs planning baseline/);
  assert.match(source, /Recalculate targets/);
  assert.match(source, /Save reviewed targets/);
  assert.match(source, /Apply \{selectedCfmProposalIds\.length\} reviewed CFM/);
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
  assert.match(source, /const physicallyAttached = Math\.hypot\(endpoint\.x - point\.x, endpoint\.y - point\.y\) < 2/);
  assert.match(source, /!hasFittingProblem && startCovered && endCovered/);
  assert.match(source, /coveredEndpoints\.has\(endpointKey\(run\.id, "start"\)\)/);
  assert.match(source, /coveredEndpoints\.has\(endpointKey\(run\.id, "end"\)\)/);
  assert.match(source, /connected: connection\.connected/);
  assert.match(source, /Open or detached T\/Y port/);
  assert.match(source, /const neckSize = drawing\.symbol\?\.neckSize/);
  assert.match(source, /Supply can \/ plenum box", size: `Ø\$\{group\.neckSize\}" neck`/);
  assert.match(source, /`\$\{group\.size\} face · match \$\{group\.label\.toLowerCase\(\)\}`/);
  assert.match(source, />Review connected sizes</);
  assert.match(source, />Review system balance</);
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

test("ships v105 AI Plan Reader and v106 evidence-backed Plan Intelligence", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../app/AIPlanWorkspace.tsx", import.meta.url), "utf8");
  const reader = await readFile(new URL("../app/planReader.ts", import.meta.url), "utf8");
  const cloud = await readFile(new URL("../app/cloudProjects.ts", import.meta.url), "utf8");
  const identity = await readFile(new URL("../app/planIntelligence.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260724220000_ai_plan_reader_intelligence.sql", import.meta.url), "utf8");

  assert.match(page, /AI Plan Reader v105 · Plan Intelligence v106/);
  assert.match(page, /<AIPlanWorkspace/);
  assert.match(page, /openAIPlanReader/);
  assert.match(page, /saveCloudPlanAnalysis/);
  assert.match(page, /updateCloudPlanFindingDecision/);
  assert.match(page, /decision\.evidenceFingerprint !== issue\.evidenceFingerprint/);
  assert.match(page, /EVIDENCE CHANGED · REVIEW AGAIN/);
  assert.match(page, /const plenums = equipmentPlenumPorts\(symbol\)/);
  assert.match(page, /runTouchesPoint\(symbol\.symbol\?\.connectedRunId, "supply", plenums\.supply, symbol\.symbol\?\.connectedEnd\)/);
  assert.match(page, /runTouchesPoint\(symbol\.symbol\?\.returnRunId, "return", plenums\.return, symbol\.symbol\?\.returnEnd\)/);
  assert.match(page, /symbol\.symbol\?\.returnRunId/);
  assert.match(page, /equipment supply plenum, T\/Y port, or supply terminal/);
  assert.match(page, /equipment return plenum, T\/Y port, or return grille/);
  assert.match(page, /instanceKey: `port-\$\{port \+ 1\}`/);
  assert.match(page, /legacyId: `review-\$\{stableTextHash/);
  assert.match(page, /reviewDecisionForIssue/);
  assert.match(page, /EVIDENCE CHANGED — REVIEW AGAIN/);
  assert.match(page, /visibleLabels: \{ showCfmLabels, showLengthLabels, showFittingLabels \}/);
  assert.match(workspace, /AI proposes\. You approve\./);
  assert.match(workspace, /Nothing is drawn, resized, or changed automatically/);
  assert.match(workspace, /Source-backed quantities/);
  assert.match(workspace, /Show on plan/);
  assert.match(workspace, /Prepare markup/);
  assert.match(reader, /export async function analyzeHvacPlan/);
  assert.match(reader, /Mechanical schedule/);
  assert.match(reader, /Rectangular duct size/);
  assert.match(reader, /Motorized outside-air damper/);
  assert.match(reader, /No HVAC schedule was confirmed/);
  assert.match(cloud, /from\("plan_analysis_runs"\)/);
  assert.match(cloud, /from\("plan_analysis_evidence"\)/);
  assert.match(cloud, /from\("plan_analysis_findings"\)/);
  assert.match(identity, /function buildFindingIdentity/);
  assert.match(identity, /input\.instanceKey \|\| "primary"/);
  assert.match(identity, /evidenceFingerprint: `evidence-/);
  assert.match(styles, /\.ai-plan-workspace/);
  assert.match(styles, /\.ai-findings-view/);
  assert.match(styles, /\.ai-takeoff-table/);
  assert.match(migration, /create table if not exists public\.plan_analysis_runs/);
  assert.match(migration, /create table if not exists public\.plan_analysis_evidence/);
  assert.match(migration, /create table if not exists public\.plan_analysis_findings/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /private\.can_edit_project\(project_id\)/);
});

test("ships v103 System Balance Studio with reviewed calculations and manual geometry control", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const studio = await readFile(new URL("../app/SystemBalanceStudio.tsx", import.meta.url), "utf8");
  const model = await readFile(new URL("../app/systemBalance.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /import SystemBalanceStudio from "\.\/SystemBalanceStudio"/);
  assert.match(page, /<SystemBalanceStudio/);
  assert.match(page, /function buildSystemBalanceModel\(\): SystemBalanceModel/);
  assert.match(page, /function openSystemBalanceStudio\(\)/);
  assert.match(page, /function applySizingSuggestionIds\(ids: string\[\]\)/);
  assert.match(page, /terminalCfmProposals\(\)\.filter\(\(proposal\) => ids\.includes\(proposal\.id\) && proposal\.connected\)/);
  assert.match(page, /rootedTerminalRun/);
  assert.match(page, /equipmentReturnRun/);
  assert.match(page, /returnCalculated/);
  assert.match(page, /reachableReturnRuns/);
  assert.match(page, /suggestion\.overCapacity \|\| suggestion\.current !== suggestion\.recommended/);
  assert.match(page, /const hasManualOverride = drawing\.cfmSource === "manual"/);
  assert.match(page, /function roomAirflowTargetsAreReviewed/);
  assert.match(page, /Review and save the room coordination targets before applying terminal CFM/);
  assert.match(page, /scaleVerified && pressure\.pressureDrop > \.15/);
  assert.match(page, /cfmSource: "planning-seed"/);
  assert.match(page, /cfmSource: "manual"/);
  assert.match(page, /cfmSource: "room-target"/);
  const selectedSizeBody = page.slice(page.indexOf("function updateSelectedSize"), page.indexOf("function updateRunLineWeight"));
  const fittingSizeBody = page.slice(page.indexOf("function updateFittingPortSize"), page.indexOf("function assignSelectedFittingPort"));
  assert.doesNotMatch(selectedSizeBody, /defaultCfm|cfm:/);
  assert.doesNotMatch(fittingSizeBody, /defaultCfm|cfm:/);
  assert.match(page, /balanceReviewRecords,/);
  assert.match(page, /setBalanceReviewRecords\(Array\.isArray\(project\.balanceReviewRecords\)/);
  assert.match(page, /openSizeRecommendations: model\.runs\.length/);
  assert.match(page, /evidenceFingerprint: model\.evidenceFingerprint/);
  assert.match(page, /function exportSystemBalanceRunCsv\(\)/);
  assert.match(page, /showSystemBalanceStudio && <SystemBalanceStudio/);
  assert.doesNotMatch(page, /const activeSystemBalanceModel = buildSystemBalanceModel\(\)/);
  assert.match(studio, /SYSTEM BALANCE STUDIO · V103/);
  assert.match(studio, /Planning estimate—not a Manual J, S, D, or T design/);
  assert.match(studio, /Studio never draws new runs, reroutes paths, balances airflow, or numbers ductwork automatically/);
  assert.match(studio, /role="tablist"/);
  assert.match(studio, /role="tabpanel"/);
  assert.match(studio, /aria-live="polite"/);
  assert.doesNotMatch(studio, /Automatic Run Numbering/i);
  assert.match(model, /export function summarizeSystemBalance/);
  assert.match(model, /latestReview\.evidenceFingerprint !== model\.evidenceFingerprint/);
  assert.match(styles, /\.system-balance-overlay/);
  assert.match(styles, /\.balance-method-note/);
  assert.match(styles, /\.system-balance-studio/);
});

test("scores v103 balance evidence deterministically and marks changed reviews stale", async () => {
  const { summarizeSystemBalance } = await import(new URL("../app/systemBalance.ts", import.meta.url));
  const base = {
    systemId: "system-1",
    systemName: "System 1",
    calculationVersion: "system-balance-v103.1",
    evidenceFingerprint: "evidence-a",
    designCfm: 1200,
    supplyCfm: 1200,
    returnCfm: 1200,
    connectedSupplyCfm: 1200,
    connectedReturnCfm: 1200,
    connectedSupplyTerminals: 4,
    connectedReturnTerminals: 2,
    supplyTerminalCount: 4,
    returnTerminalCount: 2,
    totalRunCount: 6,
    scaleVerified: true,
    airflowTargetSource: "user-entered",
    planningSeedTerminalCount: 0,
    missingTerminalCfm: 0,
    roomTargetSource: "saved-targets",
    rules: {
      supplyVelocityLimit: 900,
      returnVelocityLimit: 700,
      freshVelocityLimit: 600,
      residentialFlexMax: "16",
    },
    runs: [],
    rooms: [],
    networks: [],
    cfmProposals: [],
    reviews: [],
  };
  const clear = summarizeSystemBalance(base);
  assert.equal(clear.score, 100);
  assert.equal(clear.tone, "clear");
  assert.equal(clear.reviewStale, false);

  const planning = summarizeSystemBalance({
    ...base,
    airflowTargetSource: "planning-seed",
    planningSeedTerminalCount: 6,
  });
  assert.equal(planning.tone, "attention");
  assert.ok(planning.score <= 79);
  assert.match(planning.headline, /planning airflow target/i);

  const changed = summarizeSystemBalance({
    ...base,
    connectedSupplyTerminals: 3,
    rooms: [{
      name: "Bedroom 1",
      type: "bedroom",
      supplyTarget: 150,
      supplyScheduled: 150,
      returnTarget: 0,
      returnScheduled: 0,
      diffusers: 1,
      returns: 0,
      connectedDevices: 1,
      deviceCount: 1,
      missingCfm: 0,
      needsReturn: true,
      drawingIds: ["diffuser-1"],
    }],
    networks: [{
      unitId: "unit-1",
      unitLabel: "3 TON AHU",
      designCfm: 1200,
      assignedCfm: 1200,
      remainingCfm: 0,
      returnCfm: 1200,
      percent: 100,
      runCount: 4,
      fittingCount: 2,
      terminalCount: 4,
      problemCount: 1,
      balanced: false,
    }],
    reviews: [{
      id: "review-1",
      systemId: "system-1",
      reviewer: "Field Lead",
      note: "Prior evidence",
      createdAt: "2026-07-24T12:00:00.000Z",
      evidenceFingerprint: "evidence-old",
      score: 100,
      designCfm: 1200,
      supplyCfm: 1200,
      returnCfm: 1200,
      openSizeRecommendations: 0,
      openCfmRecommendations: 0,
      connectionProblems: 0,
    }],
  });
  assert.equal(changed.tone, "hold");
  assert.equal(changed.connectionProblems, 1);
  assert.equal(changed.disconnectedDevices, 1);
  assert.equal(changed.missingReturnRooms, 1);
  assert.equal(changed.reviewStale, true);
  assert.ok(changed.score < clear.score);

  const overloaded = summarizeSystemBalance({
    ...base,
    runs: [{
      id: "run-16",
      type: "supply",
      room: "Main trunk",
      currentSize: "16",
      recommendedSize: "16",
      cfm: 1600,
      currentVelocity: 1146,
      recommendedVelocity: 1146,
      velocityLimit: 900,
      pressureDrop: .22,
      airflowSource: "manual",
      overCapacity: true,
    }],
  });
  assert.equal(overloaded.tone, "hold");
  assert.equal(overloaded.overCapacityRuns, 1);
});
