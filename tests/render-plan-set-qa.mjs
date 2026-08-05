import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { jsPDF } from "jspdf";
import { loadTypescriptModule } from "./load-typescript-module.mjs";

const planSet = await loadTypescriptModule(
  new URL("../app/planSetExport.ts", import.meta.url),
);

const outputPath = resolve(process.argv[2] || "plan-set-qa.pdf");
const width = 792;
const height = 612;
const document = new jsPDF({ orientation: "landscape", unit: "pt", format: [width, height] });

function drawPlanSheet(title) {
  document.setDrawColor(65, 77, 72);
  document.setLineWidth(1.4);
  document.rect(34, 34, width - 68, height - 68);
  document.line(60, 280, width - 60, 280);
  document.setTextColor(26, 36, 32);
  document.setFont("helvetica", "bold");
  document.setFontSize(22);
  document.text(title, 52, 72);
  document.setFontSize(13);
  document.text("SUPPLY RUN  S-1  12\"", 90, 228);
  document.setDrawColor(23, 132, 199);
  document.setLineWidth(5);
  document.line(90, 245, 660, 245);
  document.line(380, 245, 470, 150);
}

drawPlanSheet("COVER PLAN SHEET");
planSet.drawPlanTitleBlock(document, width, height, {
  projectName: "HVAC Plan Studio QA",
  systemName: "System 1",
  revision: "IFC-2",
  scale: '1/4\" = 1\'-0\"',
});

document.addPage([width, height], "landscape");
drawPlanSheet("SECOND PLAN SHEET - CLEAN");

await writeFile(outputPath, Buffer.from(document.output("arraybuffer")));
console.log(outputPath);
