"use client";

import {
  FIELD_REDLINE_EXPORT_ROLE_ATTRIBUTE,
  FIELD_REDLINE_TRANSIENT_ROLE_ATTRIBUTE,
  type FieldRedlineCanvasSource,
  type FieldRedlineCommittedSceneRenderRequest,
  type FieldRedlineExportContentRole,
  type FieldRedlineExportTransientRole,
} from "./fieldRedlineExport";

const LEGACY_EXPORT_ROLE_ATTRIBUTE = "data-export-role";
const LEGACY_TRANSIENT_ROLE_ATTRIBUTE = "data-export-transient-role";

const TRANSIENT_SELECTORS = [
  ".draft-drawing",
  ".measure-preview",
  ".branch-preview",
  ".branch-opportunity-marker",
  ".symbol-preview",
  ".snap-marker",
  ".alignment-guide",
  ".selection-box",
  ".network-repair-preview",
  ".step-one-repair-preview",
  ".assistant-suggestion-layer",
  ".markup-suggestion-preview",
  ".plan-evidence-region",
  ".review-marker",
  ".redline-selection-overlay",
  ".redline-selection-outline",
  ".redline-transient-draft",
  ".redline-transient-lasso",
  ".redline-transient-selection-box",
  ".edit-handle",
  ".midpoint-grip",
  ".rotation-ring",
  ".symbol-resize-handle",
  ".symbol-label-resize-handle",
  ".branch-candidate-node",
  ".measurement-hit",
  ".fitting-hit",
  ".run-hit",
  ".symbol-hit",
  ".label-hit",
  ".redline-hit-target",
] as const;

const EDITING_STATE_CLASSES = new Set([
  "active",
  "dragging",
  "editing",
  "focused",
  "hovered",
  "is-active",
  "is-dragging",
  "is-editing",
  "is-focused",
  "is-hovered",
  "is-selected",
  "resizing",
  "rotating",
  "connection-confirmed",
  "showing-port-guides",
]);

const EDITING_STATE_PREFIXES = [
  "selected-",
  "traced-",
  "hover-",
  "active-",
  "dragging-",
  "resizing-",
  "rotating-",
] as const;

const SVG_PRESENTATION_STYLE_ALLOWLIST = [
  "alignment-baseline",
  "color",
  "dominant-baseline",
  "fill",
  "fill-opacity",
  "fill-rule",
  "font-family",
  "font-size",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "letter-spacing",
  "opacity",
  "paint-order",
  "shape-rendering",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "text-decoration",
  "text-rendering",
  "transform",
  "transform-box",
  "transform-origin",
  "vector-effect",
  "visibility",
  "word-spacing",
] as const;

type RenderRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FieldRedlineRenderLayout = {
  output: RenderRect;
  plan: RenderRect;
  footer: RenderRect;
  narrowFooter: boolean;
};

function bounded(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function resolveFieldRedlineRenderLayout(
  request: Pick<
    FieldRedlineCommittedSceneRenderRequest,
    "crop" | "pixelSize"
  >,
): FieldRedlineRenderLayout {
  const width = Math.max(1, Math.round(request.pixelSize.width));
  const height = Math.max(1, Math.round(request.pixelSize.height));
  const cropWidth = Math.max(1, request.crop.width);
  const cropHeight = Math.max(1, request.crop.height);
  const narrowFooter = width < 840 || width / height < 0.72;
  const desiredFooterHeight = narrowFooter
    ? bounded(Math.round(height * 0.19), 138, 260)
    : bounded(Math.round(height * 0.105), 96, 170);
  const maximumFooterHeight = Math.max(0, Math.floor(height * 0.42));
  const footerHeight = height > 1
    ? Math.min(desiredFooterHeight, maximumFooterHeight, height - 1)
    : 0;
  const planAreaHeight = Math.max(1, height - footerHeight);
  const scale = Math.min(width / cropWidth, planAreaHeight / cropHeight);
  const planWidth = Math.max(1, cropWidth * scale);
  const planHeight = Math.max(1, cropHeight * scale);

  return {
    output: { x: 0, y: 0, width, height },
    plan: {
      x: (width - planWidth) / 2,
      y: (planAreaHeight - planHeight) / 2,
      width: planWidth,
      height: planHeight,
    },
    footer: {
      x: 0,
      y: height - footerHeight,
      width,
      height: footerHeight,
    },
    narrowFooter,
  };
}

function parseRoleAttribute(value: string | null) {
  return (value || "")
    .split(/\s+/)
    .map((role) => role.trim())
    .filter(Boolean);
}

function removeNodesOutsideContentContract(
  clone: SVGSVGElement,
  request: FieldRedlineCommittedSceneRenderRequest,
) {
  const included = new Set<FieldRedlineExportContentRole>(
    request.includedContent,
  );
  const roleAttributes = [
    FIELD_REDLINE_EXPORT_ROLE_ATTRIBUTE,
    LEGACY_EXPORT_ROLE_ATTRIBUTE,
  ];

  roleAttributes.forEach((attribute) => {
    clone.querySelectorAll<SVGElement>(`[${attribute}]`).forEach((node) => {
      const roles = parseRoleAttribute(node.getAttribute(attribute));
      if (
        roles.length &&
        !roles.some((role) =>
          included.has(role as FieldRedlineExportContentRole)
        )
      ) {
        node.remove();
      }
    });
  });

  if (!included.has("field-redlines")) {
    clone.querySelectorAll(
      ".field-redline-layer-host, .redline-canvas-layer, " +
      ".redline-canvas-committed",
    ).forEach((node) => node.remove());
  } else {
    clone.querySelectorAll<SVGGElement>(".redline-canvas-layer")
      .forEach((layer) => {
        const committedChildren = Array.from(layer.children).filter(
          (child) => child.classList.contains("redline-canvas-committed"),
        );
        if (!committedChildren.length) return;
        Array.from(layer.children).forEach((child) => {
          if (!committedChildren.includes(child)) child.remove();
        });
      });
  }

  if (!included.has("verified-measurements")) {
    clone.querySelectorAll(".measurement").forEach((node) => node.remove());
  }
}

function removeTransientContent(
  clone: SVGSVGElement,
  request: FieldRedlineCommittedSceneRenderRequest,
) {
  const excluded = new Set<FieldRedlineExportTransientRole>(
    request.excludedTransientContent,
  );
  const transientAttributes = [
    FIELD_REDLINE_TRANSIENT_ROLE_ATTRIBUTE,
    LEGACY_TRANSIENT_ROLE_ATTRIBUTE,
  ];
  transientAttributes.forEach((attribute) => {
    clone.querySelectorAll<SVGElement>(`[${attribute}]`).forEach((node) => {
      const roles = parseRoleAttribute(node.getAttribute(attribute));
      if (
        !roles.length ||
        roles.some((role) =>
          excluded.has(role as FieldRedlineExportTransientRole)
        )
      ) {
        node.remove();
      }
    });
  });
  TRANSIENT_SELECTORS.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  });
}

function isEditingStateClass(token: string) {
  return (
    EDITING_STATE_CLASSES.has(token) ||
    EDITING_STATE_PREFIXES.some((prefix) => token.startsWith(prefix))
  );
}

function stripInteractionState(clone: SVGSVGElement) {
  const nodes: SVGElement[] = [
    clone,
    ...clone.querySelectorAll<SVGElement>("*"),
  ];
  nodes.forEach((node) => {
    const retained = [...node.classList].filter(
      (token) => !isEditingStateClass(token),
    );
    if (retained.length) node.setAttribute("class", retained.join(" "));
    else node.removeAttribute("class");

    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (
        name === "tabindex" ||
        name === "role" ||
        name === "focusable" ||
        name.startsWith("aria-") ||
        name.startsWith("on") ||
        name.startsWith("data-selection") ||
        name.startsWith("data-edit") ||
        name.startsWith("data-hover") ||
        name.startsWith("data-drag") ||
        name === FIELD_REDLINE_EXPORT_ROLE_ATTRIBUTE ||
        name === FIELD_REDLINE_TRANSIENT_ROLE_ATTRIBUTE ||
        name === LEGACY_EXPORT_ROLE_ATTRIBUTE ||
        name === LEGACY_TRANSIENT_ROLE_ATTRIBUTE
      ) {
        node.removeAttribute(attribute.name);
      }
    });
    node.style.removeProperty("caret-color");
    node.style.removeProperty("cursor");
    node.style.removeProperty("outline");
    node.style.removeProperty("pointer-events");
    node.style.removeProperty("touch-action");
    node.style.removeProperty("user-select");
  });
}

function removeUnsafeSerializedContent(clone: SVGSVGElement) {
  clone.querySelectorAll(
    "script, foreignObject, iframe, object, embed",
  ).forEach((node) => node.remove());
  clone.querySelectorAll<SVGElement>("[href], [xlink\\:href]")
    .forEach((node) => {
      ["href", "xlink:href"].forEach((attribute) => {
        const value = node.getAttribute(attribute);
        if (value && !value.trim().startsWith("#")) {
          node.removeAttribute(attribute);
        }
      });
    });
}

function safePresentationStyleValue(value: string) {
  const normalized = value.trim();
  if (!normalized || /url\s*\(/i.test(normalized)) return "";
  return normalized;
}

function inlineAllowlistedPresentationStyles(clone: SVGSVGElement) {
  const documentRef = clone.ownerDocument;
  const view = documentRef.defaultView;
  const body = documentRef.body;
  if (!view || !body || typeof view.getComputedStyle !== "function") return;

  const host = documentRef.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "-100000px";
  host.style.pointerEvents = "none";
  host.style.zIndex = "-2147483648";
  host.append(clone);
  body.append(host);

  try {
    const nodes: SVGElement[] = [
      clone,
      ...clone.querySelectorAll<SVGElement>("*"),
    ];
    nodes.forEach((node) => {
      const computed = view.getComputedStyle(node);
      SVG_PRESENTATION_STYLE_ALLOWLIST.forEach((property) => {
        const value = safePresentationStyleValue(
          computed.getPropertyValue(property),
        );
        if (value) node.style.setProperty(property, value);
      });
    });
  } finally {
    host.remove();
  }
}

function cleanCommittedOverlay(
  source: SVGSVGElement,
  request: FieldRedlineCommittedSceneRenderRequest,
  targetSize: Pick<RenderRect, "width" | "height">,
) {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute(
    "viewBox",
    `${request.crop.x} ${request.crop.y} ${request.crop.width} ${request.crop.height}`,
  );
  clone.setAttribute("width", String(Math.max(1, targetSize.width)));
  clone.setAttribute("height", String(Math.max(1, targetSize.height)));
  clone.setAttribute("preserveAspectRatio", "none");
  clone.style.background = "transparent";
  removeUnsafeSerializedContent(clone);
  removeNodesOutsideContentContract(clone, request);
  removeTransientContent(clone, request);
  stripInteractionState(clone);
  inlineAllowlistedPresentationStyles(clone);
  stripInteractionState(clone);
  return clone;
}

async function loadSvgImage(svg: SVGSVGElement) {
  const serialized = new XMLSerializer().serializeToString(svg);
  const objectUrl = URL.createObjectURL(
    new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }),
  );
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => {
        reject(new Error("The committed plan overlay could not be rendered."));
      };
      image.src = objectUrl;
    });
    if (typeof image.decode === "function") {
      await image.decode().catch(() => undefined);
    }
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function textWidth(
  context: CanvasRenderingContext2D,
  text: string,
  font: string,
) {
  context.font = font;
  return context.measureText(text).width;
}

function fittedFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  maximumWidth: number,
  preferred: number,
  weight: number,
) {
  let size = Math.max(4, preferred);
  while (
    size > 4 &&
    textWidth(
      context,
      text,
      `${weight} ${size}px Arial, sans-serif`,
    ) > maximumWidth
  ) {
    size -= 1;
  }
  return size;
}

function ellipsizedText(
  context: CanvasRenderingContext2D,
  text: string,
  maximumWidth: number,
) {
  if (context.measureText(text).width <= maximumWidth) return text;
  const characters = Array.from(text);
  while (
    characters.length &&
    context.measureText(`${characters.join("")}...`).width > maximumWidth
  ) {
    characters.pop();
  }
  return `${characters.join("")}...`;
}

function footerFieldText(
  request: FieldRedlineCommittedSceneRenderRequest,
  keys: readonly string[],
) {
  return request.footer.fields
    .filter((field) => keys.includes(field.key))
    .map((field) => `${field.label}: ${field.value}`)
    .join(" | ");
}

function drawFooter(
  context: CanvasRenderingContext2D,
  request: FieldRedlineCommittedSceneRenderRequest,
  layout: FieldRedlineRenderLayout,
) {
  const { footer, narrowFooter } = layout;
  if (footer.height <= 0) return;
  const current = request.footer.artifactState === "current";
  const side = Math.max(5, Math.round(Math.min(24, footer.width * 0.018)));
  const usableWidth = Math.max(1, footer.width - side * 2);
  const scale = bounded(
    Math.min(footer.width / 1800, footer.height / (narrowFooter ? 210 : 125)),
    0.45,
    1.6,
  );
  const warningSize = fittedFontSize(
    context,
    request.footer.approvalNotice,
    usableWidth,
    Math.round(15 * scale),
    900,
  );
  const titleSize = Math.max(6, Math.round(16 * scale));
  const detailSize = Math.max(5, Math.round(11 * scale));
  const noticeSize = Math.max(5, Math.round(10 * scale));

  context.save();
  context.beginPath();
  context.rect(footer.x, footer.y, footer.width, footer.height);
  context.clip();
  context.fillStyle = "#ffffff";
  context.fillRect(footer.x, footer.y, footer.width, footer.height);
  context.fillStyle = current ? "#14532d" : "#991b1b";
  context.fillRect(footer.x, footer.y, Math.max(4, side / 2), footer.height);
  context.textBaseline = "top";

  let y = footer.y + Math.max(4, Math.round(8 * scale));
  context.fillStyle = "#991b1b";
  context.font = `900 ${warningSize}px Arial, sans-serif`;
  context.fillText(request.footer.approvalNotice, footer.x + side, y);
  y += warningSize + Math.max(3, Math.round(5 * scale));

  context.fillStyle = "#0f172a";
  context.font = `700 ${titleSize}px Arial, sans-serif`;
  context.fillText(
    ellipsizedText(context, request.footer.title, usableWidth),
    footer.x + side,
    y,
  );
  y += titleSize + Math.max(3, Math.round(5 * scale));

  context.fillStyle = current ? "#14532d" : "#991b1b";
  context.font = `800 ${detailSize}px Arial, sans-serif`;
  context.fillText(
    ellipsizedText(context, request.footer.statusStamp, usableWidth),
    footer.x + side,
    y,
  );
  y += detailSize + Math.max(3, Math.round(5 * scale));

  const detailLines = narrowFooter
    ? [
      footerFieldText(request, ["project", "sheet", "system", "revision"]),
      footerFieldText(request, ["hvac-release", "redline-review"]),
      footerFieldText(request, ["exported", "artifact"]),
    ]
    : [
      footerFieldText(
        request,
        [
          "project",
          "sheet",
          "system",
          "revision",
          "hvac-release",
          "redline-review",
        ],
      ),
      footerFieldText(request, ["exported", "artifact"]),
    ];

  context.fillStyle = "#334155";
  context.font = `600 ${detailSize}px Arial, sans-serif`;
  detailLines.forEach((line) => {
    if (!line || y + detailSize > footer.y + footer.height) return;
    context.fillText(
      ellipsizedText(context, line, usableWidth),
      footer.x + side,
      y,
    );
    y += detailSize + Math.max(2, Math.round(3 * scale));
  });

  if (y + noticeSize <= footer.y + footer.height) {
    context.fillStyle = "#475569";
    context.font = `500 ${noticeSize}px Arial, sans-serif`;
    context.fillText(
      ellipsizedText(context, request.footer.notice, usableWidth),
      footer.x + side,
      y,
    );
  }
  context.restore();
}

function drawDraftWatermark(
  context: CanvasRenderingContext2D,
  request: FieldRedlineCommittedSceneRenderRequest,
  plan: RenderRect,
) {
  if (request.footer.artifactState !== "draft") return;
  context.save();
  context.beginPath();
  context.rect(plan.x, plan.y, plan.width, plan.height);
  context.clip();
  context.translate(
    plan.x + plan.width / 2,
    plan.y + plan.height / 2,
  );
  context.rotate(-Math.PI / 5);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(153, 27, 27, 0.09)";
  context.font =
    `900 ${Math.max(36, Math.round(plan.width / 9))}px Arial, sans-serif`;
  context.fillText("DRAFT - REVIEW REQUIRED", 0, 0);
  context.restore();
}

export async function renderCommittedFieldRedlineScene(input: {
  request: FieldRedlineCommittedSceneRenderRequest;
  sourceCanvas: HTMLCanvasElement;
  sourceCanvasCoversCrop?: boolean;
  overlaySvg: SVGSVGElement;
}): Promise<FieldRedlineCanvasSource> {
  const {
    request,
    sourceCanvas,
    sourceCanvasCoversCrop = false,
    overlaySvg,
  } = input;
  const layout = resolveFieldRedlineRenderLayout(request);
  const output = document.createElement("canvas");
  output.width = layout.output.width;
  output.height = layout.output.height;
  const context = output.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot create the export canvas.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (request.includedContent.includes("source-plan")) {
    if (sourceCanvasCoversCrop) {
      context.drawImage(
        sourceCanvas,
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height,
        layout.plan.x,
        layout.plan.y,
        layout.plan.width,
        layout.plan.height,
      );
    } else {
      const scaleX = sourceCanvas.width / Math.max(1, request.sheet.width);
      const scaleY = sourceCanvas.height / Math.max(1, request.sheet.height);
      context.drawImage(
        sourceCanvas,
        request.crop.x * scaleX,
        request.crop.y * scaleY,
        request.crop.width * scaleX,
        request.crop.height * scaleY,
        layout.plan.x,
        layout.plan.y,
        layout.plan.width,
        layout.plan.height,
      );
    }
  }

  if (request.includedContent.some((role) => role !== "source-plan")) {
    const overlay = cleanCommittedOverlay(overlaySvg, request, layout.plan);
    const image = await loadSvgImage(overlay);
    context.drawImage(
      image,
      layout.plan.x,
      layout.plan.y,
      layout.plan.width,
      layout.plan.height,
    );
  }
  drawDraftWatermark(context, request, layout.plan);
  drawFooter(context, request, layout);
  return output;
}
