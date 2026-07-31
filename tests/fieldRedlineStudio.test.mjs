import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const studioPath = new URL("../app/FieldRedlineStudio.tsx", import.meta.url);
const wheelPath = new URL("../app/RedlineActionWheel.tsx", import.meta.url);
const canvasPath = new URL("../app/RedlineCanvasLayer.tsx", import.meta.url);
const visualBoundsPath = new URL("../app/redlineVisualBounds.ts", import.meta.url);
const stylesPath = new URL("../app/globals.css", import.meta.url);

async function sources() {
  const [studio, wheel, canvas, visualBounds] = await Promise.all([
    readFile(studioPath, "utf8"),
    readFile(wheelPath, "utf8"),
    readFile(canvasPath, "utf8"),
    readFile(visualBoundsPath, "utf8"),
  ]);
  return { studio, wheel, canvas, visualBounds };
}

test("Field Redline Studio keeps the compact tool order and HVAC safety boundary", async () => {
  const { studio } = await sources();
  const orderedTools = [
    '"select"',
    '"pen"',
    '"highlight"',
    '"square-mark"',
    '"round-mark"',
    '"erase"',
    '"arrow"',
    '"cloud"',
    '"text"',
    '"lasso"',
  ];
  let previousIndex = -1;
  for (const tool of orderedTools) {
    const index = studio.indexOf(`id: ${tool}`);
    assert.ok(index > previousIndex, `${tool} should keep its compact dock order`);
    previousIndex = index;
  }

  assert.match(studio, /Field Redline Studio/);
  assert.match(studio, /\{ id: "square-mark", label: "Square pen"/);
  assert.match(studio, /\{ id: "round-mark", label: "Circle pen"/);
  assert.equal(
    (studio.match(/\{ id: "square-mark", label:/g) || []).length,
    1,
  );
  assert.equal(
    (studio.match(/\{ id: "round-mark", label:/g) || []).length,
    1,
  );
  assert.doesNotMatch(studio, /Notebook(?: Pro|-style| style)/i);
  assert.match(
    studio,
    /Redlines never change runs, CFM, sizes, fittings, or connections\./,
  );
  assert.match(studio, /They stay on their own plan layer\./);
  assert.match(studio, /length: 4/);
  assert.match(studio, /minWidth: 44,[\s\S]*minHeight: 44/);
  assert.match(studio, /role="toolbar"[\s\S]*aria-label="Field redline tools"/);
  assert.match(studio, /inert=\{dialog \? true : undefined\}/);
});

test("the dock progressively reveals style and controls layer visibility, lock, and opacity", async () => {
  const { studio } = await sources();

  assert.match(studio, /aria-expanded=\{stylePanelOpen\}/);
  assert.match(studio, /id="redline-style-panel"/);
  assert.match(studio, /Line color/);
  assert.match(studio, /Pen color/);
  assert.match(studio, /Tip size/);
  assert.match(studio, /min=\{0\.001\}/);
  assert.match(studio, /max=\{0\.04\}/);
  assert.match(
    studio,
    /Drag to paint a continuous trail\. One drag is one Undo\./,
  );
  assert.match(studio, /Line width/);
  assert.match(studio, /min=\{0\.00025\}/);
  assert.match(studio, /max=\{0\.04\}/);
  assert.match(studio, /step=\{0\.00025\}/);
  assert.match(studio, /Opacity/);
  assert.match(studio, /aria-label="Eraser size"/);
  assert.match(studio, /REDLINE_ERASER_MIN_SIZE/);
  assert.match(studio, /REDLINE_ERASER_MAX_SIZE/);
  assert.match(studio, /REDLINE_ERASER_SIZE_STEP/);
  assert.match(studio, /aria-valuetext=\{`\$\{eraserSizePercent\}% brush diameter`\}/);
  assert.match(studio, /role="group"[\s\S]*aria-label="Eraser size presets"/);
  assert.match(studio, /Drag across redlines\. One drag is one Undo\./);
  assert.match(studio, /\["Large", 0\.08\]/);
  assert.match(studio, /Show or hide redline layer/);
  assert.match(studio, /Lock or unlock redline layer/);
  assert.match(studio, /Layer opacity/);
  assert.match(studio, /My Details/);
  assert.match(studio, />\s*Export\s*</);
  assert.match(studio, />\s*Done\s*</);
});

test("square and circle are direct filled pen tips without shape sizing controls", async () => {
  const { studio } = await sources();

  assert.match(studio, /const markTool = isRedlineMarkTool\(activeTool\)/);
  assert.match(studio, /\{ id: "square-mark", label: "Square pen"/);
  assert.match(studio, /\{ id: "round-mark", label: "Circle pen"/);
  assert.doesNotMatch(studio, /Shape fill/);
  assert.doesNotMatch(studio, /Shape fill mode/);
  assert.doesNotMatch(studio, />\s*Solid\s*</);
  assert.doesNotMatch(studio, />\s*Outline\s*</);
  assert.doesNotMatch(studio, />\s*Fill color\s*</);
});

test("the eraser uses an active brush cursor instead of a blocked cursor", async () => {
  const styles = await readFile(stylesPath, "utf8");
  assert.match(
    styles,
    /\.drawing-layer\.field-redline-active\.redline-tool-erase\s*\{\s*cursor: crosshair;/,
  );
  assert.match(styles, /\.redline-transient-eraser\s*\{/);
  assert.doesNotMatch(
    styles,
    /\.redline-tool-erase \.redline-annotation\s*\{\s*cursor: not-allowed;/,
  );
});

test("compact and short-height docks keep Style controls inside the scroll flow", async () => {
  const styles = await readFile(stylesPath, "utf8");
  const compactStart = styles.indexOf("@media (max-width: 900px)");
  const shortStart = styles.indexOf(
    "@media (max-height: 700px) and (min-width: 901px)",
  );
  assert.ok(compactStart >= 0);
  assert.ok(shortStart > compactStart);

  const compact = styles.slice(compactStart, shortStart);
  assert.match(compact, /"style style"/);
  assert.match(compact, /"layer layer"/);
  assert.match(
    compact,
    /\.redline-style-panel\s*\{[\s\S]*?position: static;[\s\S]*?width: 100%;/,
  );

  const shortHeight = styles.slice(shortStart);
  assert.match(
    shortHeight,
    /\.redline-style-panel\s*\{[\s\S]*?position: static;[\s\S]*?width: 100%;/,
  );
  assert.match(
    shortHeight,
    /\.redline-style-disclosure\s*\{[\s\S]*?position: relative;[\s\S]*?right: auto;[\s\S]*?bottom: auto;/,
  );
  assert.match(
    shortHeight,
    /@media \(max-height: 700px\) and \(min-width: 901px\) and \(max-width: 1100px\)[\s\S]*?"style style style"/,
  );
});

test("details, export, and issue drafting stay explicit and controlled", async () => {
  const { studio } = await sources();

  assert.match(studio, /type RedlineStudioDialogState =/);
  assert.match(studio, /dialog: RedlineStudioDialogState \| null/);
  assert.match(
    studio,
    /onDialogChange: \(dialog: RedlineStudioDialogState \| null\) => void/,
  );
  assert.match(
    studio,
    /onDialogConfirm: \(dialog: RedlineStudioDialogState\) => void/,
  );
  assert.match(studio, /Save to My Details/);
  assert.match(studio, /Place My Detail/);
  assert.match(studio, /transparent preview onto the sheet/);
  assert.match(studio, /detail\.defaultExtent\.width \* 100/);
  assert.match(studio, /detail\.defaultExtent\.height \* 100/);
  assert.match(studio, /Current sheet/);
  assert.match(studio, /Selected area/);
  assert.match(studio, /\["png", "jpg", "pdf"\]/);
  assert.match(studio, />\s*Standard\s*</);
  assert.match(studio, />\s*4K\s*</);
  assert.match(studio, /Create RFI draft/);
  assert.match(studio, /Create punch-list draft/);
  assert.match(
    studio,
    /\| \{\s*kind: "text";\s*text: string;\s*annotationId\?: string;\s*\}/,
  );
  assert.match(studio, /Add text redline/);
  assert.match(studio, /Edit text redline/);
  assert.match(studio, /data-autofocus[\s\S]*placeholder="Type the field note"/);
  assert.match(
    studio,
    /Creates a draft only\. Nothing is sent, assigned, or added to a tracked[\s\S]*issue until you review and save it\./,
  );

  assert.doesNotMatch(
    studio,
    /live broadcast|collaborative editing|handwriting to text|complete duct system/i,
  );
});

test("the selection wheel operates on redlines only and exposes grouped multi-selection actions", async () => {
  const { wheel } = await sources();

  assert.match(wheel, /Copy redline and place it with the mouse/);
  assert.match(wheel, /Copy selected redlines and place them with the mouse/);
  assert.match(wheel, /data-selection-scope="redlines-only"/);
  assert.match(wheel, /Redline actions only/);
  assert.match(wheel, /selectedAnnotationIds: readonly string\[\]/);
  assert.match(wheel, /"group"/);
  assert.match(wheel, /"ungroup"/);
  assert.match(wheel, /"align-left"/);
  assert.match(wheel, /"align-center"/);
  assert.match(wheel, /"align-right"/);
  assert.match(wheel, /"distribute-horizontal"/);
  assert.match(wheel, /"distribute-vertical"/);
  assert.match(wheel, /"save-detail"/);
  assert.match(wheel, /"create-rfi-draft"/);
  assert.match(wheel, /"create-punch-draft"/);
  assert.match(wheel, /Rotate redline left 15 degrees/);
  assert.match(wheel, /Rotate redline right 15 degrees/);
  assert.match(wheel, /minWidth: 44,[\s\S]*minHeight: 44/);
  assert.doesNotMatch(wheel, /duct run|fitting actions|CFM|connection/i);
});

test("the redline action component has an accessible linear fallback", async () => {
  const [{ wheel }, styles] = await Promise.all([
    sources(),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(wheel, /layout\?: "wheel" \| "strip"/);
  assert.match(wheel, /layout === "strip" \? " is-strip" : ""/);
  assert.match(
    wheel,
    /aria-orientation=\{layout === "strip" \? "horizontal" : undefined\}/,
  );
  assert.match(
    wheel,
    /onWheel=\{layout === "strip" \? \(event\) => event\.stopPropagation\(\) : undefined\}/,
  );
  assert.match(wheel, /scrollIntoView\(\{[\s\S]*?inline: "nearest"/);
  assert.match(
    styles,
    /\.redline-selection-wheel\.is-strip\s*\{[\s\S]*?display: flex;[\s\S]*?overflow-x: auto;[\s\S]*?overscroll-behavior-inline: contain;[\s\S]*?pointer-events: auto;/,
  );
  assert.match(
    styles,
    /\.redline-selection-wheel\.is-strip \.redline-wheel-action,[\s\S]*?position: static;/,
  );
});

test("the canvas overlay is SVG-only, page-bound, and renders committed plus transient redlines", async () => {
  const { canvas, visualBounds } = await sources();

  assert.match(canvas, /import type \{[\s\S]*RedlineAnnotation[\s\S]*\} from "\.\/redlineDomain"/);
  assert.match(canvas, /annotation\.layerId === layer\.id/);
  assert.match(
    canvas,
    /annotation\.binding\.sourceFingerprint === binding\.sourceFingerprint/,
  );
  assert.match(canvas, /annotation\.binding\.page === binding\.page/);
  assert.match(canvas, /width: number/);
  assert.match(canvas, /height: number/);
  assert.match(canvas, /zoom\?: number/);
  assert.match(visualBounds, /point\.x[\s\S]*size\.width/);
  assert.match(visualBounds, /point\.y[\s\S]*size\.height/);
  assert.match(
    visualBounds,
    /annotation\.style\.strokeWidth[\s\S]*size\.shortSide/,
  );
  assert.match(canvas, /redlineSelectionVisualBounds/);
  assert.match(canvas, /SELECTION_HANDLE_RADIUS_PX \/ safeZoom/);
  assert.match(canvas, /redline-canvas-committed/);
  assert.match(canvas, /redline-transient-draft/);
  assert.match(canvas, /redline-transient-lasso/);
  assert.match(canvas, /redline-transient-selection-box/);
  assert.match(canvas, /redline-transient-eraser/);
  assert.match(canvas, /data-field-redline-transient-role="active-cursors"/);
  assert.match(canvas, /redlineCanvasCalloutBounds\(\s*transient\.start,\s*transient\.end,\s*size,/);
  assert.doesNotMatch(canvas, /\bpageBounds\(/);
  assert.match(canvas, /redline-selection-overlay/);
  assert.match(canvas, /if \(!layer\.visible\) return null/);
  assert.match(canvas, /data-field-redline-export-role="field-redlines"[\s\S]*opacity=\{layerOpacity\}/);
  assert.match(
    canvas,
    /pointerEvents: interactive && !layer\.locked \? "auto" : "none"/,
  );
  assert.match(canvas, /const operable = interactive && !layer\.locked/);
  assert.match(canvas, /data-plan-edit-control=\{operable \? "redline" : undefined\}/);
  assert.match(canvas, /role=\{operable \? "button" : "img"\}/);
  assert.match(canvas, /strokeWidth=\{44\}/);
  assert.doesNotMatch(canvas, /<foreignObject|dangerouslySetInnerHTML|<div\b/i);
});
