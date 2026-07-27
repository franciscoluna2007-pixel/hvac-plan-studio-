import { Util, type PDFDocumentProxy } from "pdfjs-dist";

export type PlanEvidenceCategory =
  | "Scale"
  | "Rooms"
  | "Equipment"
  | "Ductwork"
  | "Air devices"
  | "Airflow"
  | "Fresh air"
  | "Controls"
  | "Schedules"
  | "Notes";

export type PlanFindingSeverity = "critical" | "warning" | "info";
export type PlanFindingDecision = "open" | "accepted" | "rejected" | "ignored" | "rfi";

export type PlanPageReading = {
  page: number;
  sheetNumber: string;
  title: string;
  classification: "Mechanical plan" | "Mechanical schedule" | "RCP / coordination" | "Related sheet" | "Unclassified";
  hvacScore: number;
  confidence: number;
  textLength: number;
  readable: boolean;
};

export type PlanEvidence = {
  id: string;
  category: PlanEvidenceCategory;
  label: string;
  value: string;
  page: number;
  sheetNumber: string;
  excerpt: string;
  confidence: number;
  source: "PDF text layer";
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageWidth: number;
    pageHeight: number;
    coordinateSpace: "viewport-points" | "pdf-points";
  };
};

export type PlanReaderFinding = {
  id: string;
  severity: PlanFindingSeverity;
  category: "Source quality" | "Schedules" | "Equipment" | "Air distribution" | "Fresh air" | "Takeoff";
  title: string;
  detail: string;
  recommendation: string;
  page?: number;
  sheetNumber?: string;
  evidenceIds: string[];
  confidence: number;
  decision: PlanFindingDecision;
  decisionNote: string;
};

export type PlanTakeoffRow = {
  id: string;
  category: PlanEvidenceCategory;
  item: string;
  quantity: number;
  pages: number[];
  confidence: number;
  reviewRequired: boolean;
};

export type PlanAnalysis = {
  id: string;
  sourceFingerprint: string;
  sourceFileName: string;
  createdAt: string;
  pageCount: number;
  pages: PlanPageReading[];
  evidence: PlanEvidence[];
  findings: PlanReaderFinding[];
  takeoff: PlanTakeoffRow[];
  summary: {
    mechanicalSheets: number;
    readableSheets: number;
    equipment: number;
    ductSizes: number;
    airDevices: number;
    openFindings: number;
    averageConfidence: number;
  };
  persistence?: {
    truncated: boolean;
    originalEvidenceCount: number;
    savedEvidenceCount: number;
    originalFindingCount: number;
    savedFindingCount: number;
    originalTakeoffCount: number;
    savedTakeoffCount: number;
  };
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

type PageTextSpan = {
  start: number;
  end: number;
  region?: NonNullable<PlanEvidence["region"]>;
};

type EvidencePattern = {
  category: PlanEvidenceCategory;
  label: string;
  expression: RegExp;
  baseConfidence: number;
  maxPerPage?: number;
  contextRequired?: RegExp;
  alwaysScan?: boolean;
};

const evidencePatterns: EvidencePattern[] = [
  {
    category: "Scale",
    label: "Architectural scale",
    expression: /\b(?:SCALE\s*[:=]?\s*)?(?:1\s*\/\s*(?:8|4|2)|3\s*\/\s*16)\s*(?:"|IN(?:CH(?:ES)?)?\.?)\s*=\s*1\s*(?:'|FT\.?|FOOT|FEET)\s*(?:-?\s*0?\s*(?:"|IN\.?))?/gi,
    baseConfidence: 0.96,
    maxPerPage: 12,
    alwaysScan: true,
  },
  {
    category: "Scale",
    label: "Metric scale",
    expression: /\bSCALE\s*[:=]?\s*1\s*:\s*(?:20|25|50|100|200)\b/gi,
    baseConfidence: 0.95,
    maxPerPage: 12,
    alwaysScan: true,
  },
  {
    category: "Scale",
    label: "Not to scale",
    expression: /\b(?:NOT\s+TO\s+SCALE|N\.?\s*T\.?\s*S\.?)\b/gi,
    baseConfidence: 0.99,
    maxPerPage: 12,
    alwaysScan: true,
  },
  {
    category: "Rooms",
    label: "Room name",
    expression: /\b(?:PRIMARY\s+(?:BEDROOM|SUITE|BATH(?:ROOM)?)|MASTER\s+(?:BEDROOM|SUITE|BATH(?:ROOM)?)|BEDROOM\s*(?:#?\s*\d+|[A-Z])?|LIVING\s+ROOM|GREAT\s+ROOM|DINING\s+ROOM|FAMILY\s+ROOM|KITCHEN|BREAKFAST\s+(?:ROOM|NOOK)|OFFICE|STUDY|DEN|BONUS\s+ROOM|GAME\s+ROOM|MEDIA\s+ROOM|LAUNDRY|UTILITY|PANTRY|CLOSET|GARAGE|MECHANICAL\s+ROOM|BATH(?:ROOM)?\s*(?:#?\s*\d+|[A-Z])?|HALL(?:WAY)?|FOYER|ENTRY)\b/gi,
    baseConfidence: 0.87,
    maxPerPage: 120,
    alwaysScan: true,
  },
  {
    category: "Rooms",
    label: "Ceiling height",
    expression: /\b(?:(?:CEILING|CLG|C\.?\s*H\.?)\s*(?:HEIGHT|HT\.?)?\s*[:=]?\s*\d{1,2}\s*'\s*(?:-\s*\d{1,2}\s*(?:"|IN\.?))?|\d{1,2}\s*'\s*(?:-\s*\d{1,2}\s*(?:"|IN\.?))?\s*(?:A\.?\s*F\.?\s*F\.?|CEILING|CLG|C\.?\s*H\.?))\b/gi,
    baseConfidence: 0.92,
    maxPerPage: 120,
    alwaysScan: true,
  },
  {
    category: "Rooms",
    label: "Metric ceiling height",
    expression: /\b(?:(?:CEILING|CLG|C\.?\s*H\.?)\s*(?:HEIGHT|HT\.?)?\s*[:=]?\s*(?:\d{3,4}\s*MM|\d(?:\.\d{1,2})?\s*M)|(?:\d{3,4}\s*MM|\d(?:\.\d{1,2})?\s*M)\s*(?:A\.?\s*F\.?\s*F\.?\s*)?(?:CEILING|CLG|C\.?\s*H\.?))\b/gi,
    baseConfidence: 0.92,
    maxPerPage: 120,
    alwaysScan: true,
  },
  {
    category: "Rooms",
    label: "Vaulted ceiling range",
    expression: /\b(?:VAULT(?:ED)?|SLOPED?)\s+(?:CEILING|CLG)\s*[:=]?\s*\d{1,2}\s*'\s*(?:-\s*\d{1,2}\s*(?:"|IN\.?))?\s*(?:TO|THRU|-)\s*\d{1,2}\s*'\s*(?:-\s*\d{1,2}\s*(?:"|IN\.?))?/gi,
    baseConfidence: 0.93,
    maxPerPage: 60,
    alwaysScan: true,
  },
  {
    category: "Equipment",
    label: "Equipment tag",
    expression: /\b(?:AHU|FCU|RTU|ERV|HRV|MAU|DOAS|CU|HP|EF|SF|FURNACE|AIR\s+HANDLER)[-\s]?[A-Z]?\d{0,3}\b/gi,
    baseConfidence: 0.91,
    maxPerPage: 30,
  },
  {
    category: "Equipment",
    label: "Unit tonnage",
    expression: /\b(?:1(?:\.5)?|2(?:\.5)?|3(?:\.5)?|4|5)\s*(?:TON|TONS)\b/gi,
    baseConfidence: 0.94,
    maxPerPage: 20,
  },
  {
    category: "Airflow",
    label: "CFM text reference",
    expression: /\b\d{2,4}\s*CFM\b/gi,
    baseConfidence: 0.95,
    maxPerPage: 80,
  },
  {
    category: "Ductwork",
    label: "Rectangular duct size",
    expression: /\b\d{1,2}\s*(?:X|×)\s*\d{1,2}\b/gi,
    baseConfidence: 0.84,
    maxPerPage: 100,
    contextRequired: /\b(?:DUCT|SUPPLY|RETURN|EXHAUST|FLEX|SA|RA|OA|SIZE|TRUNK|GRILLE|REGISTER|DIFFUSER)\b/i,
  },
  {
    category: "Ductwork",
    label: "Round duct size",
    expression: /\b(?:[4-9]|[1-5]\d|60)\s*(?:"|IN\.?)\b/gi,
    baseConfidence: 0.78,
    maxPerPage: 100,
    contextRequired: /\b(?:DUCT|SUPPLY|RETURN|EXHAUST|FLEX|SA|RA|OA|ROUND|SIZE|TRUNK)\b/i,
  },
  {
    category: "Air devices",
    label: "Supply diffuser",
    expression: /\b(?:SUPPLY\s+DIFFUSER|CEILING\s+DIFFUSER|4-WAY\s+DIFFUSER|LINEAR\s+DIFFUSER|SUPPLY\s+REGISTER)\b/gi,
    baseConfidence: 0.9,
    maxPerPage: 80,
  },
  {
    category: "Air devices",
    label: "Return grille",
    expression: /\b(?:RETURN\s+GRILLE|RETURN\s+REGISTER|FILTER\s+GRILLE|RETURN\s+AIR\s+GRILLE)\b/gi,
    baseConfidence: 0.92,
    maxPerPage: 80,
  },
  {
    category: "Air devices",
    label: "Exhaust fan",
    expression: /\b(?:EXHAUST\s+FAN|EF-\d+|BATH\s+FAN)\b/gi,
    baseConfidence: 0.9,
    maxPerPage: 40,
  },
  {
    category: "Fresh air",
    label: "Outside / fresh air",
    expression: /\b(?:FRESH\s+AIR|OUTSIDE\s+AIR|OUTDOOR\s+AIR|OA\s+INTAKE)\b/gi,
    baseConfidence: 0.9,
    maxPerPage: 30,
  },
  {
    category: "Fresh air",
    label: "Motorized outside-air damper",
    expression: /\b(?:MOTORIZED\s+(?:OUTSIDE|OUTDOOR|FRESH)\s+AIR\s+DAMPER|MOTORIZED\s+OA\s+DAMPER|MOD-\d+)\b/gi,
    baseConfidence: 0.96,
    maxPerPage: 20,
  },
  {
    category: "Controls",
    label: "Thermostat",
    expression: /\b(?:THERMOSTAT|T-STAT|TSTAT)\b/gi,
    baseConfidence: 0.9,
    maxPerPage: 40,
  },
  {
    category: "Controls",
    label: "Duct smoke detector",
    expression: /\b(?:DUCT\s+SMOKE\s+DETECTOR|SMOKE\s+DETECTOR|DSD-\d+)\b/gi,
    baseConfidence: 0.92,
    maxPerPage: 20,
  },
  {
    category: "Controls",
    label: "Damper",
    expression: /\b(?:VOLUME\s+DAMPER|BALANCING\s+DAMPER|FIRE\s+DAMPER|BACKDRAFT\s+DAMPER|VD-\d+|FD-\d+)\b/gi,
    baseConfidence: 0.88,
    maxPerPage: 60,
  },
  {
    category: "Schedules",
    label: "Equipment schedule",
    expression: /\b(?:MECHANICAL\s+EQUIPMENT\s+SCHEDULE|EQUIPMENT\s+SCHEDULE|AIR\s+HANDLER\s+SCHEDULE|FAN\s+SCHEDULE)\b/gi,
    baseConfidence: 0.96,
    maxPerPage: 8,
  },
  {
    category: "Schedules",
    label: "Air device schedule",
    expression: /\b(?:AIR\s+DEVICE\s+SCHEDULE|DIFFUSER\s+SCHEDULE|GRILLE\s+SCHEDULE|REGISTER\s+SCHEDULE)\b/gi,
    baseConfidence: 0.96,
    maxPerPage: 8,
  },
  {
    category: "Notes",
    label: "Mechanical note",
    expression: /\b(?:MECHANICAL\s+NOTES|GENERAL\s+MECHANICAL\s+NOTES|HVAC\s+NOTES)\b/gi,
    baseConfidence: 0.9,
    maxPerPage: 8,
  },
];

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function excerptAround(text: string, start: number, length: number) {
  const from = Math.max(0, start - 70);
  const to = Math.min(text.length, start + length + 90);
  return text
    .slice(from, to)
    .replace(/\s+/g, " ")
    .trim();
}

function sheetNumber(text: string, page: number) {
  const match = text.match(/\bM(?:ECH)?[-.]?\d{1,2}(?:\.\d{1,2})?\b/i);
  return match?.[0].toUpperCase().replace("MECH", "M") || `PAGE ${page}`;
}

function classifyPage(text: string) {
  const upper = text.toUpperCase();
  const tokens = [
    "MECHANICAL",
    "HVAC",
    "DUCT",
    "CFM",
    "DIFFUSER",
    "RETURN AIR",
    "SUPPLY AIR",
    "AIR HANDLER",
    "EQUIPMENT SCHEDULE",
    "FRESH AIR",
    "THERMOSTAT",
  ];
  const hvacScore = tokens.reduce((score, token) => score + (upper.includes(token) ? 1 : 0), 0);
  const schedule = /\b(?:SCHEDULE|EQUIPMENT\s+DATA)\b/i.test(text);
  const rcp = /\b(?:REFLECTED\s+CEILING|RCP|CEILING\s+PLAN)\b/i.test(text);
  const mechanical = /\b(?:MECHANICAL|HVAC|DUCTWORK)\b/i.test(text);
  const classification: PlanPageReading["classification"] = schedule && hvacScore >= 2
    ? "Mechanical schedule"
    : mechanical && hvacScore >= 2
      ? "Mechanical plan"
      : rcp && hvacScore >= 1
        ? "RCP / coordination"
        : hvacScore >= 2
          ? "Related sheet"
          : "Unclassified";
  const title = classification === "Mechanical schedule"
    ? "Mechanical schedules"
    : classification === "Mechanical plan"
      ? "Mechanical / HVAC plan"
      : classification === "RCP / coordination"
        ? "Reflected ceiling coordination"
        : classification === "Related sheet"
          ? "HVAC-related sheet"
          : "Unclassified sheet";
  return { hvacScore, classification, title };
}

function regionForMatch(
  spans: PageTextSpan[],
  start: number,
  end: number,
): PlanEvidence["region"] {
  const regions = spans
    .filter((span) => span.region && span.end > start && span.start < end)
    .map((span) => span.region!);
  if (!regions.length) return undefined;
  const x = Math.min(...regions.map((region) => region.x));
  const y = Math.min(...regions.map((region) => region.y));
  const right = Math.max(...regions.map((region) => region.x + region.width));
  const bottom = Math.max(...regions.map((region) => region.y + region.height));
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
    pageWidth: regions[0].pageWidth,
    pageHeight: regions[0].pageHeight,
    coordinateSpace: regions[0].coordinateSpace,
  };
}

function extractEvidence(
  text: string,
  page: PlanPageReading,
  spans: PageTextSpan[],
  patterns: EvidencePattern[] = evidencePatterns,
) {
  const rows: PlanEvidence[] = [];
  patterns.forEach((pattern) => {
    const expression = new RegExp(pattern.expression.source, pattern.expression.flags);
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = expression.exec(text)) && count < (pattern.maxPerPage || 50)) {
      const excerpt = excerptAround(text, match.index, match[0].length);
      if (pattern.contextRequired && !pattern.contextRequired.test(excerpt)) continue;
      const value = match[0].replace(/\s+/g, " ").trim().toUpperCase();
      const sheetBoost = page.classification === "Mechanical plan" || page.classification === "Mechanical schedule" ? 0.04 : 0;
      const confidence = Math.min(0.99, pattern.baseConfidence + sheetBoost);
      rows.push({
        id: `evidence-${stableHash(`${page.page}|${pattern.category}|${pattern.label}|${value}|${match.index}`)}`,
        category: pattern.category,
        label: pattern.label,
        value,
        page: page.page,
        sheetNumber: page.sheetNumber,
        excerpt,
        confidence,
        source: "PDF text layer",
        region: regionForMatch(spans, match.index, match.index + match[0].length),
      });
      count += 1;
    }
  });
  return rows;
}

function buildTakeoff(evidence: PlanEvidence[]) {
  const groups = new Map<string, PlanEvidence[]>();
  evidence
    .filter((row) => ["Equipment", "Ductwork", "Air devices", "Fresh air", "Controls"].includes(row.category))
    .forEach((row) => {
      const key = `${row.category}|${row.label}|${row.value}`;
      groups.set(key, [...(groups.get(key) || []), row]);
    });
  return [...groups.entries()]
    .map(([key, rows]) => {
      const [category, label, value] = key.split("|") as [PlanEvidenceCategory, string, string];
      const confidence = rows.reduce((total, row) => total + row.confidence, 0) / rows.length;
      return {
        id: `takeoff-${stableHash(key)}`,
        category,
        item: `Text reference · ${label} · ${value}`,
        quantity: rows.length,
        pages: [...new Set(rows.map((row) => row.page))].sort((left, right) => left - right),
        confidence,
        reviewRequired: true,
      } satisfies PlanTakeoffRow;
    })
    .sort((left, right) => left.category.localeCompare(right.category) || left.item.localeCompare(right.item));
}

function buildFindings(pages: PlanPageReading[], evidence: PlanEvidence[]) {
  const findings: PlanReaderFinding[] = [];
  const add = (finding: Omit<PlanReaderFinding, "id" | "decision" | "decisionNote">) => {
    findings.push({
      ...finding,
      id: `plan-finding-${stableHash(`${finding.category}|${finding.title}|${finding.page || "set"}`)}`,
      decision: "open",
      decisionNote: "",
    });
  };
  const hvacPages = pages.filter((page) => page.classification !== "Unclassified");
  const unreadableHvacPages = hvacPages.filter((page) => !page.readable);
  if (!hvacPages.length) {
    add({
      severity: "critical",
      category: "Source quality",
      title: "No HVAC sheets were identified",
      detail: "The plan set did not expose enough mechanical text to classify an HVAC plan, schedule, or coordination sheet.",
      recommendation: "Confirm the correct PDF was opened. If the sheets are scanned images, run OCR and analyze again.",
      evidenceIds: [],
      confidence: 0.96,
    });
  }
  unreadableHvacPages.forEach((page) => add({
    severity: "warning",
    category: "Source quality",
    title: "Sheet needs OCR review",
    detail: `${page.sheetNumber} contains too little searchable text for reliable extraction.`,
    recommendation: "Review the sheet visually or replace it with an OCR-enabled PDF before relying on the takeoff.",
    page: page.page,
    sheetNumber: page.sheetNumber,
    evidenceIds: [],
    confidence: 0.94,
  }));

  const schedules = evidence.filter((row) => row.category === "Schedules");
  if (hvacPages.length && !schedules.length) {
    add({
      severity: "warning",
      category: "Schedules",
      title: "No HVAC schedule was detected",
      detail: "The reader found HVAC-related sheets but did not detect an equipment or air-device schedule in searchable text.",
      recommendation: "Check the sheet index and add the missing schedule sheet before finalizing the takeoff.",
      evidenceIds: [],
      confidence: 0.84,
    });
  }

  const equipment = evidence.filter((row) => row.category === "Equipment" && row.label === "Equipment tag");
  const tonnage = evidence.filter((row) => row.label === "Unit tonnage");
  const airflow = evidence.filter((row) => row.category === "Airflow");
  if (equipment.length && !tonnage.length) {
    add({
      severity: "warning",
      category: "Equipment",
      title: "Equipment tonnage was not detected",
      detail: `${equipment.length} equipment tag${equipment.length === 1 ? " was" : "s were"} detected without a corresponding tonnage value.`,
      recommendation: "Open the equipment schedule and confirm each system size before using airflow or duct-sizing recommendations.",
      evidenceIds: equipment.slice(0, 8).map((row) => row.id),
      confidence: 0.86,
    });
  }
  if (equipment.length && !airflow.length) {
    add({
      severity: "warning",
      category: "Equipment",
      title: "Airflow text was not detected",
      detail: "Equipment was detected, but no CFM text reference was found in the searchable plan text.",
      recommendation: "Confirm design CFM from the equipment schedule or manufacturer data before balancing the marked plan.",
      evidenceIds: equipment.slice(0, 8).map((row) => row.id),
      confidence: 0.88,
    });
  }

  const supplies = evidence.filter((row) => row.label === "Supply diffuser");
  const returns = evidence.filter((row) => row.label === "Return grille");
  if (supplies.length && !returns.length) {
    add({
      severity: "warning",
      category: "Air distribution",
      title: "Supply devices found without detected returns",
      detail: `${supplies.length} supply-device reference${supplies.length === 1 ? " was" : "s were"} detected, but no return-grille reference was found in searchable text.`,
      recommendation: "Review the mechanical plan and schedule for return-air paths before accepting the marked system.",
      evidenceIds: supplies.slice(0, 10).map((row) => row.id),
      confidence: 0.85,
    });
  }

  const freshAir = evidence.filter((row) => row.label === "Outside / fresh air");
  const freshAirDampers = evidence.filter((row) => row.label === "Motorized outside-air damper");
  if (freshAir.length && !freshAirDampers.length) {
    add({
      severity: "info",
      category: "Fresh air",
      title: "Fresh-air control was not detected",
      detail: "Outside or fresh air is referenced, but a motorized outside-air damper was not detected in searchable text.",
      recommendation: "Review the sequence, notes, and controls details before adding the fresh-air markup or takeoff item.",
      page: freshAir[0].page,
      sheetNumber: freshAir[0].sheetNumber,
      evidenceIds: freshAir.slice(0, 8).map((row) => row.id),
      confidence: 0.82,
    });
  }

  const lowConfidence = evidence.filter((row) => row.confidence < 0.82);
  if (lowConfidence.length) {
    add({
      severity: "info",
      category: "Takeoff",
      title: "Low-confidence quantities need confirmation",
      detail: `${lowConfidence.length} extracted item${lowConfidence.length === 1 ? "" : "s"} should be visually confirmed before inclusion in the takeoff.`,
      recommendation: "Filter Evidence by Review and inspect each source sheet. Accept only the items you can confirm.",
      evidenceIds: lowConfidence.slice(0, 20).map((row) => row.id),
      confidence: 0.98,
    });
  }

  return findings;
}

export async function analyzeHvacPlan(input: {
  pdf: PDFDocumentProxy;
  sourceFingerprint: string;
  sourceFileName: string;
  onProgress?: (completedPages: number, totalPages: number) => void;
}) {
  const pages: PlanPageReading[] = [];
  const evidence: PlanEvidence[] = [];
  for (let pageNumber = 1; pageNumber <= input.pdf.numPages; pageNumber += 1) {
    const page = await input.pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const spans: PageTextSpan[] = [];
    let text = "";
    (content.items as PdfTextItem[]).forEach((item) => {
      const value = (item.str || "").replace(/\s+/g, " ").trim();
      if (!value) return;
      if (text) text += " ";
      const start = text.length;
      text += value;
      const transform = item.transform;
      const combined = transform?.length === 6
        ? Util.transform(viewport.transform, transform)
        : undefined;
      const baselineX = Number(combined?.[4]);
      const baselineY = Number(combined?.[5]);
      const width = Math.max(1, Number(item.width) || Math.hypot(Number(combined?.[0]) || 0, Number(combined?.[1]) || 0) || value.length * 4);
      const height = Math.max(1, Number(item.height) || Math.hypot(Number(combined?.[2]) || 0, Number(combined?.[3]) || 0) || 8);
      const widthScale = Math.max(.0001, Math.hypot(Number(combined?.[0]) || 0, Number(combined?.[1]) || 0));
      const heightScale = Math.max(.0001, Math.hypot(Number(combined?.[2]) || 0, Number(combined?.[3]) || 0));
      const widthVector = {
        x: (Number(combined?.[0]) || 0) / widthScale * width,
        y: (Number(combined?.[1]) || 0) / widthScale * width,
      };
      const heightVector = {
        x: (Number(combined?.[2]) || 0) / heightScale * height,
        y: (Number(combined?.[3]) || 0) / heightScale * height,
      };
      const corners = [
        { x: baselineX, y: baselineY },
        { x: baselineX + widthVector.x, y: baselineY + widthVector.y },
        { x: baselineX + heightVector.x, y: baselineY + heightVector.y },
        {
          x: baselineX + widthVector.x + heightVector.x,
          y: baselineY + widthVector.y + heightVector.y,
        },
      ];
      const hasPosition = corners.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      const left = Math.min(...corners.map((point) => point.x));
      const top = Math.min(...corners.map((point) => point.y));
      const right = Math.max(...corners.map((point) => point.x));
      const bottom = Math.max(...corners.map((point) => point.y));
      spans.push({
        start,
        end: text.length,
        region: hasPosition ? {
          x: Math.max(0, left),
          y: Math.max(0, top),
          width: Math.max(1, right - left),
          height: Math.max(1, bottom - top),
          pageWidth: viewport.width,
          pageHeight: viewport.height,
          coordinateSpace: "viewport-points",
        } : undefined,
      });
    });
    const classification = classifyPage(text);
    const reading: PlanPageReading = {
      page: pageNumber,
      sheetNumber: sheetNumber(text, pageNumber),
      title: classification.title,
      classification: classification.classification,
      hvacScore: classification.hvacScore,
      confidence: Math.min(0.98, 0.52 + classification.hvacScore * 0.055 + (text.length > 250 ? 0.08 : 0)),
      textLength: text.length,
      readable: text.length >= 40,
    };
    pages.push(reading);
    const patterns = classification.classification === "Unclassified"
      ? evidencePatterns.filter((pattern) => pattern.alwaysScan)
      : evidencePatterns;
    if (reading.readable) evidence.push(...extractEvidence(text, reading, spans, patterns));
    input.onProgress?.(pageNumber, input.pdf.numPages);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  const findings = buildFindings(pages, evidence);
  const takeoff = buildTakeoff(evidence);
  const confidenceValues = [...pages.filter((page) => page.classification !== "Unclassified").map((page) => page.confidence), ...evidence.map((row) => row.confidence)];
  const averageConfidence = confidenceValues.length
    ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
    : 0;
  return {
    id: `analysis-${stableHash(`${input.sourceFingerprint}|${Date.now()}`)}`,
    sourceFingerprint: input.sourceFingerprint,
    sourceFileName: input.sourceFileName,
    createdAt: new Date().toISOString(),
    pageCount: input.pdf.numPages,
    pages,
    evidence,
    findings,
    takeoff,
    summary: {
      mechanicalSheets: pages.filter((page) => page.classification !== "Unclassified").length,
      readableSheets: pages.filter((page) => page.classification !== "Unclassified" && page.readable).length,
      equipment: evidence.filter((row) => row.category === "Equipment" && row.label === "Equipment tag").length,
      ductSizes: evidence.filter((row) => row.category === "Ductwork").length,
      airDevices: evidence.filter((row) => row.category === "Air devices").length,
      openFindings: findings.filter((finding) => finding.decision === "open").length,
      averageConfidence,
    },
  } satisfies PlanAnalysis;
}

export function updatePlanFindingDecision(
  analysis: PlanAnalysis,
  findingId: string,
  decision: PlanFindingDecision,
  note = "",
) {
  const findings = analysis.findings.map((finding) =>
    finding.id === findingId ? { ...finding, decision, decisionNote: note } : finding
  );
  return {
    ...analysis,
    findings,
    summary: {
      ...analysis.summary,
      openFindings: findings.filter((finding) => finding.decision === "open").length,
    },
  };
}
