import assert from "node:assert/strict";
import test from "node:test";

import { loadTypescriptModule } from "./load-typescript-module.mjs";

const fieldExport = await loadTypescriptModule(
  new URL("../app/fieldRedlineExport.ts", import.meta.url),
);

const COMPLETE_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

function basePlan(overrides = {}) {
  return {
    sheet: {
      id: "sheet-a1",
      page: 1,
      label: "A1.1",
      width: 1600,
      height: 900,
    },
    scope: { kind: "current-sheet" },
    preset: "standard",
    format: "png",
    filename: "North Wing A1.1",
    sourceFingerprint: "pdf-source-a",
    committedSceneFingerprint: "scene-a",
    hvacRelease: {
      current: true,
      revision: "IFC-1",
      fingerprint: "release-a",
    },
    redlines: {
      visibleCount: 2,
      fingerprint: "redlines-a",
      reviewedFingerprint: "redlines-a",
    },
    projectName: "North Wing",
    systemName: "System 1",
    reviewer: "FL",
    exportedAt: "2026-07-28T22:15:00-07:00",
    ...overrides,
  };
}

function canvas(width, height, options = {}) {
  const calls = [];
  return {
    width,
    height,
    calls,
    toBlob(callback, type, quality) {
      calls.push({ type, quality });
      if (options.throwError) throw options.throwError;
      if (options.nullBlob) {
        callback(null);
        return;
      }
      const bytes = type === "image/jpeg"
        ? COMPLETE_JPEG
        : new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      callback(new Blob([bytes], { type }));
    },
  };
}

test("publishes controlled raster limits and keeps transient roles out of the allowlist", () => {
  assert.equal(fieldExport.FIELD_REDLINE_EXPORT_LIMITS.maxPixels, 8_294_400);
  assert.equal(fieldExport.FIELD_REDLINE_EXPORT_LIMITS.maxAxis, 5_120);
  assert.equal(fieldExport.FIELD_REDLINE_EXPORT_LIMITS.fourKLongEdge, 4_096);
  assert.equal(fieldExport.FIELD_REDLINE_EXPORT_LIMITS.selectedAreaPadding, 24);
  assert.ok(fieldExport.FIELD_REDLINE_EXPORT_CONTENT_ALLOWLIST.includes("field-redlines"));
  assert.ok(fieldExport.FIELD_REDLINE_EXPORT_TRANSIENT_EXCLUSIONS.includes("selection-handles"));
  assert.ok(fieldExport.FIELD_REDLINE_EXPORT_TRANSIENT_EXCLUSIONS.includes("in-progress-strokes"));
  assert.equal(
    fieldExport.FIELD_REDLINE_EXPORT_ROLE_ATTRIBUTE,
    "data-field-redline-export-role",
  );
  assert.equal(
    fieldExport.FIELD_REDLINE_TRANSIENT_ROLE_ATTRIBUTE,
    "data-field-redline-transient-role",
  );
  assert.deepEqual(
    fieldExport.FIELD_REDLINE_EXPORT_CONTENT_ALLOWLIST.filter((role) =>
      fieldExport.FIELD_REDLINE_EXPORT_TRANSIENT_EXCLUSIONS.includes(role)),
    [],
  );
});

test("uses the exact current sheet as the full-sheet crop", () => {
  assert.deepEqual(
    fieldExport.resolveFieldRedlineExportCrop(
      { width: 1200.5, height: 800.25 },
      { kind: "current-sheet" },
    ),
    {
      kind: "current-sheet",
      x: 0,
      y: 0,
      width: 1200.5,
      height: 800.25,
      padding: 0,
    },
  );
});

test("normalizes reverse-drag selections and applies deterministic outward padding", () => {
  const crop = fieldExport.resolveFieldRedlineExportCrop(
    { width: 1000, height: 800 },
    {
      kind: "selected-area",
      selection: { x: 300.8, y: 240.2, width: -100.3, height: -80.1 },
      padding: 10.5,
    },
  );
  assert.deepEqual(crop, {
    kind: "selected-area",
    x: 190,
    y: 149,
    width: 122,
    height: 102,
    padding: 10.5,
  });
});

test("clamps selected-area padding to the sheet and rejects empty or detached selections", () => {
  assert.deepEqual(
    fieldExport.resolveFieldRedlineExportCrop(
      { width: 500, height: 400 },
      {
        kind: "selected-area",
        selection: { x: 4, y: 5, width: 20, height: 30 },
      },
    ),
    {
      kind: "selected-area",
      x: 0,
      y: 0,
      width: 48,
      height: 59,
      padding: 24,
    },
  );
  assert.throws(
    () => fieldExport.resolveFieldRedlineExportCrop(
      { width: 500, height: 400 },
      {
        kind: "selected-area",
        selection: { x: 20, y: 20, width: 0, height: 30 },
      },
    ),
    /width and height/,
  );
  assert.throws(
    () => fieldExport.resolveFieldRedlineExportCrop(
      { width: 500, height: 400 },
      {
        kind: "selected-area",
        selection: { x: 700, y: 600, width: 20, height: 30 },
        padding: 0,
      },
    ),
    /intersect/,
  );
});

test("resolves Standard output without distorting aspect ratio", () => {
  assert.deepEqual(
    fieldExport.resolveFieldRedlineRasterSize(
      { width: 1600, height: 900 },
      "standard",
    ),
    {
      width: 2048,
      height: 1152,
      requestedLongEdge: 2048,
      actualLongEdge: 2048,
      pixelCount: 2_359_296,
      preset: "standard",
    },
  );
});

test("accepts a 4096 request but enforces both pixel-area and axis ceilings", () => {
  const common = fieldExport.resolveFieldRedlineRasterSize(
    { width: 1600, height: 900 },
    "4k",
  );
  assert.equal(common.requestedLongEdge, 4096);
  assert.equal(common.width, 3840);
  assert.equal(common.height, 2160);
  assert.equal(common.pixelCount, 8_294_400);

  const square = fieldExport.resolveFieldRedlineRasterSize(
    { width: 1000, height: 1000 },
    "4k",
  );
  assert.deepEqual(
    { width: square.width, height: square.height },
    { width: 2880, height: 2880 },
  );

  const extreme = fieldExport.resolveFieldRedlineRasterSize(
    { width: 10000, height: 10 },
    "4k",
    50_000,
  );
  assert.equal(extreme.requestedLongEdge, 50_000);
  assert.equal(extreme.width, 5120);
  assert.ok(extreme.height >= 1);
  assert.ok(extreme.width * extreme.height <= 8_294_400);
});

test("normalizes only PNG, JPG, and PDF formats", () => {
  assert.equal(fieldExport.normalizeFieldRedlineExportFormat(".PNG"), "png");
  assert.equal(fieldExport.normalizeFieldRedlineExportFormat("jpeg"), "jpg");
  assert.equal(fieldExport.normalizeFieldRedlineExportFormat("image/jpeg"), "jpg");
  assert.equal(fieldExport.normalizeFieldRedlineExportFormat("application/pdf"), "pdf");
  assert.equal(fieldExport.fieldRedlineExportMimeType("jpg"), "image/jpeg");
  assert.throws(
    () => fieldExport.normalizeFieldRedlineExportFormat("svg"),
    /PNG, JPG, or PDF/,
  );
});

test("sanitizes extensions, paths, reserved names, and overlong filenames", () => {
  assert.equal(
    fieldExport.sanitizeFieldRedlineExportFilename(
      "../North:Wing/A1.1?.jpeg",
      "pdf",
    ),
    "North-Wing-A1-1.pdf",
  );
  assert.equal(
    fieldExport.sanitizeFieldRedlineExportFilename("CON", "png"),
    "hvac-CON.png",
  );
  assert.equal(
    fieldExport.sanitizeFieldRedlineExportFilename("   ", "jpg"),
    "field-redline.jpg",
  );
  const longName = fieldExport.sanitizeFieldRedlineExportFilename(
    "x".repeat(400),
    "png",
  );
  assert.equal(Array.from(longName).length, 120);
  assert.match(longName, /\.png$/);
});

test("filters requested content into canonical allowlist order", () => {
  assert.deepEqual(
    fieldExport.normalizeFieldRedlineExportContent([
      "field-redlines",
      "unknown-role",
      "source-plan",
      "field-redlines",
    ]),
    ["source-plan", "field-redlines"],
  );
  assert.throws(
    () => fieldExport.normalizeFieldRedlineExportContent(["temporary-only"]),
    /at least one committed/,
  );
});

test("keeps HVAC release current while changed visible redlines make only the artifact draft", () => {
  const hvacRelease = {
    current: true,
    revision: "IFC-1",
    fingerprint: "release-a",
  };
  const before = { ...hvacRelease };
  const status = fieldExport.resolveFieldRedlineArtifactStatus({
    hvacRelease,
    redlines: {
      visibleCount: 3,
      fingerprint: "redlines-b",
      reviewedFingerprint: "redlines-a",
    },
  });
  assert.deepEqual(hvacRelease, before);
  assert.equal(status.artifactState, "draft");
  assert.equal(status.hvacReleaseCurrent, true);
  assert.equal(status.hvacReleaseLabel, "Current · IFC-1");
  assert.equal(status.redlineReview, "changed");
  assert.equal(status.redlinesChanged, true);
  assert.deepEqual(status.reasons, ["visible-redlines-changed"]);
  assert.equal(status.label, "DRAFT · FIELD REDLINES CHANGED");
});

test("distinguishes unreviewed, current, hidden, and non-current release states", () => {
  const release = { current: true, revision: "IFC-1" };
  assert.equal(
    fieldExport.resolveFieldRedlineArtifactStatus({
      hvacRelease: release,
      redlines: { visibleCount: 1, fingerprint: "a" },
    }).redlineReview,
    "unreviewed",
  );
  assert.equal(
    fieldExport.resolveFieldRedlineArtifactStatus({
      hvacRelease: release,
      redlines: {
        visibleCount: 1,
        fingerprint: "a",
        reviewedFingerprint: "a",
      },
    }).artifactState,
    "current",
  );
  assert.equal(
    fieldExport.resolveFieldRedlineArtifactStatus({
      hvacRelease: release,
      redlines: {
        visibleCount: 0,
        fingerprint: "changed",
        reviewedFingerprint: "old",
      },
    }).artifactState,
    "current",
  );
  const unreleased = fieldExport.resolveFieldRedlineArtifactStatus({
    hvacRelease: { current: false, revision: "IFC-1" },
    redlines: { visibleCount: 0 },
  });
  assert.equal(unreleased.artifactState, "draft");
  assert.deepEqual(unreleased.reasons, ["hvac-release-not-current"]);
});

test("builds a visible footer that states redline and HVAC release status separately", () => {
  const status = fieldExport.resolveFieldRedlineArtifactStatus({
    hvacRelease: { current: true, revision: "IFC-1" },
    redlines: {
      visibleCount: 1,
      fingerprint: "changed",
      reviewedFingerprint: "old",
    },
  });
  const footer = fieldExport.buildFieldRedlineFooterModel({
    projectName: "North\nWing",
    sheetLabel: "A1.1",
    systemName: "System 1",
    revision: "IFC-1",
    reviewer: "FL",
    exportedAt: "2026-07-29T05:15:00.000Z",
    artifactFingerprint: "fre-v133-test",
    status,
  });
  assert.equal(footer.featureLabel, "Field Redline");
  assert.equal(
    footer.approvalNotice,
    "FIELD REDLINE - NOT APPROVED HVAC DESIGN",
  );
  assert.equal(footer.statusStamp, "DRAFT · FIELD REDLINES CHANGED");
  assert.equal(footer.title, "North Wing · A1.1");
  assert.equal(
    footer.fields.find((field) => field.key === "hvac-release").value,
    "Current · IFC-1",
  );
  assert.equal(
    footer.fields.find((field) => field.key === "redline-review").value,
    "Changed after review",
  );
  assert.match(footer.notice, /issued HVAC release remains current/);
});

test("canonical fingerprinting is stable across object key order", () => {
  const left = { z: 1, nested: { b: 2, a: 1 } };
  const right = { nested: { a: 1, b: 2 }, z: 1 };
  assert.equal(
    fieldExport.canonicalFieldRedlineJson(left),
    fieldExport.canonicalFieldRedlineJson(right),
  );
});

test("plans a committed-scene export with deterministic fingerprint inputs", () => {
  const first = fieldExport.buildFieldRedlineExportPlan(basePlan({
    format: "jpeg",
    includedContent: [
      "field-redlines",
      "source-plan",
      "selection-handles",
      "hvac-runs",
    ],
  }));
  const second = fieldExport.buildFieldRedlineExportPlan(basePlan({
    format: "jpeg",
    includedContent: [
      "field-redlines",
      "source-plan",
      "selection-handles",
      "hvac-runs",
    ],
  }));
  assert.equal(first.format, "jpg");
  assert.equal(first.mimeType, "image/jpeg");
  assert.equal(first.filename, "North-Wing-A1-1.jpg");
  assert.equal(first.status.artifactState, "current");
  assert.deepEqual(first.includedContent, [
    "source-plan",
    "hvac-runs",
    "field-redlines",
  ]);
  assert.ok(first.excludedTransientContent.includes("selection-handles"));
  assert.equal(
    first.artifactFingerprintInputs.metadata.exportedAt,
    "2026-07-29T05:15:00.000Z",
  );
  assert.equal(first.artifactFingerprint, second.artifactFingerprint);
  assert.equal(
    first.renderRequest.artifactFingerprint,
    first.artifactFingerprint,
  );
  assert.strictEqual(first.renderRequest.footer, first.footer);
});

test("fingerprints scope, committed scene, status, format, and metadata changes", () => {
  const baseline = fieldExport.buildFieldRedlineExportPlan(basePlan());
  const variants = [
    basePlan({ committedSceneFingerprint: "scene-b" }),
    basePlan({
      scope: {
        kind: "selected-area",
        selection: { x: 100, y: 100, width: 400, height: 300 },
      },
    }),
    basePlan({ format: "pdf" }),
    basePlan({ reviewer: "AB" }),
    basePlan({
      redlines: {
        visibleCount: 2,
        fingerprint: "redlines-b",
        reviewedFingerprint: "redlines-a",
      },
    }),
  ];
  for (const variant of variants) {
    assert.notEqual(
      fieldExport.buildFieldRedlineExportPlan(variant).artifactFingerprint,
      baseline.artifactFingerprint,
    );
  }
});

test("canvas raster encoding selects the right MIME type and JPEG quality", async () => {
  const source = canvas(100, 80);
  const png = await fieldExport.canvasToFieldRedlineRasterBlob(source, "png");
  const jpg = await fieldExport.canvasToFieldRedlineRasterBlob(source, "jpeg", 0.8);
  assert.equal(png.type, "image/png");
  assert.equal(jpg.type, "image/jpeg");
  assert.deepEqual(source.calls, [
    { type: "image/png", quality: undefined },
    { type: "image/jpeg", quality: 0.8 },
  ]);
  await assert.rejects(
    fieldExport.canvasToFieldRedlineRasterBlob(canvas(1, 1, { nullBlob: true }), "png"),
    /could not encode/,
  );
  assert.throws(
    () => fieldExport.canvasToFieldRedlineRasterBlob(source, "jpg", 2),
    /between zero and one/,
  );
});

test("resolves a printable PDF page without changing raster aspect", () => {
  const landscape = fieldExport.resolveFieldRedlinePdfPageSize({
    width: 3840,
    height: 2160,
  });
  assert.deepEqual(landscape, {
    widthPoints: 1224,
    heightPoints: 688.5,
  });
  const portrait = fieldExport.resolveFieldRedlinePdfPageSize({
    width: 1000,
    height: 2000,
  });
  assert.deepEqual(portrait, {
    widthPoints: 612,
    heightPoints: 1224,
  });
});

test("builds a valid one-page PDF with byte-accurate xref offsets and embedded JPEG", () => {
  const bytes = fieldExport.buildSinglePageJpegPdf({
    jpegBytes: COMPLETE_JPEG,
    imageWidth: 1600,
    imageHeight: 900,
    title: "North Wing (A1.1)",
    subject: "Current \\ field export",
    creator: "HVAC Plan Studio",
    createdAt: "2026-07-29T05:15:00.000Z",
  });
  const text = Buffer.from(bytes).toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4\n%âãÏÓ\n"));
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /\/Subtype \/Image/);
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /\/MediaBox \[0 0 1224 688\.5\]/);
  assert.match(text, /North Wing \\\(A1\.1\\\)/);
  assert.match(text, /Current \\\\ field export/);
  assert.match(text, /\/CreationDate \(D:20260729051500Z\)/);
  assert.ok(Buffer.from(bytes).includes(Buffer.from(COMPLETE_JPEG)));

  const startXref = Number(text.match(/startxref\n(\d+)\n%%EOF/)?.[1]);
  assert.equal(text.slice(startXref, startXref + 4), "xref");
  const xrefEntries = text
    .slice(startXref)
    .match(/xref\n0 7\n([\s\S]*?)trailer/)?.[1]
    .trimEnd()
    .split("\n");
  assert.equal(xrefEntries.length, 7);
  for (let objectNumber = 1; objectNumber <= 6; objectNumber += 1) {
    const offset = Number(xrefEntries[objectNumber].slice(0, 10));
    assert.equal(
      text.slice(offset, offset + `${objectNumber} 0 obj`.length),
      `${objectNumber} 0 obj`,
    );
  }
});

test("rejects incomplete JPEG data and rasters beyond controlled limits", () => {
  assert.throws(
    () => fieldExport.buildSinglePageJpegPdf({
      jpegBytes: new Uint8Array([1, 2, 3, 4]),
      imageWidth: 100,
      imageHeight: 100,
    }),
    /complete JPEG/,
  );
  assert.throws(
    () => fieldExport.buildSinglePageJpegPdf({
      jpegBytes: COMPLETE_JPEG,
      imageWidth: 5121,
      imageHeight: 1,
    }),
    /controlled export limits/,
  );
});

test("wraps a committed canvas in an actual PDF Blob", async () => {
  const source = canvas(1600, 900);
  const blob = await fieldExport.canvasToFieldRedlinePdfBlob(source, {
    title: "North Wing",
    createdAt: "2026-07-29T05:15:00.000Z",
  });
  assert.equal(blob.type, "application/pdf");
  assert.equal(
    Buffer.from(await blob.arrayBuffer()).subarray(0, 8).toString(),
    "%PDF-1.4",
  );
  assert.deepEqual(source.calls, [
    { type: "image/jpeg", quality: 0.92 },
  ]);
});

test("renders only through the committed-scene callback and preserves artifact metadata", async () => {
  const plan = fieldExport.buildFieldRedlineExportPlan(basePlan());
  let request;
  const artifact = await fieldExport.renderFieldRedlineExportArtifact(
    plan,
    async (received) => {
      request = received;
      return canvas(received.pixelSize.width, received.pixelSize.height);
    },
  );
  assert.strictEqual(request, plan.renderRequest);
  assert.ok(request.excludedTransientContent.includes("action-wheel"));
  assert.ok(request.excludedTransientContent.includes("in-progress-strokes"));
  assert.equal(artifact.blob.type, "image/png");
  assert.equal(artifact.filename, "North-Wing-A1-1.png");
  assert.equal(artifact.artifactFingerprint, plan.artifactFingerprint);
  assert.strictEqual(artifact.status, plan.status);

  await assert.rejects(
    fieldExport.renderFieldRedlineExportArtifact(
      plan,
      () => canvas(plan.raster.width - 1, plan.raster.height),
    ),
    /expected/,
  );
});

test("renders PDF artifacts from the same committed-scene callback", async () => {
  const plan = fieldExport.buildFieldRedlineExportPlan(basePlan({
    format: "pdf",
  }));
  const artifact = await fieldExport.renderFieldRedlineExportArtifact(
    plan,
    (request) => canvas(request.pixelSize.width, request.pixelSize.height),
  );
  assert.equal(artifact.blob.type, "application/pdf");
  assert.equal(artifact.mimeType, "application/pdf");
  assert.match(artifact.filename, /\.pdf$/);
  assert.equal(
    Buffer.from(await artifact.blob.arrayBuffer()).subarray(0, 8).toString(),
    "%PDF-1.4",
  );
});

test("releases object URLs after download and removes the temporary anchor", () => {
  const events = [];
  let scheduled;
  let scheduledDelay;
  const anchor = {
    href: "",
    download: "",
    rel: "",
    click() {
      events.push(["click", this.href, this.download, this.rel]);
    },
    remove() {
      events.push(["remove"]);
    },
  };
  fieldExport.downloadFieldRedlineExportArtifact(
    {
      blob: new Blob(["test"], { type: "image/png" }),
      filename: "field-redline.png",
    },
    {
      createObjectURL(blob) {
        events.push(["create", blob.type]);
        return "blob:field-redline";
      },
      revokeObjectURL(url) {
        events.push(["revoke", url]);
      },
      createAnchor() {
        return anchor;
      },
      scheduleRelease(release, delayMilliseconds) {
        scheduled = release;
        scheduledDelay = delayMilliseconds;
        events.push(["schedule", delayMilliseconds]);
      },
    },
  );
  assert.deepEqual(events, [
    ["create", "image/png"],
    ["click", "blob:field-redline", "field-redline.png", "noopener"],
    ["schedule", fieldExport.FIELD_REDLINE_DOWNLOAD_RELEASE_DELAY_MS],
  ]);
  assert.equal(scheduledDelay, 1_500);
  scheduled();
  assert.deepEqual(events.slice(-2), [
    ["revoke", "blob:field-redline"],
    ["remove"],
  ]);
  scheduled();
  assert.equal(
    events.filter(([kind]) => kind === "revoke").length,
    1,
  );
  assert.equal(
    events.filter(([kind]) => kind === "remove").length,
    1,
  );
});

test("keeps PDF object URLs alive while mobile and in-app viewers load them", () => {
  const events = [];
  let scheduled;
  let scheduledDelay;
  const anchor = {
    href: "",
    download: "",
    rel: "",
    target: "",
    click() {
      events.push([
        "click",
        this.href,
        this.download,
        this.rel,
        this.target,
      ]);
    },
    remove() {
      events.push(["remove"]);
    },
  };

  fieldExport.downloadFieldRedlineExportArtifact(
    {
      blob: new Blob(["pdf"], { type: "application/pdf" }),
      filename: "field-redline.pdf",
    },
    {
      createObjectURL(blob) {
        events.push(["create", blob.type]);
        return "blob:field-redline-pdf";
      },
      revokeObjectURL(url) {
        events.push(["revoke", url]);
      },
      createAnchor() {
        return anchor;
      },
      scheduleRelease(release, delayMilliseconds) {
        scheduled = release;
        scheduledDelay = delayMilliseconds;
        events.push(["schedule", delayMilliseconds]);
      },
    },
  );

  assert.deepEqual(events, [
    ["create", "application/pdf"],
    [
      "click",
      "blob:field-redline-pdf",
      "field-redline.pdf",
      "noopener",
      "_blank",
    ],
    ["schedule", fieldExport.FIELD_REDLINE_PDF_DOWNLOAD_RELEASE_DELAY_MS],
  ]);
  assert.equal(
    scheduledDelay,
    fieldExport.FIELD_REDLINE_PDF_DOWNLOAD_RELEASE_DELAY_MS,
  );
  assert.ok(scheduledDelay >= 60_000);
  assert.equal(
    events.some(([kind]) => kind === "revoke"),
    false,
  );

  scheduled();
  assert.deepEqual(events.slice(-2), [
    ["revoke", "blob:field-redline-pdf"],
    ["remove"],
  ]);
});

test("releases the object URL immediately when a download click fails", () => {
  const revoked = [];
  assert.throws(
    () => fieldExport.downloadFieldRedlineExportArtifact(
      {
        blob: new Blob(["test"]),
        filename: "field-redline.png",
      },
      {
        createObjectURL: () => "blob:failed",
        revokeObjectURL: (url) => revoked.push(url),
        createAnchor: () => ({
          href: "",
          download: "",
          rel: "",
          click: () => {
            throw new Error("blocked");
          },
        }),
        scheduleRelease: () => {
          throw new Error("must not schedule");
        },
      },
    ),
    /blocked/,
  );
  assert.deepEqual(revoked, ["blob:failed"]);
});
