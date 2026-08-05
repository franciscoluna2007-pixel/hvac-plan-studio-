import type { PDFDocumentProxy } from "pdfjs-dist";
import type { jsPDF as JsPdf } from "jspdf";

type Point = { x: number; y: number };

export type PlanSetDrawing = {
  id: string;
  page: number;
  type: string;
  points: Point[];
  size?: string;
  runNumber?: string;
  systemId?: string;
  fitting?: {
    angle: number;
    branchAngle?: number;
    side: 1 | -1;
    style: "tee90" | "wye45";
    connectedIds?: Array<string | null>;
  };
  symbol?: { kind: string; label?: string; size?: string };
};

export type PlanSetIdentity = {
  projectName: string;
  systemName: string;
  revision: string;
  scale: string;
};

const planColors: Record<string, string> = {
  supply: "#1784c7",
  return: "#a86118",
  fresh: "#16837a",
};

export function safePlanSetFilename(projectName: string, revision: string) {
  const safe = `${projectName}-${revision || "review"}`
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "hvac-plan-set";
  return `${safe}.pdf`;
}

export function pageHasPlanTitleBlock(pageNumber: number) {
  return pageNumber === 1;
}

function drawPlanOverlay(
  context: CanvasRenderingContext2D,
  drawings: PlanSetDrawing[],
  scaleX: number,
  scaleY: number,
) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const drawing of drawings) {
    const color = planColors[drawing.type] || "#1784c7";
    const point = drawing.points[0];
    if (drawing.fitting && point) {
      const axis = drawing.fitting.angle;
      const branchAxis = drawing.fitting.branchAngle ??
        axis + drawing.fitting.side * (drawing.fitting.style === "tee90" ? Math.PI / 2 : Math.PI / 4);
      const length = 18;
      const center = { x: point.x * scaleX, y: point.y * scaleY };
      context.strokeStyle = drawing.fitting.connectedIds?.length === 3 ? color : "#c5333d";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(center.x - Math.cos(axis) * length * scaleX, center.y - Math.sin(axis) * length * scaleY);
      context.lineTo(center.x + Math.cos(axis) * length * scaleX, center.y + Math.sin(axis) * length * scaleY);
      context.moveTo(center.x, center.y);
      context.lineTo(center.x + Math.cos(branchAxis) * length * scaleX, center.y + Math.sin(branchAxis) * length * scaleY);
      context.stroke();
      continue;
    }
    if (drawing.symbol && point) {
      context.strokeStyle = color;
      context.fillStyle = "rgba(255,255,255,.88)";
      context.lineWidth = 2;
      context.beginPath();
      context.rect(point.x * scaleX - 8, point.y * scaleY - 8, 16, 16);
      context.fill();
      context.stroke();
      if (drawing.symbol.label || drawing.symbol.size) {
        context.fillStyle = "#17211d";
        context.font = "bold 10px sans-serif";
        context.fillText(drawing.symbol.label || drawing.symbol.size || "", point.x * scaleX + 11, point.y * scaleY + 4);
      }
      continue;
    }
    if (drawing.points.length < 2) continue;
    context.strokeStyle = color;
    context.lineWidth = Math.max(2, Math.min(7, Number.parseFloat(drawing.size || "8") / 3));
    context.beginPath();
    drawing.points.forEach((candidate, index) => {
      const x = candidate.x * scaleX;
      const y = candidate.y * scaleY;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    const middle = drawing.points[Math.floor(drawing.points.length / 2)];
    const label = [drawing.runNumber, drawing.size ? `${drawing.size}\"` : ""].filter(Boolean).join("  ");
    if (middle && label) {
      context.font = "bold 10px sans-serif";
      const width = context.measureText(label).width;
      context.fillStyle = "rgba(255,255,255,.9)";
      context.fillRect(middle.x * scaleX + 5, middle.y * scaleY - 15, width + 6, 14);
      context.fillStyle = "#17211d";
      context.fillText(label, middle.x * scaleX + 8, middle.y * scaleY - 4);
    }
  }
  context.restore();
}

export function drawPlanTitleBlock(
  document: Pick<
    JsPdf,
    "setFillColor" | "setDrawColor" | "setLineWidth" | "setTextColor" |
    "setFont" | "setFontSize" | "rect" | "text"
  >,
  width: number,
  height: number,
  identity: PlanSetIdentity,
) {
  const blockHeight = Math.max(54, Math.round(height * 0.075));
  const top = height - blockHeight;
  document.setFillColor(250, 249, 244);
  document.rect(0, top, width, blockHeight, "F");
  document.setDrawColor(38, 51, 46);
  document.setLineWidth(2);
  document.rect(1, top + 1, width - 2, blockHeight - 2, "S");
  document.setTextColor(23, 33, 29);
  document.setFont("helvetica", "bold");
  document.setFontSize(Math.max(14, Math.round(blockHeight * .28)));
  document.text(identity.projectName || "HVAC Plan Studio", 16, top + blockHeight * .42);
  document.setFont("helvetica", "normal");
  document.setFontSize(Math.max(10, Math.round(blockHeight * .18)));
  document.text(`${identity.systemName}   REV ${identity.revision || "REVIEW"}`, 16, top + blockHeight * .72);
  document.setFont("helvetica", "bold");
  document.setFontSize(Math.max(10, Math.round(blockHeight * .19)));
  document.text(`SCALE ${identity.scale || "NOT SET"}`, width - 16, top + blockHeight * .58, { align: "right" });
}

export async function generatePlanSetPdf(input: {
  pdf: PDFDocumentProxy;
  drawings: PlanSetDrawing[];
  identity: PlanSetIdentity;
}) {
  const { jsPDF } = await import("jspdf");
  let document: InstanceType<typeof jsPDF> | null = null;
  for (let pageNumber = 1; pageNumber <= input.pdf.numPages; pageNumber += 1) {
    const page = await input.pdf.getPage(pageNumber);
    const sourceViewport = page.getViewport({ scale: 1.35 });
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The plan-set canvas could not be created");
    await page.render({ canvasContext: context, viewport }).promise;
    drawPlanOverlay(
      context,
      input.drawings.filter((drawing) => drawing.page === pageNumber),
      canvas.width / Math.max(1, sourceViewport.width),
      canvas.height / Math.max(1, sourceViewport.height),
    );
    const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
    if (!document) {
      document = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height], hotfixes: ["px_scaling"] });
    } else {
      document.addPage([canvas.width, canvas.height], orientation);
    }
    document.addImage(canvas.toDataURL("image/jpeg", .9), "JPEG", 0, 0, canvas.width, canvas.height, undefined, "FAST");
    if (pageHasPlanTitleBlock(pageNumber)) {
      drawPlanTitleBlock(document, canvas.width, canvas.height, input.identity);
    }
  }
  if (!document) throw new Error("The source PDF has no plan sheets");
  const filename = safePlanSetFilename(input.identity.projectName, input.identity.revision);
  return { blob: document.output("blob"), filename };
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

export function buildPlanEmailMessage(input: {
  to: string;
  subject: string;
  message: string;
  filename: string;
  pdfBase64: string;
}) {
  const boundary = `hvac-plan-${Date.now().toString(36)}`;
  return [
    `To: ${input.to.trim()}`,
    `Subject: ${input.subject.replace(/[\r\n]+/g, " ").trim()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary=\"${boundary}\"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.message,
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name=\"${input.filename}\"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename=\"${input.filename}\"`,
    "",
    wrapBase64(input.pdfBase64),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
