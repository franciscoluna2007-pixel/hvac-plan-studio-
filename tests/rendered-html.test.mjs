import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let connectionRepairModule;
async function loadConnectionRepairModule() {
  if (connectionRepairModule) return connectionRepairModule;
  const source = await readFile(new URL("../app/connectionRepair.ts", import.meta.url), "utf8");
  const typescriptImport = await import("typescript");
  const typescript = typescriptImport.default || typescriptImport;
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  connectionRepairModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  return connectionRepairModule;
}

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders production v133 text metadata without generated image metadata or the development preview marker", async () => {
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
  const html = await response.text();
  assert.match(html, /<meta property="og:title" content="HVAC Plan Studio · Field Redline Studio"\/>/i);
  assert.match(html, /<meta property="og:description" content="Draw source-bound field redlines, organize review notes, and export a clear marked-up plan without changing the approved HVAC design\."\/>/i);
  assert.doesNotMatch(html, /(?:property|name)="(?:og:image|twitter:image)"/i);
  assert.doesNotMatch(html, /summary_large_image|og-v\d+\.png/i);
  assert.doesNotMatch(html, developmentPreviewMeta);
});

test("v124-v125 keep direct PDF opening and guided setup as safe parallel paths", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../app/ProjectHome.tsx", import.meta.url), "utf8");
  const setup = await readFile(new URL("../app/GuidedProjectSetup.tsx", import.meta.url), "utf8");
  const preference = await readFile(new URL("../app/pdfStartPreference.ts", import.meta.url), "utf8");
  const storage = await readFile(new URL("../app/projectStorage.ts", import.meta.url), "utf8");
  const roadmap = await readFile(new URL("../ROADMAP.md", import.meta.url), "utf8");

  assert.match(home, /Open PDF and start drawing/);
  assert.match(home, /Help me set up this plan/);
  assert.match(home, /Drop a PDF here to open it directly/);
  assert.doesNotMatch(home, /aria-pressed=\{pdfStartMode/);
  assert.doesNotMatch(home, /Preferred start on this device/);

  assert.match(page, /type PdfOpenContext = \{/);
  assert.match(page, /requestId: \+\+pdfOpenRequestRef\.current/);
  assert.match(page, /context\.requestId !== pdfOpenRequestRef\.current/);
  assert.match(page, /context\.mode === "direct"/);
  assert.match(page, /entry_mode: context\.mode/);
  assert.match(page, /file\.type !== "application\/pdf" && !pdfByName/);
  assert.match(page, /applyProjectSetup\(context\.setup\)/);
  assert.match(page, /createPdfOpenContext\("local", "direct", "drop"\)/);

  const fileInputIndex = page.indexOf('aria-label="Choose a PDF construction plan"');
  const inertWorkspaceIndex = page.indexOf('<section className="workspace" inert=');
  assert.ok(fileInputIndex > 0 && fileInputIndex < inertWorkspaceIndex, "PDF input should remain outside the inert workspace");

  assert.match(preference, /pdf-start-preference:v1/);
  assert.match(preference, /mode: "direct"/);
  assert.match(preference, /catch \{\s*return DEFAULT_PDF_START_PREFERENCE/);
  assert.match(storage, /sourceFingerprint \? `\$\{baseKey\}:\$\{sourceFingerprint\}` : baseKey/);
  assert.match(storage, /project\.pdfFingerprint !== sourceFingerprint/);
  assert.match(page, /older markups were kept separately/);

  assert.match(setup, /tabIndex=\{-1\}/);
  assert.match(setup, /aria-hidden="true"/);
  assert.match(setup, /aria-pressed=\{effectiveSource === "local"\}/);

  assert.match(roadmap, /\| v124 \| Open PDF & Draw \| Shipped \|/);
  assert.match(roadmap, /\| v125 \| Setup When You Need It \| Shipped \|/);
});

test("adds secure cloud projects, revisions, collaborators, and Drive packages", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/CloudProjectsPanel.tsx", import.meta.url), "utf8");
  const cloud = await readFile(new URL("../app/cloudProjects.ts", import.meta.url), "utf8");
  const drive = await readFile(new URL("../app/googleDrive.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /Saved jobs/);
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
  assert.match(page, /Nothing changes without your approval/);
  assert.match(page, /applyProjectSetup/);
  assert.match(page, /sourceFileName/);
  assert.match(page, /pendingPdfOpenRef\.current = null/);
  assert.match(page, /addEventListener\("cancel", handleFilePickerCancel\)/);
  assert.match(page, /const modalWorkspaceActive = showProjectHome \|\| showProjectSetup \|\| showPlanIntelligence \|\| showFieldPackageComposer \|\| showFinishJobStudio \|\| showSystemBalanceStudio/);
  assert.match(page, /inert=\{modalWorkspaceActive \? true : undefined\}/);
  assert.match(home, /Open a PDF and start drawing\. Setup help is available, but it never gets in your way/);
  assert.match(home, /Jobs · plans · materials/);
  assert.doesNotMatch(home, /FIELD PRODUCTION|Field-first workflow|Installer-ready/);
  assert.match(home, /Continue current job/);
  assert.doesNotMatch(home, /PLAN REVIEW QUEUE|PROFESSIONAL · COMING SOON/);
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

test("leads solo HVAC operators through four job steps and keeps Field Redline separate", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../app/ProjectHome.tsx", import.meta.url), "utf8");
  const palette = await readFile(new URL("../app/ProjectCommandPalette.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(page, /const fieldFirstSteps = \[/);
  assert.match(page, /<strong>Plan setup<\/strong>/);
  assert.match(page, /label: "Draw & Detail"/);
  assert.match(page, /label: "Airflow & Sizes"/);
  assert.match(page, /label: "Fix Plan"/);
  assert.match(page, /label: "Finish the Job"/);
  const fieldFirstStepsStart = page.indexOf("const fieldFirstSteps = [");
  const fieldFirstStepsEnd = page.indexOf("] as const;", fieldFirstStepsStart);
  assert.ok(fieldFirstStepsStart >= 0 && fieldFirstStepsEnd > fieldFirstStepsStart);
  const fieldFirstStepsSource = page.slice(fieldFirstStepsStart, fieldFirstStepsEnd);
  assert.doesNotMatch(fieldFirstStepsSource, /field-redline|Field Redline Studio/);
  assert.match(page, /id: "field-redline",\s*label: "Open Field Redline Studio"/);
  assert.match(page, /className="field-first-guide"/);
  assert.match(page, /const \[rightPanelOpen, setRightPanelOpen\] = useState\(false\)/);
  assert.match(page, /function openToolsPanel\(\) \{\s*setLeftPanelOpen\(true\);\s*setRightPanelOpen\(false\)/);
  assert.match(page, /function openInspectorPanel\(\) \{\s*setRightPanelOpen\(true\);\s*setLeftPanelOpen\(false\)/);
  assert.match(page, /left-panel-tabs/);
  assert.match(home, /YOUR JOBS/);
  assert.match(home, /Continue current job/);
  assert.match(home, /> Open a plan\s*</);
  assert.match(home, /Open PDF and start drawing/);
  assert.match(home, /Open saved jobs/);
  assert.match(palette, /command\.recommended/);
  assert.match(palette, /Find a tool/);
  assert.match(styles, /\.field-first-guide/);
  assert.match(styles, /\.smart-plan-preflight/);
  assert.match(styles, /\.project-home-hero-visual,[\s\S]*display: none !important/);
  assert.match(styles, /\.left-panel-tabs/);
  assert.doesNotMatch(layout, /\/og-v\d+\.png|summary_large_image|images\s*:/);
  assert.match(layout, /Field Redline Studio/);
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

  assert.match(source, /function startPlanPan[\s\S]{0,500}event\.button !== 2[\s\S]{0,500}activeEditPointerIdRef\.current !== null/);
  assert.match(source, /pan\.frameId = requestAnimationFrame\(\(\) =>/);
  assert.match(source, /pdfStageRef\.current\.style\.transform/);
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
  assert.match(source, /ADD DURING DETAIL PASS/);
  assert.match(source, /New supply and return runs stay unlabeled until you confirm a size/);
  assert.match(source, /scaleX\?: number/);
  assert.match(source, /scaleY\?: number/);
  assert.match(source, /kind: "symbol-resize"/);
  assert.match(source, /function startSymbolResize/);
  assert.match(source, /className=\{`symbol-resize-handle \$\{cursorClass\}`\}/);
  assert.match(source, /Hold Shift to keep the original proportions/);
  assert.match(source, />Compact<\/button>/);
  assert.match(source, /− Smaller/);
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
  assert.match(source, /Reset label/);
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
  assert.match(page, /NEXT STEP/);
  assert.match(page, /CURRENT JOB STEP/);
  assert.doesNotMatch(page, /className="builder-current-step-summary"/);
  assert.doesNotMatch(page, /Continue system/);
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

  assert.match(page, /Nothing changes without your approval/);
  assert.match(page, /ProjectCommandPalette/);
  assert.match(page, /const key = event\.key\.toLowerCase\(\)/);
  assert.match(page, /\(event\.ctrlKey \|\| event\.metaKey\) && key === "k"/);
  assert.match(panel, /Command Center/);
  assert.match(panel, /Plan review items/);
  assert.match(panel, /Revision approvals/);
  assert.match(panel, /PROJECT EVIDENCE/);
  assert.match(panel, /changes drawing geometry only after you approve selected fixes/);
  assert.match(panel, /Project-safe save is locked/);
  assert.match(panel, /mutationLockRef/);
  assert.match(palette, /Type to search every tool/);
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

  assert.match(home, /Open PDF and start drawing/);
  assert.match(home, /Open saved jobs/);
  assert.match(home, /Your PDF work can stay on this device/);
  assert.doesNotMatch(home, /PROFESSIONAL · COMING SOON|Make every new plan revision faster to review/);
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

test("builds a deterministic STEP 1 plan with type, sheet, system, and endpoint safeguards", async () => {
  const { buildConnectionRepairPlan } = await loadConnectionRepairModule();
  const target = {
    id: "device:can-1:supply",
    kind: "device",
    drawingId: "can-1",
    label: "Bedroom 2",
    detail: "Supply can",
    page: 1,
    systemId: "system-1",
    ductType: "supply",
    slot: "terminal",
    targetPoint: { x: 10, y: 0 },
  };
  const runs = [
    { id: "wrong-type", page: 1, systemId: "system-1", type: "return", size: "8", points: [{ x: 9, y: 0 }, { x: 50, y: 0 }] },
    { id: "wrong-page", page: 2, systemId: "system-1", type: "supply", size: "8", points: [{ x: 8, y: 0 }, { x: 50, y: 0 }] },
    { id: "wrong-system", page: 1, systemId: "system-2", type: "supply", size: "8", points: [{ x: 7, y: 0 }, { x: 50, y: 0 }] },
    { id: "too-short", page: 1, systemId: "system-1", type: "supply", size: "8", points: [{ x: 10, y: 0 }] },
    { id: "valid", page: 1, systemId: "system-1", type: "supply", size: "8", points: [{ x: 20, y: 0 }, { x: 80, y: 0 }] },
  ];
  const before = JSON.stringify({ runs, target });
  const scale = { verified: true, feetPerUnit: .1 };
  const plan = buildConnectionRepairPlan({ systemId: "system-1", runs, targets: [target], scale });

  assert.equal(plan.items[0].status, "choice");
  assert.equal(plan.items[0].candidate, undefined);
  assert.equal(plan.items[0].candidates[0].runId, "valid");
  assert.equal(plan.items[0].candidates[0].end, "start");
  const chosen = buildConnectionRepairPlan({
    systemId: "system-1",
    runs,
    targets: [target],
    choices: { [target.id]: "valid:start" },
    scale,
  });
  assert.equal(chosen.items[0].status, "ready");
  assert.equal(chosen.items[0].candidate.runId, "valid");
  assert.equal(JSON.stringify({ runs, target }), before, "planning must not mutate source geometry");
});

test("requires a choice for ambiguous STEP 1 matches and stays stable when drawing order changes", async () => {
  const { buildConnectionRepairPlan } = await loadConnectionRepairModule();
  const target = {
    id: "device:return-1:return",
    kind: "device",
    drawingId: "return-1",
    label: "Hall return",
    detail: "Return grille",
    page: 1,
    systemId: "system-1",
    ductType: "return",
    slot: "terminal",
    targetPoint: { x: 0, y: 0 },
  };
  const runs = [
    { id: "run-b", page: 1, systemId: "system-1", type: "return", size: "12", points: [{ x: 6, y: 0 }, { x: 100, y: 0 }] },
    { id: "run-a", page: 1, systemId: "system-1", type: "return", size: "12", points: [{ x: 5, y: 0 }, { x: -100, y: 0 }] },
  ];
  const scale = { verified: true, feetPerUnit: .1 };
  const first = buildConnectionRepairPlan({ systemId: "system-1", runs, targets: [target], scale });
  const reversed = buildConnectionRepairPlan({ systemId: "system-1", runs: [...runs].reverse(), targets: [target], scale });

  assert.equal(first.items[0].status, "choice");
  assert.deepEqual(
    first.items[0].candidates.map((candidate) => candidate.id),
    reversed.items[0].candidates.map((candidate) => candidate.id),
  );
  const chosen = buildConnectionRepairPlan({
    systemId: "system-1",
    runs,
    targets: [target],
    choices: { [target.id]: "run-a:start" },
    scale,
  });
  assert.equal(chosen.items[0].status, "ready");
  assert.equal(chosen.items[0].candidate.runId, "run-a");
});

test("repairs only the run already saved to a T/Y port and rejects stale or distant batches", async () => {
  const { buildConnectionRepairPlan, prepareConnectionRepairBatch } = await loadConnectionRepairModule();
  const runs = [
    { id: "saved-run", page: 1, systemId: "system-1", type: "supply", size: "10", points: [{ x: 12, y: 0 }, { x: 100, y: 0 }] },
    { id: "closer-run", page: 1, systemId: "system-1", type: "supply", size: "8", points: [{ x: 1, y: 0 }, { x: -100, y: 0 }] },
  ];
  const target = {
    id: "fitting:ty-1:2",
    kind: "fitting",
    drawingId: "ty-1",
    label: "T/Y fitting · Port 3",
    detail: "Saved T/Y connection",
    page: 1,
    systemId: "system-1",
    ductType: "supply",
    port: 2,
    targetPoint: { x: 0, y: 0 },
    savedRunId: "saved-run",
  };
  const scale = { verified: true, feetPerUnit: .1 };
  const plan = buildConnectionRepairPlan({ systemId: "system-1", runs, targets: [target], scale });
  assert.equal(plan.items[0].status, "ready");
  assert.equal(plan.items[0].candidate.runId, "saved-run");
  const batch = prepareConnectionRepairBatch(plan, [target.id], plan.fingerprint);
  assert.equal(batch.ok, true);
  assert.deepEqual(batch.operations[0].from, { x: 12, y: 0 });
  assert.deepEqual(batch.operations[0].to, { x: 0, y: 0 });
  assert.equal(prepareConnectionRepairBatch(plan, [target.id], "stale-review").ok, false);

  const distant = buildConnectionRepairPlan({
    systemId: "system-1",
    runs: [{ ...runs[0], points: [{ x: 49, y: 0 }, { x: 100, y: 0 }] }],
    targets: [target],
    scale,
  });
  assert.equal(distant.items[0].status, "blocked");
});

test("reserves occupied run endpoints and never prepares the same endpoint twice", async () => {
  const { buildConnectionRepairPlan, prepareConnectionRepairBatch } = await loadConnectionRepairModule();
  const runs = [
    { id: "shared-run", page: 1, systemId: "system-1", type: "supply", size: "8", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
  ];
  const healthy = {
    id: "device:can-1:supply",
    kind: "device",
    drawingId: "can-1",
    label: "Can 1",
    detail: "Supply can",
    page: 1,
    systemId: "system-1",
    ductType: "supply",
    slot: "terminal",
    targetPoint: { x: 0, y: 0 },
    savedRunId: "shared-run",
    savedEnd: "start",
  };
  const unbound = {
    ...healthy,
    id: "device:can-2:supply",
    drawingId: "can-2",
    label: "Can 2",
    targetPoint: { x: 2, y: 0 },
    savedRunId: undefined,
    savedEnd: undefined,
  };
  const plan = buildConnectionRepairPlan({ systemId: "system-1", runs, targets: [healthy, unbound] });
  assert.equal(plan.items.find((item) => item.id === healthy.id).status, "healthy");
  assert.equal(plan.items.find((item) => item.id === unbound.id).status, "blocked");
  assert.equal(prepareConnectionRepairBatch(plan, [unbound.id], plan.fingerprint).ok, false);
});

test("makes STEP 1 preview-first and preserves placed objects and saved T/Y topology", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const repair = await readFile(new URL("../app/connectionRepair.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /Equipment, cans, and T\/Y ports/);
  assert.match(page, /Open \$\{activeConnectionRepairIssues\.length\} connection fix/);
  assert.match(page, /Add this fix/);
  assert.match(page, /Apply \{selectedReadyConnectionRepairIds\.length\} selected · one Undo/);
  assert.match(page, /0<\/strong> placed objects move/);
  assert.match(page, /run\.points\[endpointIndex\] = \{ \.\.\.operation\.to \}/);
  assert.doesNotMatch(page, /device\.points = \[\{ \.\.\.nearest\.endpoint \}\]/);
  assert.doesNotMatch(page, /function repairActiveSystemNetwork[\s\S]{0,500}reattachFittingIn/);
  assert.match(repair, /The saved run end can snap back to this exact T\/Y port/);
  assert.match(repair, /run\.page === target\.page/);
  assert.match(repair, /run\.systemId === target\.systemId/);
  assert.match(repair, /run\.type === target\.ductType/);
  assert.match(styles, /\.connection-repair-list/);
  assert.match(styles, /\.step-one-repair-preview/);
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
  assert.match(source, /const \[runLineWeights, setRunLineWeights\] = useState\(\{ supply: 0\.1, return: 0\.1 \}\)/);
  assert.match(source, /function normalizedRunLineWeight\(value\?: number\) \{\s*return \[0\.1, 0\.2, 0\.3\]\.includes\(Number\(value\)\) \? Number\(value\) : 0\.2;/);
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
  assert.match(source, /fixPlanAnswerCompletesReview\(\{/);
  assert.match(source, /rfiStatus: linkedRfi\?\.status/);
  assert.match(source, /punchStatus: linkedPunch\?\.status/);
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

  assert.match(source, /function focusDrawingOnPlan\(\s*drawingId: string,\s*options: \{ avoidAssistant\?: boolean \} = \{\}/);
  assert.match(source, /pendingFocusRef\.current = \{\s*page: drawing\.page,\s*point,\s*avoidAssistant: options\.avoidAssistant/);
  assert.match(source, /renderedPageNumber !== drawing\.page/);
  assert.match(source, /pending\.page !== pageNumber \|\| renderedPageNumber !== pageNumber/);
  assert.match(source, /planFocusTarget\(\s*viewport\.getBoundingClientRect\(\),\s*assistant\?\.getBoundingClientRect\(\)/);
  assert.match(source, /focusPlanPoint\(pending\.point, \{ avoidAssistant: pending\.avoidAssistant \}\)/);
  assert.match(source, /focusDrawingOnPlan\(item\.drawingId, \{ avoidAssistant: true \}\)/);
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

test("keeps the reader foundation and adds v120 smart plan setup without removing inspectable evidence", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../app/AIPlanWorkspace.tsx", import.meta.url), "utf8");
  const reader = await readFile(new URL("../app/planReader.ts", import.meta.url), "utf8");
  const setup = await readFile(new URL("../app/planSetup.ts", import.meta.url), "utf8");
  const advanced = await readFile(new URL("../app/advancedPlanIntelligence.ts", import.meta.url), "utf8");
  const cloud = await readFile(new URL("../app/cloudProjects.ts", import.meta.url), "utf8");
  const identity = await readFile(new URL("../app/planIntelligence.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260724220000_ai_plan_reader_intelligence.sql", import.meta.url), "utf8");

  assert.match(page, /Nothing changes without your approval/);
  assert.match(page, /<AIPlanWorkspace/);
  assert.match(page, /openAIPlanReader/);
  assert.match(page, /saveCloudPlanAnalysis/);
  assert.match(page, /updateCloudPlanFindingDecision/);
  assert.match(page, /isFixPlanAnswerStale\(\{/);
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
  assert.match(workspace, /HVAC PLAN STUDIO/);
  assert.match(workspace, /Plan Setup &amp; Source Review/);
  assert.match(workspace, /buildSmartPlanSetup\(analysis\)/);
  assert.match(workspace, /automaticFingerprintRef/);
  assert.match(workspace, /\["setup", "Plan setup", ScanSearch\]/);
  assert.match(workspace, /\["coverage", "What.*missing", CircleHelp\]/);
  assert.match(workspace, /ai-coverage-view/);
  assert.match(workspace, /showSource\(row\.page, row\.region\)/);
  assert.match(workspace, /Source-backed quantities/);
  assert.match(workspace, /Show on plan/);
  assert.match(workspace, /Prepare markup/);
  assert.match(reader, /export async function analyzeHvacPlan/);
  assert.match(reader, /function regionForMatch/);
  assert.match(reader, /region: regionForMatch\(spans, match\.index, match\.index \+ match\[0\]\.length\)/);
  assert.match(reader, /coordinateSpace: "viewport-points"/);
  assert.match(reader, /Mechanical schedule/);
  assert.match(reader, /Rectangular duct size/);
  assert.match(reader, /Motorized outside-air damper/);
  assert.match(reader, /No HVAC schedule was detected/);
  assert.match(reader, /category: "Scale"/);
  assert.match(reader, /category: "Rooms"/);
  assert.match(reader, /alwaysScan: true/);
  assert.match(setup, /smart-plan-setup-v120\.0/);
  assert.match(setup, /export function buildSmartPlanSetup/);
  assert.match(advanced, /advanced-plan-intelligence-v115\.0/);
  assert.match(advanced, /Evidence readiness is a review heuristic and never authorizes plan mutation by itself/);
  assert.match(advanced, /confirmed: false/);
  assert.match(cloud, /from\("plan_analysis_runs"\)/);
  assert.match(cloud, /from\("plan_analysis_evidence"\)/);
  assert.match(cloud, /from\("plan_analysis_findings"\)/);
  assert.match(identity, /function buildFindingIdentity/);
  assert.match(identity, /input\.instanceKey \|\| "primary"/);
  assert.match(identity, /evidenceFingerprint: `evidence-/);
  assert.match(styles, /\.ai-plan-workspace/);
  assert.match(styles, /\.ai-coverage-view/);
  assert.match(styles, /\.ai-findings-view/);
  assert.match(styles, /\.ai-takeoff-table/);
  assert.match(migration, /create table if not exists public\.plan_analysis_runs/);
  assert.match(migration, /create table if not exists public\.plan_analysis_evidence/);
  assert.match(migration, /create table if not exists public\.plan_analysis_findings/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /private\.can_edit_project\(project_id\)/);
});

test("ships v112 System Balance Studio with reviewed calculations and manual geometry control", async () => {
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
  assert.match(page, /scaleStateForPage\(drawing\.page\)\.verified && pressure\.pressureDrop > \.15/);
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
  assert.match(studio, /AIRFLOW &amp; DUCT SIZES/);
  assert.match(studio, /TRANSPARENT DUCT SIZE REVIEW · V112/);
  assert.match(studio, /Velocity preview only\. Pressure remains unverified\./);
  assert.match(studio, /run\.applyEligible && run\.airflowReviewed && !run\.overCapacity/);
  assert.match(studio, /Replace planning-seed contributors with fingerprint-matched reviewed room targets or explicit manual values first/);
  assert.match(studio, /Planning estimate—not a Manual J, S, D, or T design/);
  assert.match(studio, /Studio never draws new runs, reroutes paths, balances airflow, or numbers ductwork automatically/);
  assert.match(studio, /role="tablist"/);
  assert.match(studio, /role="tabpanel"/);
  assert.match(studio, /aria-live="polite"/);
  assert.doesNotMatch(studio, /Automatic Run Numbering/i);
  assert.match(model, /export function summarizeSystemBalance/);
  assert.match(model, /system-balance-v112\.0/);
  assert.match(model, /latestReview\.evidenceFingerprint !== model\.evidenceFingerprint/);
  assert.match(styles, /\.system-balance-overlay/);
  assert.match(styles, /\.balance-method-note/);
  assert.match(styles, /\.system-balance-studio/);
});

test("v112 sizing physics are versioned, bounded, deterministic, and explicit about pressure", async () => {
  const sizing = await import(new URL("../app/ductSizing.ts", import.meta.url));

  assert.equal(sizing.DUCT_SIZING_CALCULATION_VERSION, "duct-sizing-v112.0");
  assert.equal(sizing.planningAirflowCfm(3), 1200);
  assert.equal(sizing.planningAirflowCfm(5), 2000);
  assert.ok(Math.abs(sizing.roundDuctAreaSquareFeet(8) - 0.3490658503988659) < 1e-12);
  assert.ok(Math.abs(sizing.roundDuctVelocityFpm(8, 200) - 572.9577951308232) < 1e-9);
  assert.ok(Math.abs(sizing.roundDuctVelocityCapacity(16, 600) - 837.7580409572781) < 1e-9);

  const input = {
    cfm: 200,
    airflowSource: "manual",
    velocityLimitFpm: 600,
    maxDiameterInches: 16,
  };
  const before = JSON.stringify(input);
  const branch = sizing.recommendFlexibleDuctSize(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(branch.recommendedDiameterInches, 8);
  assert.equal(branch.classification, "planning-estimate");
  assert.equal(branch.status, "review");
  assert.equal(branch.applyEligible, true);
  assert.ok(branch.reasonCodes.includes("PRESSURE_EVIDENCE_MISSING"));

  const singleMain = sizing.recommendFlexibleDuctSize({
    cfm: 2000,
    airflowSource: "manual",
    velocityLimitFpm: 900,
    maxDiameterInches: 20,
  });
  assert.equal(singleMain.recommendedDiameterInches, 16);
  assert.equal(singleMain.maxDiameterInches, 16);
  assert.equal(singleMain.overCapacity, true);
  assert.equal(singleMain.applyEligible, false);
  assert.ok(singleMain.reasonCodes.includes("NO_COMPLIANT_FLEX_SIZE"));
  assert.ok(singleMain.reasonCodes.includes("MAX_FLEX_16"));
  assert.equal(singleMain.alternatives[0].pathCount, 2);
  assert.ok(Math.abs(sizing.roundDuctVelocityFpm(16, 2000) - 1432.3944878270581) < 1e-9);
  assert.ok(Math.abs(sizing.roundDuctVelocityFpm(14, 1200) - 1122.529557807327) < 1e-9);

  const planningSeed = sizing.recommendFlexibleDuctSize({
    cfm: 200,
    airflowSource: "planning-seed",
    velocityLimitFpm: 600,
  });
  assert.equal(planningSeed.applyEligible, false);
  assert.ok(planningSeed.reasonCodes.includes("AIRFLOW_PLANNING_SEED"));

  const pressure = sizing.calculatePressureBasis({
    externalStaticPressureInWg: .5,
    componentLossesInWg: [.12, .08],
    totalEffectiveLengthFeet: 300,
  });
  assert.equal(pressure.status, "pass");
  assert.ok(Math.abs(pressure.availableStaticPressureInWg - .3) < 1e-12);
  assert.ok(Math.abs(pressure.designFrictionRateInWgPer100Ft - .1) < 1e-12);
  assert.equal(sizing.calculatePressureBasis().status, "unknown");
  assert.equal(sizing.calculatePressureBasis({
    externalStaticPressureInWg: .2,
    componentLossesInWg: [.25],
    totalEffectiveLengthFeet: 150,
  }).status, "blocked");

  const eightInch = sizing.estimateRunPressureDrop({
    diameterInches: 8,
    cfm: 200,
    physicalLengthFeet: 50,
    bendCount: 2,
  });
  const tenInch = sizing.estimateRunPressureDrop({
    diameterInches: 10,
    cfm: 200,
    physicalLengthFeet: 50,
    bendCount: 2,
  });
  assert.equal(eightInch.equivalentLengthFeet, 66);
  assert.ok(tenInch.pressureDropInWg < eightInch.pressureDropInWg);
  assert.match(eightInch.assumptionNotice, /not a pressure verification/i);
});

test("v112 allocation and progression rules remain exact without mutating inputs", async () => {
  const sizing = await import(new URL("../app/ductSizing.ts", import.meta.url));
  const rows = [
    { key: "master", weight: 3 },
    { key: "living", weight: 2 },
    { key: "bedroom", weight: 1 },
  ];
  const before = JSON.stringify(rows);
  assert.deepEqual(sizing.allocateCfm(1200, rows), {
    bedroom: 200,
    living: 400,
    master: 600,
  });
  assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(sizing.allocateCfm(100, [
    { key: "a", weight: 1 },
    { key: "b", weight: 1 },
    { key: "c", weight: 1 },
  ]), { a: 35, b: 35, c: 30 });

  assert.equal(sizing.evaluateTransition({
    parentDiameterInches: 14,
    childDiameterInches: 12,
    portKind: "straight",
  }).status, "pass");
  assert.equal(sizing.evaluateTransition({
    parentDiameterInches: 14,
    childDiameterInches: 10,
    portKind: "branch",
  }).status, "pass");
  assert.equal(sizing.evaluateTransition({
    parentDiameterInches: 14,
    childDiameterInches: 10,
    portKind: "straight",
  }).status, "review");
  assert.equal(sizing.evaluateTransition({
    parentDiameterInches: 14,
    childDiameterInches: 16,
    portKind: "straight",
  }).status, "blocked");
});

test("v113 restores reviewed-airflow network sizing without diameter-derived CFM", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const studio = await readFile(new URL("../app/SystemBalanceStudio.tsx", import.meta.url), "utf8");
  const assistant = await readFile(new URL("../app/MarkupAssistantStudio.tsx", import.meta.url), "utf8");
  const repair = await readFile(new URL("../app/repairPlan.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const roadmap = await readFile(new URL("../ROADMAP.md", import.meta.url), "utf8");

  assert.match(page, /DUCT_SIZING_CALCULATION_VERSION/);
  assert.match(page, /Math\.max\(manual, propagated\)/);
  assert.match(page, /applyEligible: recommendation\.applyEligible && airflowReviewed/);
  assert.match(page, /async function applyAssistantRepairPlan/);
  assert.match(page, /suggestion\.airflowReviewed &&[\s\S]{0,100}action\.airflowReviewed &&[\s\S]{0,180}suggestion\.equipmentRooted &&[\s\S]{0,100}suggestion\.applyEligible &&[\s\S]{0,100}!suggestion\.overCapacity/);
  assert.match(page, /cfmSource: "room-target" as const/);
  assert.match(page, /next = synchronizeFittingSizes\(resized, drawings, \{/);
  assert.match(page, /setHistory\(next\)/);
  assert.doesNotMatch(page, /function defaultCfm/);
  const legacySizeApplyBody = page.slice(
    page.indexOf("function applySizingSuggestionIds"),
    page.indexOf("function openSizingReview"),
  );
  assert.match(legacySizeApplyBody, /suggestion\.airflowReviewed/);
  assert.match(legacySizeApplyBody, /setAssistantAutonomyMode\("guided"\)/);
  assert.match(legacySizeApplyBody, /setAssistantPreparedEvidenceFingerprint\(assistantRepairPlan\.evidenceFingerprint\)/);
  assert.match(legacySizeApplyBody, /setAssistantSelectedActionIds\(repairActionIds\)/);
  assert.match(legacySizeApplyBody, /setShowMarkupAssistant\(true\)/);
  assert.match(legacySizeApplyBody, /opened in Guided Repair/);
  assert.doesNotMatch(legacySizeApplyBody, /setHistory|synchronizeFittingSizes|drawing\.size/);
  assert.match(repair, /cfmSource: "manual" \| "terminal-linked" \| "room-target"/);
  assert.match(repair, /candidate\.cfm > 0 &&[\s\S]{0,100}candidate\.equipmentRooted &&[\s\S]{0,100}candidate\.airflowReviewed/);
  assert.doesNotMatch(repair, /cfmSource: "planning-seed"/);
  assert.match(repair, /CFM is not derived from duct diameter/);
  assert.match(repair, /Apply the reviewed terminal CFM first, then rebuild the repair plan so sizing uses the new network airflow/);
  assert.match(repair, /The governing airflow includes a planning seed or a room target whose review fingerprint is no longer current/);
  assert.match(repair, /Automatic network sizing requires an equipment-rooted connected path/);
  assert.match(assistant, /The assistant may fill blank terminal-run labels, apply reviewed terminal airflow, and update reviewed sizes only after final approval/);
  assert.match(assistant, /It never invents CFM, moves route points, draws a return or trunk/);
  assert.match(studio, /No supported single flex run passes/);
  assert.match(styles, /v113–v115 — readable guided repair, durable review, and evidence coverage/);
  assert.match(styles, /--assistant-body: 15px/);
  assert.match(roadmap, /\| v113 \| Guided Repair Plan and controlled network resizing \| Shipped \|/);
});

test("ships the v113-v115 Guided Repair Plan as a stale-safe, one-Undo workflow", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const studio = await readFile(new URL("../app/MarkupAssistantStudio.tsx", import.meta.url), "utf8");
  const engineSource = await readFile(new URL("../app/markupAssistant.ts", import.meta.url), "utf8");
  const repairSource = await readFile(new URL("../app/repairPlan.ts", import.meta.url), "utf8");
  const takeoffSource = await readFile(new URL("../app/takeoffIntelligence.ts", import.meta.url), "utf8");
  const advancedSource = await readFile(new URL("../app/advancedPlanIntelligence.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const roadmap = await readFile(new URL("../ROADMAP.md", import.meta.url), "utf8");

  assert.match(page, /import MarkupAssistantStudio, \{[\s\S]{0,100}type PlanHelperPrimaryView,[\s\S]{0,40}\} from "\.\/MarkupAssistantStudio"/);
  assert.match(page, /buildRepairPlan/);
  assert.match(page, /buildTakeoffImpact/);
  assert.match(page, /buildAdvancedPlanIntelligence/);
  assert.match(page, /buildMarkupRecommendations/);
  assert.match(page, /<MarkupAssistantStudio/);
  assert.match(page, /function prepareAssistantRepairPlan/);
  assert.match(page, /async function applyAssistantRepairPlan/);
  assert.match(page, /input\.evidenceFingerprint !== assistantRepairPlan\.evidenceFingerprint/);
  assert.match(repairSource, /actions\.length !== selected\.size/);
  assert.match(repairSource, /Apply the reviewed terminal CFM first, then rebuild the repair plan so sizing uses the new network airflow/);
  assert.match(page, /setHistory\(next\)/);
  assert.match(studio, /PLAN HELPER/);
  assert.match(studio, /One place to answer a question and approve the fix\./);
  assert.match(studio, /aria-modal="false"/);
  assert.match(studio, /Check only/);
  assert.match(studio, /Prepare fixes/);
  assert.match(studio, /Apply approved fixes/);
  assert.match(studio, /GUIDED REPAIR PLAN/);
  assert.match(studio, /This repair plan is stale\./);
  assert.match(studio, /MATERIAL IMPACT/);
  assert.match(studio, /Before → after purchasing impact/);
  assert.match(studio, /ONE CONTROLLED TRANSACTION/);
  assert.match(studio, /I reviewed each selected problem, proposed fix, expected result, and affected plan object/);
  assert.match(studio, /Nothing is selected automatically\. Connection, airflow, and size steps never mix\./);
  assert.match(studio, /Select safe fixes in this step \(\$\{readyActions\.length\}\)/);
  assert.match(studio, /\["do-first", "Do first"/);
  assert.match(studio, /\["can-fix", "Can fix"/);
  assert.match(studio, /\["needs-answer", "Needs answer"/);
  assert.match(studio, /return "READY TO APPLY"/);
  assert.match(studio, /return "NEEDS ONE ANSWER"/);
  assert.match(studio, /return "CONFIRM ON PLAN"/);
  assert.match(studio, /REVIEWED FIELD CHANGES/);
  assert.match(studio, /NO ROUTE MOVEMENT/);
  assert.match(studio, /PROBLEM/);
  assert.match(studio, /PROPOSED FIX/);
  assert.match(studio, /EXPECTED RESULT/);
  assert.match(studio, /AFFECTED PLAN OBJECTS/);
  assert.match(studio, /preparedRepairPlanId !== repairPlan\.id/);
  assert.match(studio, /autonomyMode !== "guided"/);
  assert.match(studio, /onApplyRepairPlan/);
  assert.match(studio, /onUndoRepairBatch/);
  assert.match(studio, /REPAIR HISTORY &amp; UNDO/);
  assert.match(studio, /Receipt/);
  assert.match(studio, /Evidence set/);
  assert.match(studio, /Material basis/);
  assert.match(studio, /SOURCE READINESS/);
  assert.match(studio, /Evidence coverage before automation/);
  assert.match(studio, /Review-only heuristic/);
  assert.match(studio, /not a probability, approval, or release gate/);
  assert.doesNotMatch(engineSource, /setHistory|setDrawings|dispatch/);
  assert.match(repairSource, /markup-fixes-v123\.0/);
  assert.match(page, /assistantPreparedRepairPlanId !== assistantRepairPlan\.id/);
  assert.match(page, /canUndo=\{Boolean\(undoableAssistantRepairRecord\(\)\)\}/);
  assert.match(page, /record\.reversedAt[\s\S]{0,400}reversedAt: undefined/);
  assert.match(engineSource, /must be fixed on the drawing before release/);
  assert.match(takeoffSource, /takeoff-intelligence-v114\.0/);
  assert.match(advancedSource, /advanced-plan-intelligence-v115\.0/);
  assert.match(styles, /v115 final readability guard: working evidence and warnings are never microcopy/);
  assert.match(styles, /\.markup-stale-warning,[\s\S]{0,500}font-size: 15px !important/);
  assert.match(styles, /\.markup-assistant-studio \{[\s\S]{0,180}grid-template-rows: auto auto auto minmax\(0, 1fr\) auto;/);
  assert.match(roadmap, /\| v113 \| Guided Repair Plan and controlled network resizing \| Shipped \|/);
  assert.match(roadmap, /\| v114 \| Repair receipts and before\/after takeoff intelligence \| Shipped \|/);
  assert.match(roadmap, /\| v115 \| Advanced Plan Intelligence, source regions, and coverage \| Shipped \|/);
});

test("guided repair stages reviewed CFM before sizing and requires explicit fix selection", async () => {
  const repair = await import(new URL("../app/repairPlan.ts", import.meta.url));
  const sizeCandidate = {
    id: "run-12",
    type: "supply",
    room: "Conference 101",
    current: "10",
    recommended: "12",
    cfm: 640,
    currentVelocity: 1173,
    velocity: 814,
    limit: 900,
    airflowSource: "room-target",
    airflowReviewed: true,
    airflowEvidence: ["Fingerprint-matched reviewed room-target CFM"],
    roomTargetReviewFingerprint: "room-review-current",
    equipmentRooted: true,
    applyEligible: true,
    overCapacity: false,
    affectedFittingIds: ["fitting-1"],
    affectedConnectedRunIds: ["run-13"],
    reasonCodes: ["PRESSURE_EVIDENCE_MISSING"],
  };
  const stagedInput = {
    systemId: "system-1",
    evidenceFingerprint: "evidence-a",
    createdAt: "2026-07-25T18:00:00.000Z",
    recommendations: [],
    cfmCandidates: [{
      id: "proposal-1",
      drawingId: "diffuser-1",
      room: "Conference 101",
      label: "Supply diffuser",
      current: 400,
      proposed: 640,
      connected: true,
    }],
    roomTargetsReviewed: true,
    sizeCandidates: [sizeCandidate],
    branchCandidates: [],
    scaleVerified: true,
  };
  const before = JSON.stringify(stagedInput);
  const staged = repair.buildRepairPlan(stagedInput);

  assert.equal(JSON.stringify(stagedInput), before);
  assert.equal(staged.version, "markup-fixes-v123.0");
  assert.equal(staged.readyCount, 1);
  assert.equal(staged.needsInputCount, 1);
  const cfmAction = staged.actions.find((action) => action.kind === "terminal-cfm");
  const blockedSizeAction = staged.actions.find((action) => action.kind === "run-size");
  assert.equal(cfmAction.readiness, "ready");
  assert.equal(cfmAction.cfmSource, "room-target");
  assert.ok(cfmAction.evidence.includes("CFM is not derived from duct diameter"));
  assert.ok(cfmAction.problem.includes("400 CFM"));
  assert.ok(cfmAction.proposedFix.includes("640 CFM"));
  assert.ok(cfmAction.expectedResult.includes("separate review step"));
  assert.equal(cfmAction.nextStepLabel, "Add this airflow fix");
  assert.equal(blockedSizeAction.readiness, "needs-input");
  assert.match(blockedSizeAction.blocker, /Apply the reviewed terminal CFM first/);
  assert.deepEqual(staged.selectedByDefault, []);

  const rebuilt = repair.buildRepairPlan({
    ...stagedInput,
    evidenceFingerprint: "evidence-b",
    cfmCandidates: [],
    sizeCandidates: [sizeCandidate],
  });
  const readySizeAction = rebuilt.actions.find((action) => action.kind === "run-size");
  assert.equal(rebuilt.readyCount, 1);
  assert.equal(rebuilt.needsInputCount, 0);
  assert.equal(readySizeAction.readiness, "ready");
  assert.equal(readySizeAction.cfm, 640);
  assert.equal(readySizeAction.cfmSource, "room-target");
  assert.equal(readySizeAction.airflowReviewed, true);
  assert.equal(readySizeAction.roomTargetReviewFingerprint, "room-review-current");
  assert.equal(readySizeAction.currentSize, "10");
  assert.equal(readySizeAction.proposedSize, "12");
  assert.ok(readySizeAction.problem.includes("10\" supply run"));
  assert.ok(readySizeAction.proposedFix.includes("12\""));
  assert.ok(readySizeAction.expectedResult.includes("814 FPM"));
  assert.equal(readySizeAction.nextStepLabel, "Add this size fix");
  assert.ok(readySizeAction.evidence.includes("640 CFM · Saved room target"));
  assert.ok(readySizeAction.evidence.includes("Fingerprint-matched reviewed room-target CFM"));
  assert.ok(readySizeAction.evidence.includes("Room-target review ROOM-REVIEW-CURRENT"));
  assert.deepEqual(rebuilt.selectedByDefault, []);
  assert.deepEqual(
    repair.selectedReadyActions(rebuilt, [readySizeAction.id, "unknown"]).map((action) => action.id),
    [readySizeAction.id],
  );
  assert.equal(repair.repairPlanIsStale(rebuilt, "evidence-b"), false);
  assert.equal(repair.repairPlanIsStale(rebuilt, "evidence-c"), true);

  const unchangedCfm = repair.buildRepairPlan({
    ...stagedInput,
    evidenceFingerprint: "evidence-no-op",
    cfmCandidates: [{
      ...stagedInput.cfmCandidates[0],
      current: 640,
      proposed: 640,
      currentSource: "room-target",
    }],
    sizeCandidates: [sizeCandidate],
  });
  assert.equal(unchangedCfm.actions.some((action) => action.kind === "terminal-cfm"), false);
  assert.equal(unchangedCfm.actions.find((action) => action.kind === "run-size").readiness, "ready");
  assert.equal(unchangedCfm.readyCount, 1);
  assert.deepEqual(unchangedCfm.selectedByDefault, []);

  const sourceOnlyCfm = repair.buildRepairPlan({
    ...stagedInput,
    evidenceFingerprint: "evidence-source-only",
    cfmCandidates: [{
      ...stagedInput.cfmCandidates[0],
      current: 640,
      proposed: 640,
      currentSource: "planning-seed",
    }],
    sizeCandidates: [sizeCandidate],
  });
  const sourceOnlyAction = sourceOnlyCfm.actions.find((action) => action.kind === "terminal-cfm");
  assert.equal(sourceOnlyAction.readiness, "ready");
  assert.deepEqual(sourceOnlyAction.changes.map((change) => change.field), ["CFM source"]);
  assert.match(sourceOnlyAction.proposedFix, /change only its source/i);
  assert.equal(sourceOnlyCfm.actions.find((action) => action.kind === "run-size").readiness, "needs-input");

  const unreviewed = repair.buildRepairPlan({
    ...stagedInput,
    evidenceFingerprint: "evidence-unreviewed",
    cfmCandidates: [],
    sizeCandidates: [{
      ...sizeCandidate,
      id: "run-planning-seed",
      room: "Planning seed route",
      airflowReviewed: false,
      airflowEvidence: ["Planning-seed terminal CFM · not eligible"],
      roomTargetReviewFingerprint: "",
      applyEligible: false,
      reasonCodes: ["AIRFLOW_PROVENANCE_UNREVIEWED"],
    }, {
      ...sizeCandidate,
      id: "run-stale-review",
      room: "Stale room-target route",
      airflowReviewed: false,
      airflowEvidence: ["Room-target review fingerprint no longer current"],
      roomTargetReviewFingerprint: "room-review-stale",
      applyEligible: false,
      reasonCodes: ["AIRFLOW_PROVENANCE_UNREVIEWED"],
    }],
  });
  const blockedSizes = unreviewed.actions.filter((action) => action.kind === "run-size");
  assert.equal(unreviewed.readyCount, 0);
  assert.equal(unreviewed.needsInputCount, 2);
  assert.deepEqual(unreviewed.selectedByDefault, []);
  assert.ok(blockedSizes.every((action) => action.airflowReviewed === false));
  assert.ok(blockedSizes.every((action) => action.readiness === "needs-input"));
  assert.ok(blockedSizes.every((action) =>
    /planning seed or a room target whose review fingerprint is no longer current/.test(action.blocker)
  ));
  assert.ok(
    blockedSizes.find((action) => action.drawingId === "run-planning-seed")
      .evidence.includes("Planning-seed terminal CFM · not eligible"),
  );
  assert.ok(
    blockedSizes.find((action) => action.drawingId === "run-stale-review")
      .evidence.includes("Room-target review fingerprint no longer current"),
  );
});

test("v114 takeoff intelligence reports actual before-and-after material impact", async () => {
  const takeoff = await import(new URL("../app/takeoffIntelligence.ts", import.meta.url));
  const input = {
    runs: [
      { id: "supply-a", type: "supply", size: "10", measuredLengthFeet: 20 },
      { id: "supply-b", type: "supply", size: "10", measuredLengthFeet: 20 },
      { id: "return-a", type: "return", size: "14", measuredLengthFeet: 30 },
    ],
    sizeChanges: [{ drawingId: "supply-b", proposedSize: "12" }],
    wastePercent: 10,
    affectedFittingIds: ["fitting-1", "fitting-1", "fitting-2"],
    holds: ["Verify scale", "Verify scale"],
  };
  const before = JSON.stringify(input);
  const impact = takeoff.buildTakeoffImpact(input);

  assert.equal(JSON.stringify(input), before);
  assert.equal(impact.version, "takeoff-intelligence-v114.0");
  assert.equal(impact.measuredLengthBefore, 70);
  assert.equal(impact.measuredLengthAfter, 70);
  assert.equal(impact.changedRows, 2);
  assert.equal(impact.boxesBefore, 4);
  assert.equal(impact.boxesAfter, 4);
  assert.equal(impact.affectedFittings, 2);
  assert.deepEqual(impact.holds, ["Verify scale"]);
  assert.deepEqual(
    impact.rows.find((row) => row.key === "supply:10"),
    {
      key: "supply:10",
      type: "supply",
      size: "10",
      beforeMeasuredFeet: 40,
      afterMeasuredFeet: 20,
      deltaMeasuredFeet: -20,
      beforeOrderFeet: 44,
      afterOrderFeet: 22,
      beforeBoxes: 2,
      afterBoxes: 1,
      deltaBoxes: -1,
    },
  );
  assert.deepEqual(
    impact.rows.find((row) => row.key === "supply:12"),
    {
      key: "supply:12",
      type: "supply",
      size: "12",
      beforeMeasuredFeet: 0,
      afterMeasuredFeet: 20,
      deltaMeasuredFeet: 20,
      beforeOrderFeet: 0,
      afterOrderFeet: 22,
      beforeBoxes: 0,
      afterBoxes: 1,
      deltaBoxes: 1,
    },
  );
});

test("v115 Advanced Plan Intelligence keeps source regions, OCR gaps, and relationships review-only", async () => {
  const advanced = await import(new URL("../app/advancedPlanIntelligence.ts", import.meta.url));
  const workspace = await readFile(new URL("../app/AIPlanWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /UNCONFIRMED EXACT-TAG CANDIDATE/);
  assert.match(workspace, /Rule-based text match/);
  assert.match(workspace, /Open \{evidence\.sheetNumber \|\| `page \$\{evidence\.page\}`\} source/);
  assert.match(workspace, /showSource\(evidence\.page, evidence\.region\)/);
  assert.match(workspace, /Matching tags do not prove a schedule-row, airflow, or equipment association/);
  const region = (x, y) => ({
    x,
    y,
    width: 20,
    height: 8,
    pageWidth: 612,
    pageHeight: 792,
    coordinateSpace: "viewport-points",
  });
  const evidence = [
    { id: "eq-plan", category: "Equipment", label: "Equipment tag", value: "AHU-1", page: 1, sheetNumber: "M1.1", excerpt: "AHU-1", confidence: .95, source: "PDF text layer", region: region(10, 20) },
    { id: "duct-plan", category: "Ductwork", label: "Round duct size", value: "10 IN", page: 1, sheetNumber: "M1.1", excerpt: "10 IN", confidence: .92, source: "PDF text layer", region: region(40, 20) },
    { id: "device-plan", category: "Air devices", label: "Supply diffuser", value: "S-1", page: 1, sheetNumber: "M1.1", excerpt: "S-1", confidence: .91, source: "PDF text layer", region: region(70, 20) },
    { id: "air-plan", category: "Airflow", label: "CFM text reference", value: "400 CFM", page: 1, sheetNumber: "M1.1", excerpt: "400 CFM", confidence: .94, source: "PDF text layer", region: region(100, 20) },
    { id: "eq-schedule", category: "Equipment", label: "Equipment tag", value: "ahu-1", page: 2, sheetNumber: "M2.1", excerpt: "AHU-1", confidence: .88, source: "PDF text layer", region: region(10, 30) },
    { id: "schedule", category: "Schedules", label: "Mechanical schedule", value: "AHU-1 schedule", page: 2, sheetNumber: "M2.1", excerpt: "AHU-1 schedule", confidence: .9, source: "PDF text layer" },
    { id: "air-schedule", category: "Airflow", label: "CFM text reference", value: "1200 CFM", page: 2, sheetNumber: "M2.1", excerpt: "1200 CFM", confidence: .93, source: "PDF text layer", region: region(40, 30) },
  ];
  const analysis = {
    id: "analysis-1",
    sourceFingerprint: "source-current",
    sourceFileName: "mechanical.pdf",
    createdAt: "2026-07-25T18:00:00.000Z",
    pageCount: 3,
    pages: [
      { page: 1, sheetNumber: "M1.1", title: "Mechanical plan", classification: "Mechanical plan", hvacScore: 6, confidence: .95, textLength: 1200, readable: true },
      { page: 2, sheetNumber: "M2.1", title: "Equipment schedule", classification: "Mechanical schedule", hvacScore: 5, confidence: .94, textLength: 800, readable: true },
      { page: 3, sheetNumber: "M3.1", title: "Scanned mechanical plan", classification: "Mechanical plan", hvacScore: 4, confidence: .2, textLength: 0, readable: false },
    ],
    evidence,
    findings: [],
    takeoff: [],
    summary: {
      mechanicalSheets: 3,
      readableSheets: 2,
      equipment: 2,
      ductSizes: 1,
      airDevices: 1,
      openFindings: 0,
      averageConfidence: .82,
    },
  };
  const result = advanced.buildAdvancedPlanIntelligence(analysis);

  assert.equal(result.version, "advanced-plan-intelligence-v115.0");
  assert.deepEqual(result.ocrRequiredPages, [3]);
  assert.equal(result.coverage.find((row) => row.page === 1).regionCoveragePercent, 100);
  assert.equal(result.coverage.find((row) => row.page === 2).regionCoveragePercent, 67);
  assert.deepEqual(result.coverage.find((row) => row.page === 3).missingCategories, ["Ductwork", "Air devices"]);
  assert.equal(result.averageCoveragePercent, 71);
  assert.equal(result.averageRegionCoveragePercent, 86);
  assert.equal(result.readinessScore, 64);
  assert.match(result.blockers[0], /need OCR or visual confirmation/);
  assert.ok(result.notices.includes("Some evidence is page-linked without an exact text region."));
  assert.ok(result.notices.some((notice) => /1 cross-sheet relationship.*human confirmation/.test(notice)));
  assert.ok(result.notices.includes("Evidence readiness is a review heuristic and never authorizes plan mutation by itself."));
  assert.equal(result.relationships.length, 1);
  assert.equal(result.relationships[0].kind, "equipment-tag");
  assert.equal(result.relationships[0].label, "AHU-1 appears across 2 sheets");
  assert.deepEqual(result.relationships[0].sourceSheets, ["M1.1", "M2.1"]);
  assert.equal(result.relationships[0].confidence, .88);
  assert.equal(result.relationships[0].confirmed, false);

  const comparison = advanced.comparePlanAnalysisSources(
    { ...analysis, sourceFingerprint: "source-previous", evidence: evidence.slice(0, -1) },
    analysis,
  );
  assert.deepEqual(comparison, { changed: true, added: 1, removed: 0, unchanged: 6 });
});

test("v116 My HVAC Rules separates locked rules, recommendations, and project-only overrides", async () => {
  const standard = await import(new URL("../app/designStandard.ts", import.meta.url));
  const studio = await readFile(new URL("../app/MarkupAssistantStudio.tsx", import.meta.url), "utf8");
  const roadmap = await readFile(new URL("../ROADMAP.md", import.meta.url), "utf8");
  const input = {
    systemId: "system-1",
    evidenceFingerprint: "drawing-a",
    residentialFlexMax: "18",
    runs: [
      { id: "run-18", type: "supply", size: "18", roomName: "Bedroom 1", roomType: "bedroom" },
      { id: "run-10", type: "supply", size: "10", roomName: "Living", roomType: "general" },
      { id: "run-8", type: "supply", size: "8", roomName: "Office", roomType: "general" },
      { id: "run-6", type: "supply", size: "6", roomName: "Bedroom 2", roomType: "bedroom" },
      { id: "run-oa", type: "fresh", size: "6" },
    ],
    terminals: [
      { id: "diffuser-1", kind: "diffuser", roomName: "Bedroom 1", roomType: "bedroom", connected: true },
      { id: "diffuser-2", kind: "diffuser", roomName: "Bedroom 2", roomType: "bedroom", connected: false },
      { id: "return-1", kind: "returnGrille", roomName: "Bedroom 1", roomType: "bedroom", connected: true },
    ],
    tyFittingIds: [],
    motorDamperIds: [],
    projectOverrides: { "reviewed-ty-strategy": "Existing structure limits fitting access." },
  };
  const before = JSON.stringify(input);
  const profile = standard.buildDesignStandardProfile(input);

  assert.equal(JSON.stringify(input), before);
  assert.equal(profile.engineVersion, "design-standard-v116.0");
  assert.equal(profile.name, "My HVAC Rules");
  assert.equal(profile.profileVersion, "1.0");
  assert.equal(profile.blocked, 2);
  assert.equal(profile.rules.find((row) => row.id === "residential-flex-limit").overrideAllowed, false);
  assert.ok(profile.rules.find((row) => row.id === "bedroom-return-path").drawingIds.includes("diffuser-2"));
  assert.equal(profile.rules.find((row) => row.id === "reviewed-ty-strategy").level, "project");
  assert.match(profile.rules.find((row) => row.id === "fresh-air-control").finding, /without a motorized outside-air damper/);
  assert.match(studio, /My HVAC Rules/);
  assert.match(studio, /Locked safeguards/);
  assert.match(studio, /Project exceptions/);
  assert.doesNotMatch(studio, /4119|119 Company Style/);
  assert.doesNotMatch(roadmap, /4119 Company Style|119 Company Style/);
});

test("v111 recommendations are deterministic, granular, immutable, and stale when evidence moves", async () => {
  const { stripTypeScriptTypes } = await import("node:module");
  const planSource = await readFile(new URL("../app/planIntelligence.ts", import.meta.url), "utf8");
  const markupSource = await readFile(new URL("../app/markupAssistant.ts", import.meta.url), "utf8");
  const standaloneSource = [
    stripTypeScriptTypes(planSource, { mode: "transform" }),
    stripTypeScriptTypes(markupSource.replace(/^import \{[\s\S]*?\} from "\.\/planIntelligence";\r?\n/, ""), { mode: "transform" }),
  ].join("\n");
  const { buildMarkupRecommendations } = await import(`data:text/javascript;base64,${Buffer.from(standaloneSource).toString("base64")}`);
  const findings = [{
    id: "finding-1",
    ruleId: "unconnected-run",
    evidenceFingerprint: "evidence-a",
    severity: "critical",
    category: "Connections",
    title: "Supply run is disconnected",
    detail: "Run 12 is not connected to equipment.",
    drawingId: "run-12",
    reference: "Run 12",
    resolved: false,
  }];
  const opportunities = [{
    id: "run-a-run-b-0-1",
    center: { x: 120.125, y: 220.5 },
    angle: 0,
    branchAngle: Math.PI / 4,
    side: 1,
    mainRunId: "run-a",
    branchRunId: "run-b",
    parentSize: "14",
    style: "wye45",
    score: 2,
  }, {
    id: "run-a-run-c-0-1",
    center: { x: 180, y: 260 },
    angle: 0,
    branchAngle: Math.PI / 2,
    side: -1,
    mainRunId: "run-a",
    branchRunId: "run-c",
    parentSize: "12",
    style: "tee90",
    score: 3,
  }];
  const input = {
    findings,
    branchOpportunities: opportunities,
    sizingCandidateCount: 2,
    sizingEvidenceFingerprint: "sizes-a",
    scaleVerified: true,
    designCfm: 1200,
  };
  const before = JSON.stringify(input);
  const first = buildMarkupRecommendations(input);
  const second = buildMarkupRecommendations(input);

  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(first, second);
  assert.equal(first.filter((row) => row.category === "Branch strategy").length, 2);
  assert.ok(first.filter((row) => row.category === "Branch strategy").every((row) => row.preview?.kind === "branch-junction"));

  const moved = buildMarkupRecommendations({
    ...input,
    branchOpportunities: [{ ...opportunities[0], center: { x: 121.125, y: 220.5 } }, opportunities[1]],
  });
  assert.notEqual(
    first.find((row) => row.id.includes(opportunities[0].id)).evidenceFingerprint,
    moved.find((row) => row.id.includes(opportunities[0].id)).evidenceFingerprint,
  );
  const resized = buildMarkupRecommendations({ ...input, sizingEvidenceFingerprint: "sizes-b" });
  assert.notEqual(
    first.find((row) => row.action === "sizing-review")?.evidenceFingerprint,
    resized.find((row) => row.action === "sizing-review")?.evidenceFingerprint,
  );
});

test("scores v103 balance evidence deterministically and marks changed reviews stale", async () => {
  const { summarizeSystemBalance } = await import(new URL("../app/systemBalance.ts", import.meta.url));
  const base = {
    systemId: "system-1",
    systemName: "System 1",
    calculationVersion: "system-balance-v112.0",
    ductSizingVersion: "duct-sizing-v112.0",
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
      classification: "planning-estimate",
      sizingStatus: "blocked",
      applyEligible: false,
      reasonCodes: ["NO_COMPLIANT_FLEX_SIZE"],
      alternatives: [],
      physicalLength: 25,
      equivalentLength: 33,
      equivalentLengthPerBend: 8,
      frictionRate: .66,
      pressureAssumption: "Planning estimate",
      airflowSource: "manual",
      overCapacity: true,
    }],
  });
  assert.equal(overloaded.tone, "hold");
  assert.equal(overloaded.overCapacityRuns, 1);
});

test("ships v108 tablet gestures, stylus protection, responsive drawers, and bounded 4K rendering", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const display = await readFile(new URL("../app/workspaceDisplay.ts", import.meta.url), "utf8");
  const preferences = await readFile(new URL("../app/workspacePreferences.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const analytics = await readFile(new URL("../app/productAnalytics.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260725213000_tablet_ultrahd_workspace_preferences.sql", import.meta.url), "utf8");
  const {
    pinchCamera,
    renderQualityPlan,
    workspaceLayoutFor,
  } = await import(new URL("../app/workspaceDisplay.ts", import.meta.url));

  assert.match(page, /touchPointersRef = useRef\(new Map/);
  assert.match(page, /event\.pointerType === "touch"/);
  assert.match(page, /event\.pointerType === "pen"/);
  assert.match(page, /beginTouchGesture/);
  assert.match(page, /pinchCamera/);
  assert.match(page, /drag\.pointerId !== event\.pointerId/);
  assert.match(page, /selectionBox\.pointerId !== event\.pointerId/);
  assert.match(page, /cancelTouchNavigation/);
  assert.match(page, /isCanvasUiTarget/);
  assert.match(page, /setPointerCapture\(event\.pointerId\)/);
  assert.match(page, /completedEditPointerIdsRef/);
  assert.match(page, /handleViewportLostPointerCapture/);
  assert.match(page, /useLayoutEffect\(\(\) => \{\s*if \(!pdfStageRef\.current \|\| panRef\.current \|\| touchGestureRef\.current\) return/);
  assert.doesNotMatch(page, /className="pdf-stage" style=/);
  assert.match(page, /Stylus-aware touch suppression/);
  assert.match(page, /pdfRenderTaskRef\.current\?\.cancel\(\)/);
  assert.match(page, /RenderingCancelledException/);
  assert.match(page, /100 \* 1024 \* 1024/);
  assert.match(page, /4K Fixed/);
  assert.match(page, /if \(showDisplaySettings\) \{\s*if \(event\.key === "Escape"\) event\.preventDefault\(\);\s*return;/);
  assert.match(page, /showSystemBalanceStudio \|\| showDisplaySettings/);
  assert.match(page, /function openInspectorPanel\(\) \{\s*setRightPanelOpen\(true\)/);
  assert.match(page, /workspace-drawer-scrim/);

  assert.match(display, /"4k": \{ megapixels: 8\.2944/);
  assert.match(display, /workspaceLayoutFor/);
  assert.match(display, /Math\.sqrt\(\(limits\.megapixels \* 1_000_000\) \/ logicalPixels\)/);
  assert.match(display, /export function pinchCamera/);
  assert.match(preferences, /from\("workspace_preferences"\)/);
  assert.match(preferences, /onConflict: "user_id"/);
  assert.match(migration, /alter table public\.workspace_preferences enable row level security/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /revoke all on public\.workspace_preferences from anon/);
  assert.match(styles, /v108 — Tablet \+ Ultra-HD Workspace/);
  assert.match(styles, /\.app-shell\.tablet-layout \.left-panel/);
  assert.match(styles, /min-width: 44px; min-height: 44px/);
  assert.match(styles, /@media \(min-width: 2560px\)/);
  assert.match(styles, /height: 100dvh/);
  assert.match(analytics, /app_version: "133"/);

  const pinch = pinchCamera({
    anchorPlan: { x: 100, y: 200 },
    currentMidpoint: { x: 400, y: 500 },
    startDistance: 100,
    currentDistance: 200,
    startZoom: 1,
  });
  assert.equal(pinch.zoom, 2);
  assert.deepEqual(pinch.camera, { x: 200, y: 100 });
  assert.equal(pinch.camera.x + 100 * pinch.zoom, 400);
  assert.equal(pinch.camera.y + 200 * pinch.zoom, 500);

  const huge4k = renderQualityPlan({
    logicalWidth: 40_000,
    logicalHeight: 30_000,
    zoom: 8,
    devicePixelRatio: 2,
    mode: "4k",
  });
  assert.ok(huge4k.megapixels <= 8.2944);
  assert.ok(huge4k.width <= 5120);
  assert.ok(huge4k.height <= 5120);

  const normal4k = renderQualityPlan({
    logicalWidth: 1200,
    logicalHeight: 900,
    zoom: 1,
    devicePixelRatio: 1,
    mode: "4k",
  });
  assert.ok(normal4k.megapixels > 8.28 && normal4k.megapixels <= 8.2944);
  assert.equal(workspaceLayoutFor(1024, 768, true), "tablet-landscape");
  assert.equal(workspaceLayoutFor(768, 1024, true), "tablet-portrait");
  assert.equal(workspaceLayoutFor(1920, 1080, false), "desktop");
});

test("v121 keeps working text readable and restores a persistent mobile Continue action", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const marker = "/* v121 - Field readability and mobile continuation";
  const sectionStart = styles.indexOf(marker);

  assert.ok(sectionStart >= 0, "expected the v121 readability override section");
  const v121Styles = styles.slice(sectionStart);

  assert.match(
    v121Styles,
    /\.field-first-workspace \.left-panel small,[\s\S]*?font-size: 12px !important;/,
  );
  assert.match(
    v121Styles,
    /\.connection-repair-focus span strong,[\s\S]*?font-size: 14px;/,
  );
  assert.match(
    v121Styles,
    /\.connection-candidate-choices button,[\s\S]*?min-height: 48px;[\s\S]*?font-size: 14px;/,
  );
  assert.match(
    v121Styles,
    /button:focus-visible,[\s\S]*?outline: 3px solid #78e6f4;[\s\S]*?outline-offset: 3px;/,
  );
  assert.match(
    v121Styles,
    /@media \(max-width: 760px\) \{[\s\S]*?\.field-first-guide > nav \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(92px, 1fr\)\);/,
  );
  assert.match(
    v121Styles,
    /@media \(max-width: 760px\) \{[\s\S]*?\.field-first-primary \{[\s\S]*?position: fixed;[\s\S]*?min-height: 56px;[\s\S]*?display: flex;[\s\S]*?font-size: 16px;/,
  );
});

test("v122 adds a draw-first detail workflow and stable scale setup without weakening approvals", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../app/ProjectHome.tsx", import.meta.url), "utf8");
  const cloud = await readFile(new URL("../app/CloudProjectsPanel.tsx", import.meta.url), "utf8");
  const helper = await readFile(new URL("../app/MarkupAssistantStudio.tsx", import.meta.url), "utf8");
  const drawingScale = await readFile(new URL("../app/drawingScale.ts", import.meta.url), "utf8");
  const jobWorkflow = await readFile(new URL("../app/jobWorkflow.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(page, /label: "Draw & Detail"/);
  assert.match(page, /label: "Airflow & Sizes"/);
  assert.match(page, /label: "Fix Plan"/);
  assert.match(page, /label: "Finish the Job"/);
  assert.match(page, /const fieldFirstProgress = Math\.round\(/);
  assert.match(page, /const airflowStepComplete = Boolean\(/);
  assert.match(page, /openMarkupAssistant\("fix-plan"\)/);
  assert.match(page, /onUseDetectedScale=\{applyDetectedPlanScale\}/);
  assert.match(page, /onStartCalibration=\{startPlanScaleCalibration\}/);
  assert.match(page, /const planSetupComplete = Boolean\(\s*activePlanAnalysis &&\s*scaleVerified\s*\)/);
  assert.match(page, /currentStepLabel=\{fieldFirstActiveStep\.label\}/);
  assert.match(page, /currentStepProgress=\{fieldFirstProgress\}/);
  assert.match(page, /onContinueWorkflow=\{\(\) => \{\s*setShowCloudProjects\(false\);\s*fieldFirstActiveStep\.run\(\)/);
  assert.match(page, /window\.matchMedia\("\(max-width: 560px\)"\)\.matches/);
  assert.match(page, /const drawFirstWorkflow = deriveDrawFirstWorkflow\(\{/);
  assert.match(page, /const drawStepComplete = drawFirstWorkflow\.complete/);
  assert.match(page, /const airflowStepComplete = Boolean\(\s*drawStepComplete &&/);
  assert.match(page, /airflowStepComplete \? "complete" : "attention"/);
  assert.match(page, /runNumber\?: string/);
  assert.match(page, /sizeReviewed\?: boolean/);
  assert.match(page, /type SheetScaleState = \{/);
  assert.match(page, /version: 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8 \| 9;/);
  assert.match(page, /sheetScales\?: Record<string, SheetScaleState>/);
  assert.match(
    page,
    /const buildProjectSnapshot = useCallback\(\(\): SavedProject => \{[\s\S]*?return \{\s*version: 9,/,
  );
  assert.match(page, /restoredSheetScales\["1"\] = legacyScale/);
  assert.doesNotMatch(page, /legacyPages/);
  assert.match(page, /activateSheetScale\(nextPage\)/);
  assert.match(page, /rememberActiveSheetScale\(page, \{/);
  assert.match(page, /scaleStateForPage\(drawing\.page\)\.feetPerUnit/);
  assert.match(page, /sizeReviewed: activeTool === "fresh" \? true : false/);
  assert.doesNotMatch(page, /SIZE LATER/);
  assert.match(page, /drawing\.sizeReviewed === true \? `\$\{drawing\.size\}"/);
  assert.match(page, /\.filter\(Boolean\)\.join\(" · "\)/);
  assert.match(page, /POST-DRAW DETAIL PASS/);
  assert.match(page, /function assignRunNumbers\(type: "supply" \| "return"\)/);
  assert.match(page, /function terminalLinkedRunId\(drawing: Drawing\)/);
  assert.match(page, /\["diffuser", "returnGrille"\]\.includes\(drawing\.symbol\?\.kind \|\| ""\)[\s\S]{0,100}drawing\.symbol\?\.connectedRunId/);
  assert.match(page, /function confirmSelectedRunSize\(\)/);
  assert.match(page, /function focusNextRunDetail\(type\?: "supply" \| "return"\)/);
  assert.match(page, /id: "draw",\s*label: "Draw & Detail"/);
  const postDrawSizeBody = page.slice(
    page.indexOf("function updateSelectedSize"),
    page.indexOf("function updateRunLineWeight"),
  );
  assert.match(
    postDrawSizeBody,
    /synchronizeFittingSizes\(resized, drawings, \{ snapEndpoints: false \}\)/,
    "post-draw size review must update fitting metadata without moving run endpoints",
  );

  const drawFirstLabels = [
    "Draw routes",
    "Flex details",
    "Add returns",
    "Connect &amp; repair",
  ];
  let previousDrawFirstLabel = -1;
  for (const label of drawFirstLabels) {
    const labelIndex = page.indexOf(label);
    assert.ok(labelIndex > previousDrawFirstLabel, `${label} should appear in draw-first stage order`);
    previousDrawFirstLabel = labelIndex;
  }

  assert.match(jobWorkflow, /export type DrawFirstStage =\s*\| "routes"\s*\| "flex-details"\s*\| "returns"\s*\| "connections"\s*\| "complete"/);
  assert.match(jobWorkflow, /if \(input\.pendingSupplyNumbers \|\| input\.pendingSupplySizes\)/);
  assert.match(jobWorkflow, /input\.pendingReturnNumbers \|\|\s*input\.pendingReturnSizes/);
  assert.match(jobWorkflow, /if \(!input\.connectionsComplete \|\| input\.connectionProblems\)/);

  assert.match(home, /Continue current job/);
  assert.match(home, /Open PDF and start drawing/);
  assert.match(home, /Open saved jobs/);
  assert.match(home, /Drive unavailable/);
  assert.match(home, /disabled=\{!hasPlan\}/);
  assert.doesNotMatch(home, /PLAN REVIEW QUEUE|PROFESSIONAL · COMING SOON|Owner analytics/);

  assert.match(cloud, /CURRENT JOB STEP/);
  assert.match(cloud, /currentStepLabel/);
  assert.match(cloud, /currentStepDetail/);
  assert.match(cloud, /currentStepProgress/);
  assert.doesNotMatch(cloud, /NEXT SAFE ACTION/);

  assert.match(helper, /export type PlanHelperPrimaryView = "setup" \| "fix-plan" \| "problems" \| "fixes"/);
  assert.match(helper, /const PRIMARY_VIEW_ORDER: AssistantView\[\] = \["setup", "repair-plan"\]/);
  assert.match(helper, /\["setup", "Plan setup"/);
  assert.match(helper, /\["repair-plan", "Fix Plan"/);
  assert.match(helper, /\["history", "History & Undo"/);
  assert.match(helper, /\["standards", "My HVAC Rules"/);
  assert.match(helper, /\["evidence", "Source details"/);
  assert.match(helper, /onUseDetectedScale: \(candidate: PlanScaleCandidate, page: number\) => void/);
  assert.match(helper, /onUseDetectedScale\(selected, scale\.page\)/);
  assert.match(helper, /onUseDetectedScale\(candidate, scale\.page\)/);
  assert.doesNotMatch(helper, /onUseDetectedScale\(selected\.label, scale\.page\)/);
  assert.match(helper, /const usableCandidates = scale\.candidates\.filter/);
  assert.match(helper, /scale\.conflict && usableCandidates\.map\(\(candidate\)/);
  assert.match(helper, /className="primary scale-choice"/);
  assert.match(helper, /const appliedScaleLabel = confirmedScaleByPage\[String\(scale\.page\)\]/);
  assert.match(helper, /disabled=\{appliedScaleLabel === candidate\.label\}/);
  assert.match(helper, /onStartCalibration\(scale\.page\)/);
  assert.match(helper, /scale\.conflict\s*\? `\$\{scale\.candidates\.length\} scales found`/);
  assert.doesNotMatch(helper, />V(?:113|114|120)</);
  assert.ok(
    helper.indexOf('id="assistant-panel-repair-plan"') < helper.indexOf('className="assistant-mode-strip"'),
    "fix permission controls should live inside the Fixes panel",
  );

  assert.match(styles, /\.builder-workflow \.builder-action-card\.other-step \{\s*display: none;/);
  assert.match(styles, /\.builder-current-step-summary/);
  assert.match(styles, /\.app-shell\.tablet-layout \.left-panel,[\s\S]*?padding-bottom: calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.assistant-more-tools \{[\s\S]*?overflow-x: auto;/);
  assert.match(layout, /HVAC Plan Studio · Field Redline Studio/);
  assert.doesNotMatch(layout, /\/og-v\d+\.png|summary_large_image|images\s*:/);

  assert.match(page, /function applyDetectedPlanScale\(candidate: PlanScaleCandidate, page: number\)/);
  assert.match(page, /if \(applyResolvedScale\(candidate, page\)\)/);
  assert.match(page, /startPlanScaleCalibration\(page, candidate\.label\)/);
  assert.match(page, /const \[scaleHelperReturnPending, setScaleHelperReturnPending\] = useState\(false\)/);
  assert.match(page, /function startPlanScaleCalibration[\s\S]{0,300}setScaleHelperReturnPending\(true\)/);
  assert.match(page, /function cancelPlanScaleCalibration[\s\S]{0,400}openMarkupAssistant\("setup"\)/);
  assert.match(page, /if \(returnToHelper\) window\.requestAnimationFrame\(\(\) => openMarkupAssistant\("setup"\)\)/);
  assert.match(page, /Cancel &amp; return to Plan Helper/);
  assert.match(drawingScale, /candidate\.ratio && candidate\.ratio > 0\s*\? candidate\.ratio\s*: scaleRatioFromLabel\(candidate\.label\)/);
  assert.match(drawingScale, /ratio \/ \(12 \* PDF_POINTS_PER_INCH \* viewportScale\)/);

  assert.match(helper, /Nothing is selected automatically/);
  assert.match(helper, /preparedRepairPlanId !== repairPlan\.id/);
  assert.match(helper, /autonomyMode !== "guided"/);
  assert.match(helper, /onUndoRepairBatch/);
});
