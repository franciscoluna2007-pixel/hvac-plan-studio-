import type { PlanAnalysis, PlanEvidence } from "./planReader";

export const SMART_PLAN_SETUP_VERSION = "smart-plan-setup-v120.0";

export type PlanFactStatus = "verified" | "likely" | "estimated" | "missing";
export type PlanSetupRegion = NonNullable<PlanEvidence["region"]>;

export type PlanSetupTextEvidence = {
  id?: string;
  page: number;
  sheetNumber?: string;
  text: string;
  confidence?: number;
  source?: "PDF page text" | "PDF text layer" | "OCR text" | "Visual reading" | "Manual";
  region?: PlanSetupRegion;
};

export type PlanFactSource = {
  id: string;
  page: number;
  sheetNumber: string;
  excerpt: string;
  confidence: number;
  source: NonNullable<PlanSetupTextEvidence["source"]>;
  region?: PlanSetupRegion;
};

export type PlanScaleCandidate = {
  id: string;
  kind: "architectural-imperial" | "metric-ratio" | "not-to-scale";
  label: string;
  ratio: number | null;
  paperInches: number | null;
  realWorldFeet: number | null;
  confidence: number;
  occurrences: number;
  sources: PlanFactSource[];
};

export type SheetScaleAssessment = {
  page: number;
  sheetNumber: string;
  title: string;
  status: PlanFactStatus;
  selectedCandidateId: string | null;
  selectedLabel: string | null;
  candidates: PlanScaleCandidate[];
  conflict: boolean;
  requiresCalibration: boolean;
  inheritedFromPages: number[];
};

export type RoomCeilingHeight = {
  label: string;
  minimumInches: number;
  maximumInches: number;
  unit: "imperial" | "metric";
};

export type RoomFact = {
  id: string;
  name: string;
  number: string | null;
  page: number;
  sheetNumber: string;
  status: PlanFactStatus;
  ceilingType: "flat" | "vaulted" | "range" | "unknown";
  ceilingHeight: RoomCeilingHeight | null;
  conflictingHeights: RoomCeilingHeight[];
  sources: PlanFactSource[];
};

export type UnassignedCeilingFact = {
  id: string;
  page: number;
  sheetNumber: string;
  scope: "page-default" | "unassigned";
  status: PlanFactStatus;
  ceilingType: RoomFact["ceilingType"];
  ceilingHeight: RoomCeilingHeight;
  sources: PlanFactSource[];
};

export type EquipmentFact = {
  id: string;
  tag: string;
  equipmentType: string;
  status: Exclude<PlanFactStatus, "estimated" | "missing">;
  tonnage: number | null;
  tonnageStatus: PlanFactStatus;
  conflictingTonnages: number[];
  sources: PlanFactSource[];
};

export type SystemFact = {
  id: string;
  label: string;
  kind: "system" | "zone";
  status: Exclude<PlanFactStatus, "estimated" | "missing">;
  sources: PlanFactSource[];
};

export type PlanSetupReviewQuestion = {
  id: string;
  category: "scale" | "room-height" | "equipment" | "system";
  priority: "required" | "recommended";
  title: string;
  prompt: string;
  page: number | null;
  sheetNumber: string | null;
  sourceIds: string[];
  suggestedActions: string[];
};

export type PlanSetupCounts = {
  sheets: number;
  verifiedScales: number;
  likelyScales: number;
  estimatedScales: number;
  missingScales: number;
  rooms: number;
  roomHeights: number;
  systems: number;
  zones: number;
  equipment: number;
  equipmentReferences: number;
  reviewItems: number;
  requiredReviewItems: number;
};

export type SoloOperatorPlanSummary = {
  headline: string;
  detail: string;
  primaryActionLabel: string;
  primaryAction: "review-plan-facts" | "connect-and-repair";
  readyForConnectionRepair: boolean;
  statusLines: string[];
};

export type SmartPlanSetup = {
  version: typeof SMART_PLAN_SETUP_VERSION;
  sourceFingerprint: string;
  scales: SheetScaleAssessment[];
  rooms: RoomFact[];
  unassignedCeilingHeights: UnassignedCeilingFact[];
  equipment: EquipmentFact[];
  systems: SystemFact[];
  reviewQuestions: PlanSetupReviewQuestion[];
  counts: PlanSetupCounts;
  summary: SoloOperatorPlanSummary;
};

type NormalizedSource = PlanSetupTextEvidence & {
  id: string;
  sheetNumber: string;
  confidence: number;
  source: NonNullable<PlanSetupTextEvidence["source"]>;
};

type ScaleOccurrence = {
  kind: PlanScaleCandidate["kind"];
  label: string;
  ratio: number | null;
  paperInches: number | null;
  realWorldFeet: number | null;
  source: PlanFactSource;
};

type HeightOccurrence = {
  index: number;
  height: RoomCeilingHeight;
  ceilingType: RoomFact["ceilingType"];
};

type RoomOccurrence = {
  index: number;
  name: string;
  number: string | null;
};

const COMMON_METRIC_RATIOS = new Set([
  10, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000,
]);

const PLAN_LIKE_TITLE = /\b(?:PLAN|FLOOR|RCP|COORDINATION|LEVEL|LAYOUT)\b/i;
const DEFAULT_CEILING_NOTE = /\b(?:ALL|TYP(?:ICAL)?|U\.?N\.?O\.?|UNLESS\s+OTHERWISE\s+NOTED|GENERAL)\b/i;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function clampConfidence(value: number | undefined, fallback = 0.82) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value as number));
}

function compactText(value: string, limit = 280) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit - 1).trimEnd()}…` : compact;
}

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bHvac\b/g, "HVAC");
}

function uniqueSources(sources: PlanFactSource[]) {
  return [...new Map(sources.map((source) => [source.id, source])).values()]
    .sort((left, right) =>
      left.page - right.page ||
      left.id.localeCompare(right.id)
    );
}

function regionsOverlap(left: PlanSetupRegion, right: PlanSetupRegion) {
  const overlapWidth = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  );
  const overlapArea = overlapWidth * overlapHeight;
  const smallerArea = Math.max(1, Math.min(
    left.width * left.height,
    right.width * right.height,
  ));
  return overlapArea / smallerArea >= 0.35;
}

function samePrintedEvidence(left: PlanFactSource, right: PlanFactSource) {
  if (left.id === right.id) return true;
  if (left.page !== right.page) return false;
  if (left.region && right.region) return regionsOverlap(left.region, right.region);
  // Without two exact, non-overlapping regions, same-page text may be two
  // overlapping excerpts of one printed note. Keep confirmation conservative.
  return true;
}

function uniqueConfirmationSources(sources: PlanFactSource[]) {
  return uniqueSources(sources).reduce<PlanFactSource[]>((result, source) => {
    if (!result.some((current) => samePrintedEvidence(current, source))) result.push(source);
    return result;
  }, []);
}

function factSource(source: NormalizedSource, excerpt?: string): PlanFactSource {
  return {
    id: source.id,
    page: source.page,
    sheetNumber: source.sheetNumber,
    excerpt: compactText(excerpt || source.text),
    confidence: source.confidence,
    source: source.source,
    ...(source.region ? { region: source.region } : {}),
  };
}

function normalizeSources(
  analysis: PlanAnalysis,
  textEvidence: readonly PlanSetupTextEvidence[],
) {
  const sheetByPage = new Map(analysis.pages.map((page) => [page.page, page.sheetNumber]));
  const analysisSources: PlanSetupTextEvidence[] = analysis.evidence.map((evidence) => ({
    id: evidence.id,
    page: evidence.page,
    sheetNumber: evidence.sheetNumber,
    text: evidence.excerpt.trim() || `${evidence.label}: ${evidence.value}`,
    confidence: evidence.confidence,
    source: evidence.source,
    ...(evidence.region ? { region: evidence.region } : {}),
  }));
  const normalized = [...analysisSources, ...textEvidence]
    .filter((source) => Number.isInteger(source.page) && source.page > 0 && source.text.trim())
    .map((source, index): NormalizedSource => {
      const sheetNumber = source.sheetNumber?.trim() || sheetByPage.get(source.page) || `Page ${source.page}`;
      const baseId = source.id?.trim() || `plan-text-${stableHash(`${source.page}|${sheetNumber}|${source.text}|${index}`)}`;
      return {
        ...source,
        id: baseId,
        sheetNumber,
        text: source.text.trim(),
        confidence: clampConfidence(source.confidence),
        source: source.source || "PDF page text",
      };
    });
  return [...new Map(normalized.map((source) => [source.id, source])).values()]
    .sort((left, right) => left.page - right.page || left.id.localeCompare(right.id));
}

function parseMixedNumber(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const mixed = normalized.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator ? Number(mixed[1]) + Number(mixed[2]) / denominator : Number.NaN;
  }
  const fraction = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator : Number.NaN;
  }
  return Number(normalized);
}

function imperialScaleLabel(
  paperToken: string,
  feet: number,
  inches: number,
) {
  const right = inches ? `${feet}'-${inches}"` : `${feet}'-0"`;
  return `${paperToken.replace(/\s+/g, "")}" = ${right}`;
}

function extractScaleOccurrences(source: NormalizedSource): ScaleOccurrence[] {
  const results: ScaleOccurrence[] = [];
  const imperial =
    /\b(?:(?:SCALE|SC)\s*[:=]?\s*)?((?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*(?:"|″|IN(?:CH(?:ES)?)?\.?)\s*=\s*(\d+(?:\.\d+)?)\s*(?:'|′|FT\.?|FEET)\s*(?:-\s*(\d+(?:\.\d+)?)\s*(?:"|″|IN(?:CH(?:ES)?)?\.?)?)?/gi;
  for (const match of source.text.matchAll(imperial)) {
    const paperInches = parseMixedNumber(match[1]);
    const feet = Number(match[2]);
    const inches = Number(match[3] || 0);
    const realInches = feet * 12 + inches;
    if (!(paperInches > 0) || !(realInches > 0) || inches >= 12) continue;
    const ratio = realInches / paperInches;
    if (!Number.isFinite(ratio) || ratio < 2 || ratio > 12000) continue;
    results.push({
      kind: "architectural-imperial",
      label: imperialScaleLabel(match[1], feet, inches),
      ratio,
      paperInches,
      realWorldFeet: realInches / 12,
      source: factSource(source, match[0]),
    });
  }

  const metric = /\b(?:(SCALE|SC)\s*[:=]?\s*)?1\s*:\s*(\d{1,4})\b/gi;
  for (const match of source.text.matchAll(metric)) {
    const ratio = Number(match[2]);
    if (ratio < 2 || ratio > 5000) continue;
    const localStart = Math.max(0, (match.index || 0) - 36);
    const localEnd = Math.min(source.text.length, (match.index || 0) + match[0].length + 36);
    const localContext = source.text.slice(localStart, localEnd);
    const contextSupportsScale =
      Boolean(match[1]) ||
      (COMMON_METRIC_RATIOS.has(ratio) &&
        (source.text.length <= 48 || /\b(?:SCALE|PLAN|DETAIL|ELEVATION|SECTION|METRIC|DRAWING)\b/i.test(localContext)));
    if (!contextSupportsScale) continue;
    results.push({
      kind: "metric-ratio",
      label: `1:${ratio}`,
      ratio,
      paperInches: null,
      realWorldFeet: null,
      source: factSource(source, match[0]),
    });
  }

  const notToScale = /\b(?:N\.?\s*T\.?\s*S\.?|NOT\s+TO\s+SCALE)\b/gi;
  for (const match of source.text.matchAll(notToScale)) {
    results.push({
      kind: "not-to-scale",
      label: "NTS",
      ratio: null,
      paperInches: null,
      realWorldFeet: null,
      source: factSource(source, match[0]),
    });
  }
  return results;
}

function groupScaleCandidates(page: number, occurrences: ScaleOccurrence[]) {
  const groups = new Map<string, ScaleOccurrence[]>();
  occurrences.forEach((occurrence) => {
    const ratioKey = occurrence.ratio === null ? "none" : occurrence.ratio.toFixed(6);
    const key = `${occurrence.kind}|${ratioKey}`;
    groups.set(key, [...(groups.get(key) || []), occurrence]);
  });
  return [...groups.entries()].map(([key, rows]): PlanScaleCandidate => {
    const sources = uniqueConfirmationSources(rows.map((row) => row.source));
    const confidenceBoost = Math.min(0.08, Math.max(0, sources.length - 1) * 0.04);
    const strongestConfidence = Math.max(...sources.map((source) => source.confidence));
    const first = rows[0];
    return {
      id: `scale-${stableHash(`${page}|${key}`)}`,
      kind: first.kind,
      label: first.label,
      ratio: first.ratio,
      paperInches: first.paperInches,
      realWorldFeet: first.realWorldFeet,
      confidence: Math.min(0.99, strongestConfidence + 0.04 + confidenceBoost),
      occurrences: sources.length,
      sources,
    };
  }).sort((left, right) =>
    right.occurrences - left.occurrences ||
    right.confidence - left.confidence ||
    left.label.localeCompare(right.label)
  );
}

function buildScaleAssessments(
  analysis: PlanAnalysis,
  sources: NormalizedSource[],
) {
  const pageRows = [...analysis.pages]
    .filter((page) => {
      const explicitScale = sources
        .filter((source) => source.page === page.page)
        .some((source) => extractScaleOccurrences(source).length > 0);
      return (
        explicitScale ||
        page.classification === "Mechanical plan" ||
        page.classification === "RCP / coordination" ||
        (page.classification === "Related sheet" && PLAN_LIKE_TITLE.test(page.title)) ||
        PLAN_LIKE_TITLE.test(page.title)
      );
    })
    .sort((left, right) => left.page - right.page);
  const direct = pageRows.map((page): SheetScaleAssessment => {
    const candidates = groupScaleCandidates(
      page.page,
      sources
        .filter((source) => source.page === page.page)
        .flatMap(extractScaleOccurrences),
    );
    const conflict = candidates.length > 1;
    const selected = conflict ? null : candidates[0] || null;
    const status: PlanFactStatus = !selected
      ? "missing"
      : selected.occurrences >= 2
        ? "verified"
        : "likely";
    return {
      page: page.page,
      sheetNumber: page.sheetNumber,
      title: page.title,
      status,
      selectedCandidateId: selected?.id || null,
      selectedLabel: selected?.label || null,
      candidates,
      conflict,
      requiresCalibration: !selected || selected.kind === "not-to-scale",
      inheritedFromPages: [],
    };
  });

  const directNumeric = direct
    .filter((row) => !row.conflict && row.selectedCandidateId)
    .map((row) => ({
      row,
      candidate: row.candidates.find((candidate) => candidate.id === row.selectedCandidateId)!,
    }))
    .filter(({ candidate }) => candidate.kind !== "not-to-scale" && candidate.ratio !== null);
  const distinctRatios = new Map<string, typeof directNumeric>();
  directNumeric.forEach((entry) => {
    const key = `${entry.candidate.kind}|${entry.candidate.ratio!.toFixed(6)}`;
    distinctRatios.set(key, [...(distinctRatios.get(key) || []), entry]);
  });
  if (distinctRatios.size !== 1) return direct;
  const inherited = [...distinctRatios.values()][0];
  const template = inherited[0]?.candidate;
  if (!template) return direct;
  const inheritedFromPages = [...new Set(inherited.map(({ row }) => row.page))].sort((a, b) => a - b);

  return direct.map((row) => {
    if (
      row.status !== "missing" ||
      row.conflict ||
      !analysis.pages.find((page) => page.page === row.page)?.readable ||
      !PLAN_LIKE_TITLE.test(`${row.title} ${analysis.pages.find((page) => page.page === row.page)?.classification || ""}`)
    ) {
      return row;
    }
    const candidate: PlanScaleCandidate = {
      ...template,
      id: `scale-${stableHash(`${row.page}|estimated|${template.kind}|${template.ratio}`)}`,
      confidence: Math.min(0.69, template.confidence * 0.72),
    };
    return {
      ...row,
      status: "estimated" as const,
      selectedCandidateId: candidate.id,
      selectedLabel: candidate.label,
      candidates: [candidate],
      requiresCalibration: true,
      inheritedFromPages,
    };
  });
}

function inchesLabel(totalInches: number) {
  const rounded = Math.round(totalInches * 10) / 10;
  const feet = Math.floor(rounded / 12);
  const inches = Math.round((rounded - feet * 12) * 10) / 10;
  return `${feet}'-${inches}"`;
}

function heightFromImperial(minimumInches: number, maximumInches = minimumInches): RoomCeilingHeight {
  return {
    label: minimumInches === maximumInches
      ? inchesLabel(minimumInches)
      : `${inchesLabel(minimumInches)} to ${inchesLabel(maximumInches)}`,
    minimumInches,
    maximumInches,
    unit: "imperial",
  };
}

function heightFromMetric(minimumInches: number, label: string): RoomCeilingHeight {
  const rounded = Math.round(minimumInches * 10) / 10;
  return {
    label,
    minimumInches: rounded,
    maximumInches: rounded,
    unit: "metric",
  };
}

function extractHeightOccurrences(text: string): HeightOccurrence[] {
  const results: HeightOccurrence[] = [];
  const imperialRange =
    /(\d{1,2})\s*(?:'|′|FT\.?)\s*(?:-\s*(\d{1,2})\s*(?:"|″|IN\.?)?)?\s*(?:TO|THRU|–|—)\s*(\d{1,2})\s*(?:'|′|FT\.?)\s*(?:-\s*(\d{1,2})\s*(?:"|″|IN\.?)?)?[^.\n]{0,28}\b(?:CEILING|CLG|C\.?\s*H\.?|VAULT(?:ED)?)\b/gi;
  for (const match of text.matchAll(imperialRange)) {
    const first = Number(match[1]) * 12 + Number(match[2] || 0);
    const second = Number(match[3]) * 12 + Number(match[4] || 0);
    if (first < 72 || second < 72 || first > 360 || second > 360) continue;
    results.push({
      index: match.index || 0,
      height: heightFromImperial(Math.min(first, second), Math.max(first, second)),
      ceilingType: /\bVAULT/i.test(match[0]) ? "vaulted" : "range",
    });
  }

  const ceilingFirst =
    /\b(?:CEILING|CLG|C\.?\s*H\.?)(?:\s+(?:HEIGHT|HT\.?))?\s*[:=@-]?\s*(\d{1,2})\s*(?:'|′|FT\.?)\s*(?:-\s*(\d{1,2})\s*(?:"|″|IN\.?)?)?/gi;
  const heightFirst =
    /(\d{1,2})\s*(?:'|′|FT\.?)\s*(?:-\s*(\d{1,2})\s*(?:"|″|IN\.?)?)?\s*(?:A\.?F\.?F\.?\s*)?\b(?:CEILING|CLG|C\.?\s*H\.?)\b/gi;
  for (const expression of [ceilingFirst, heightFirst]) {
    for (const match of text.matchAll(expression)) {
      const totalInches = Number(match[1]) * 12 + Number(match[2] || 0);
      if (totalInches < 72 || totalInches > 360) continue;
      results.push({
        index: match.index || 0,
        height: heightFromImperial(totalInches),
        ceilingType: /\b(?:VAULT|SLOP)/i.test(text.slice(
          Math.max(0, (match.index || 0) - 24),
          Math.min(text.length, (match.index || 0) + match[0].length + 24),
        )) ? "vaulted" : "flat",
      });
    }
  }

  const metricMillimeters =
    /\b(?:CEILING|CLG|C\.?\s*H\.?)(?:\s+(?:HEIGHT|HT\.?))?\s*[:=@-]?\s*(\d{3,4})\s*MM\b|\b(\d{3,4})\s*MM\s*(?:A\.?F\.?F\.?\s*)?(?:CEILING|CLG|C\.?\s*H\.?)\b/gi;
  for (const match of text.matchAll(metricMillimeters)) {
    const millimeters = Number(match[1] || match[2]);
    if (millimeters < 1800 || millimeters > 9000) continue;
    results.push({
      index: match.index || 0,
      height: heightFromMetric(millimeters / 25.4, `${millimeters} mm`),
      ceilingType: "flat",
    });
  }

  const metricMeters =
    /\b(?:CEILING|CLG|C\.?\s*H\.?)(?:\s+(?:HEIGHT|HT\.?))?\s*[:=@-]?\s*(\d(?:\.\d{1,2})?)\s*M\b|\b(\d(?:\.\d{1,2})?)\s*M\s*(?:A\.?F\.?F\.?\s*)?(?:CEILING|CLG|C\.?\s*H\.?)\b/gi;
  for (const match of text.matchAll(metricMeters)) {
    const meters = Number(match[1] || match[2]);
    if (meters < 1.8 || meters > 9) continue;
    results.push({
      index: match.index || 0,
      height: heightFromMetric(meters * 1000 / 25.4, `${meters} m`),
      ceilingType: "flat",
    });
  }

  return results
    .filter((row, index, rows) =>
      rows.findIndex((candidate) =>
        Math.abs(candidate.index - row.index) <= 2 &&
        Math.abs(candidate.height.minimumInches - row.height.minimumInches) < 0.1 &&
        Math.abs(candidate.height.maximumInches - row.height.maximumInches) < 0.1
      ) === index
    )
    .sort((left, right) => left.index - right.index);
}

const NAMED_ROOM =
  /\b(PRIMARY\s+(?:BEDROOM|SUITE)|MASTER\s+(?:BEDROOM|SUITE)|BEDROOM(?:\s+[A-Z0-9]+)?|BED\s*[A-Z0-9]+|LIVING\s+ROOM|GREAT\s+ROOM|FAMILY\s+ROOM|DINING\s+ROOM|KITCHEN|OFFICE|STUDY|DEN|BATHROOM(?:\s+[A-Z0-9]+)?|BATH(?:\s+[A-Z0-9]+)?|LAUNDRY(?:\s+ROOM)?|UTILITY(?:\s+ROOM)?|GARAGE|FOYER|HALLWAY|HALL|CLOSET|PANTRY|LOBBY|CONFERENCE\s+ROOM|CLASSROOM(?:\s+[A-Z0-9]+)?|OPEN\s+OFFICE|BREAK\s+ROOM|WAREHOUSE|SHOP|RESTROOM(?:\s+[A-Z0-9]+)?)\b/gi;

function roomNumberFromName(name: string) {
  const match = name.match(/\b(?:BEDROOM|BED|BATHROOM|BATH|CLASSROOM|RESTROOM)\s*([A-Z0-9]+)\b/i);
  return match?.[1]?.toUpperCase() || null;
}

function extractRoomOccurrences(text: string): RoomOccurrence[] {
  const results: RoomOccurrence[] = [];
  for (const match of text.matchAll(NAMED_ROOM)) {
    const following = text.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 12);
    if (/^\s+(?:PLAN|SCHEDULE|NOTES?)\b/i.test(following)) continue;
    results.push({
      index: match.index || 0,
      name: titleCase(match[1]),
      number: roomNumberFromName(match[1]),
    });
  }
  const lines = text.split(/\r?\n/);
  let offset = 0;
  const numberedRoom = /^\s*(?:ROOM|RM)\s*(?:NO\.?|#)?\s*([A-Z]?\d{1,4}[A-Z]?)\s*[-: ]+\s*([A-Z][A-Z &/]{2,28}?)(?=\s+(?:CEILING|CLG|C\.?\s*H\.?|\d{1,2}\s*['′])|$)/i;
  lines.forEach((line) => {
    const match = line.match(numberedRoom);
    if (match) {
      results.push({
        index: offset + (match.index || 0),
        name: titleCase(match[2]),
        number: match[1].toUpperCase(),
      });
    }
    offset += line.length + 1;
  });
  return results
    .filter((row, index, rows) =>
      rows.findIndex((candidate) =>
        Math.abs(candidate.index - row.index) <= 3 &&
        candidate.name.toUpperCase() === row.name.toUpperCase() &&
        candidate.number === row.number
      ) === index
    )
    .sort((left, right) => left.index - right.index);
}

function heightKey(height: RoomCeilingHeight) {
  return `${height.minimumInches.toFixed(1)}|${height.maximumInches.toFixed(1)}`;
}

function buildRoomFacts(sources: NormalizedSource[]) {
  const rooms = new Map<string, {
    name: string;
    number: string | null;
    page: number;
    sheetNumber: string;
    sources: PlanFactSource[];
    heights: Array<HeightOccurrence & { source: PlanFactSource }>;
  }>();
  const unassigned: UnassignedCeilingFact[] = [];

  sources.forEach((source) => {
    const roomOccurrences = extractRoomOccurrences(source.text);
    const heightOccurrences = extractHeightOccurrences(source.text);
    const sourceFact = factSource(source);
    roomOccurrences.forEach((room) => {
      const key = `${source.page}|${room.number || ""}|${room.name.toUpperCase()}`;
      const current = rooms.get(key) || {
        name: room.name,
        number: room.number,
        page: source.page,
        sheetNumber: source.sheetNumber,
        sources: [],
        heights: [],
      };
      current.sources.push(sourceFact);
      if (heightOccurrences.length) {
        const nearest = [...heightOccurrences].sort((left, right) =>
          Math.abs(left.index - room.index) - Math.abs(right.index - room.index)
        )[0];
        const distance = Math.abs(nearest.index - room.index);
        if (distance <= 120 || (roomOccurrences.length === 1 && heightOccurrences.length === 1)) {
          current.heights.push({ ...nearest, source: sourceFact });
        }
      }
      rooms.set(key, current);
    });

    if (!roomOccurrences.length) {
      heightOccurrences.forEach((occurrence) => {
        const scope = DEFAULT_CEILING_NOTE.test(source.text) ? "page-default" as const : "unassigned" as const;
        unassigned.push({
          id: `ceiling-${stableHash(`${source.id}|${heightKey(occurrence.height)}|${scope}`)}`,
          page: source.page,
          sheetNumber: source.sheetNumber,
          scope,
          status: scope === "page-default" && source.confidence >= 0.9 ? "likely" : "estimated",
          ceilingType: occurrence.ceilingType,
          ceilingHeight: occurrence.height,
          sources: [sourceFact],
        });
      });
    }
  });

  const roomFacts = [...rooms.entries()].map(([key, room]): RoomFact => {
    const groupedHeights = new Map<string, typeof room.heights>();
    room.heights.forEach((height) => {
      const groupKey = heightKey(height.height);
      groupedHeights.set(groupKey, [...(groupedHeights.get(groupKey) || []), height]);
    });
    const heightGroups = [...groupedHeights.values()].sort((left, right) =>
      right.length - left.length ||
      left[0].height.minimumInches - right[0].height.minimumInches
    );
    const conflict = heightGroups.length > 1;
    const selectedGroup = conflict ? null : heightGroups[0] || null;
    const selected = selectedGroup?.[0] || null;
    const sourceCount = selectedGroup
      ? uniqueConfirmationSources(selectedGroup.map((height) => height.source)).length
      : 0;
    const status: PlanFactStatus = conflict || !selected
      ? "missing"
      : sourceCount >= 2
        ? "verified"
        : "likely";
    return {
      id: `room-${stableHash(key)}`,
      name: room.name,
      number: room.number,
      page: room.page,
      sheetNumber: room.sheetNumber,
      status,
      ceilingType: selected?.ceilingType || (conflict ? heightGroups[0][0].ceilingType : "unknown"),
      ceilingHeight: selected?.height || null,
      conflictingHeights: conflict ? heightGroups.map((group) => group[0].height) : [],
      sources: uniqueSources([
        ...room.sources,
        ...room.heights.map((height) => height.source),
      ]),
    };
  }).sort((left, right) =>
    left.page - right.page ||
    (left.number || "").localeCompare(right.number || "") ||
    left.name.localeCompare(right.name)
  );

  const uniqueUnassigned = [...new Map(unassigned.map((fact) => [
    `${fact.page}|${fact.scope}|${heightKey(fact.ceilingHeight)}`,
    fact,
  ])).values()].sort((left, right) =>
    left.page - right.page ||
    left.ceilingHeight.minimumInches - right.ceilingHeight.minimumInches
  );
  return { rooms: roomFacts, unassigned: uniqueUnassigned };
}

const EQUIPMENT_TAG =
  /\b(AHU|FCU|RTU|ERV|HRV|MAU|DOAS|CU|HP|EF|SF|FURNACE|AIR\s+HANDLER)\s*[-#:]?\s*([A-Z]?\d{1,3}[A-Z]?)\b/gi;
const TONNAGE = /\b(\d(?:\.\d)?)\s*(?:TON|TONS)\b/gi;
const SYSTEM_TAG = /\b(SYSTEM|SYS|ZONE)\s*[-#:]?\s*([A-Z0-9][A-Z0-9.-]{0,12})\b/gi;

function buildEquipmentAndSystems(sources: NormalizedSource[]) {
  const equipment = new Map<string, {
    tag: string;
    equipmentType: string;
    sources: PlanFactSource[];
    tonnages: Array<{ value: number; source: PlanFactSource }>;
  }>();
  const systems = new Map<string, {
    label: string;
    kind: SystemFact["kind"];
    sources: PlanFactSource[];
  }>();

  sources.forEach((source) => {
    const sourceFact = factSource(source);
    const tonnageOccurrences = [...source.text.matchAll(TONNAGE)]
      .map((match) => ({ index: match.index || 0, value: Number(match[1]) }))
      .filter((row) => row.value >= 0.5 && row.value <= 50);
    for (const match of source.text.matchAll(EQUIPMENT_TAG)) {
      const equipmentType = match[1].toUpperCase().replace(/\s+/g, " ");
      const tag = `${equipmentType === "AIR HANDLER" ? "AHU" : equipmentType}-${match[2].toUpperCase()}`;
      const current = equipment.get(tag) || {
        tag,
        equipmentType,
        sources: [],
        tonnages: [],
      };
      current.sources.push(sourceFact);
      const nearestTonnage = [...tonnageOccurrences].sort((left, right) =>
        Math.abs(left.index - (match.index || 0)) - Math.abs(right.index - (match.index || 0))
      )[0];
      if (nearestTonnage && Math.abs(nearestTonnage.index - (match.index || 0)) <= 100) {
        current.tonnages.push({ value: nearestTonnage.value, source: sourceFact });
      }
      equipment.set(tag, current);
    }
    for (const match of source.text.matchAll(SYSTEM_TAG)) {
      const kind: SystemFact["kind"] = match[1].toUpperCase() === "ZONE" ? "zone" : "system";
      const label = `${kind === "zone" ? "Zone" : "System"} ${match[2].toUpperCase()}`;
      const key = `${kind}|${label.toUpperCase()}`;
      const current = systems.get(key) || { label, kind, sources: [] };
      current.sources.push(sourceFact);
      systems.set(key, current);
    }
  });

  const equipmentFacts = [...equipment.values()].map((fact): EquipmentFact => {
    const groupedTonnages = new Map<number, typeof fact.tonnages>();
    fact.tonnages.forEach((tonnage) => {
      groupedTonnages.set(tonnage.value, [...(groupedTonnages.get(tonnage.value) || []), tonnage]);
    });
    const groups = [...groupedTonnages.entries()].sort((left, right) =>
      right[1].length - left[1].length || left[0] - right[0]
    );
    const conflict = groups.length > 1;
    const tonnageSources = !conflict && groups[0]
      ? uniqueSources(groups[0][1].map((row) => row.source)).length
      : 0;
    return {
      id: `equipment-${stableHash(fact.tag)}`,
      tag: fact.tag,
      equipmentType: fact.equipmentType,
      status: uniqueConfirmationSources(fact.sources).length >= 2 ? "verified" : "likely",
      tonnage: conflict ? null : groups[0]?.[0] || null,
      tonnageStatus: conflict || !groups.length
        ? "missing"
        : tonnageSources >= 2
          ? "verified"
          : "likely",
      conflictingTonnages: conflict ? groups.map(([value]) => value) : [],
      sources: uniqueSources([
        ...fact.sources,
        ...fact.tonnages.map((row) => row.source),
      ]),
    };
  }).sort((left, right) => left.tag.localeCompare(right.tag));

  const systemFacts = [...systems.values()].map((fact): SystemFact => ({
    id: `system-${stableHash(`${fact.kind}|${fact.label}`)}`,
    label: fact.label,
    kind: fact.kind,
    status: uniqueConfirmationSources(fact.sources).length >= 2 ? "verified" : "likely",
    sources: uniqueSources(fact.sources),
  })).sort((left, right) =>
    left.kind.localeCompare(right.kind) ||
    left.label.localeCompare(right.label)
  );
  return { equipment: equipmentFacts, systems: systemFacts };
}

function questionId(category: PlanSetupReviewQuestion["category"], key: string) {
  return `setup-question-${stableHash(`${category}|${key}`)}`;
}

function buildReviewQuestions(
  scales: SheetScaleAssessment[],
  rooms: RoomFact[],
  unassigned: UnassignedCeilingFact[],
  equipment: EquipmentFact[],
  systems: SystemFact[],
) {
  const questions: PlanSetupReviewQuestion[] = [];
  scales.forEach((scale) => {
    if (scale.conflict) {
      questions.push({
        id: questionId("scale", `${scale.page}|conflict`),
        category: "scale",
        priority: "required",
        title: `Choose the scale for ${scale.sheetNumber}`,
        prompt: `${scale.sheetNumber} contains conflicting scales (${scale.candidates.map((candidate) => candidate.label).join(", ")}). Which drawing view should connection repair use?`,
        page: scale.page,
        sheetNumber: scale.sheetNumber,
        sourceIds: scale.candidates.flatMap((candidate) => candidate.sources.map((source) => source.id)),
        suggestedActions: ["Choose a detected scale", "Calibrate two known points", "Mark this sheet NTS"],
      });
    } else if (scale.status === "missing") {
      questions.push({
        id: questionId("scale", `${scale.page}|missing`),
        category: "scale",
        priority: "required",
        title: `Set the scale for ${scale.sheetNumber}`,
        prompt: `No dependable scale was found on ${scale.sheetNumber}. Calibrate one known dimension before distance-based repairs.`,
        page: scale.page,
        sheetNumber: scale.sheetNumber,
        sourceIds: [],
        suggestedActions: ["Calibrate two known points", "Enter the printed scale", "Mark this sheet NTS"],
      });
    } else if (scale.status === "estimated" || scale.candidates[0]?.kind === "not-to-scale") {
      questions.push({
        id: questionId("scale", `${scale.page}|confirm-estimate`),
        category: "scale",
        priority: "required",
        title: `Confirm the scale for ${scale.sheetNumber}`,
        prompt: scale.candidates[0]?.kind === "not-to-scale"
          ? `${scale.sheetNumber} is marked NTS. Calibrate it before using real-world connection distances.`
          : `${scale.selectedLabel} was carried over from ${scale.inheritedFromPages.length === 1 ? `page ${scale.inheritedFromPages[0]}` : "other plan sheets"}. Confirm or calibrate it for ${scale.sheetNumber}.`,
        page: scale.page,
        sheetNumber: scale.sheetNumber,
        sourceIds: scale.candidates.flatMap((candidate) => candidate.sources.map((source) => source.id)),
        suggestedActions: ["Confirm the suggested scale", "Calibrate two known points", "Choose another scale"],
      });
    }
  });

  const missingRoomHeights = new Map<number, RoomFact[]>();
  rooms.forEach((room) => {
    if (room.conflictingHeights.length) {
      questions.push({
        id: questionId("room-height", `${room.id}|conflict`),
        category: "room-height",
        priority: "required",
        title: `Choose ${room.name}'s ceiling height`,
        prompt: `${room.name} has conflicting ceiling heights (${room.conflictingHeights.map((height) => height.label).join(", ")}). Which source applies to this room?`,
        page: room.page,
        sheetNumber: room.sheetNumber,
        sourceIds: room.sources.map((source) => source.id),
        suggestedActions: ["Choose a detected height", "Enter the room height", "Open the source locations"],
      });
    } else if (!room.ceilingHeight) {
      const current = missingRoomHeights.get(room.page) || [];
      missingRoomHeights.set(room.page, [...current, room]);
    }
  });
  [...missingRoomHeights.entries()].forEach(([page, pageRooms]) => {
    const first = pageRooms[0];
    const roomNames = pageRooms.slice(0, 5).map((room) => room.name);
    const additional = Math.max(0, pageRooms.length - roomNames.length);
    questions.push({
      id: questionId("room-height", `${page}|missing|${pageRooms.map((room) => room.id).join("|")}`),
      category: "room-height",
      priority: "recommended",
      title: pageRooms.length === 1
        ? `Add ${first.name}'s ceiling height`
        : `Add ceiling heights for ${pageRooms.length} rooms on ${first.sheetNumber}`,
      prompt: pageRooms.length === 1
        ? `No ceiling height was found for ${first.name}. Add it or identify the reflected ceiling plan before comfort review.`
        : `No ceiling height was found for ${roomNames.join(", ")}${additional ? `, and ${additional} more room${additional === 1 ? "" : "s"}` : ""}. Enter one shared height only if the same plan note applies to all of them.`,
      page,
      sheetNumber: first.sheetNumber,
      sourceIds: pageRooms.flatMap((room) => room.sources.map((source) => source.id)),
      suggestedActions: ["Apply one verified page default", "Enter different room heights", "Leave them unknown"],
    });
  });

  unassigned.filter((fact) => fact.scope === "unassigned").forEach((fact) => {
    questions.push({
      id: questionId("room-height", `${fact.id}|assign`),
      category: "room-height",
      priority: "recommended",
      title: `Assign the ${fact.ceilingHeight.label} ceiling note`,
      prompt: `A ${fact.ceilingHeight.label} ceiling height was found on ${fact.sheetNumber}, but it could not be tied to a room.`,
      page: fact.page,
      sheetNumber: fact.sheetNumber,
      sourceIds: fact.sources.map((source) => source.id),
      suggestedActions: ["Assign it to a room", "Use it as the page default", "Ignore this note"],
    });
  });

  if (!equipment.length) {
    questions.push({
      id: questionId("equipment", "missing"),
      category: "equipment",
      priority: "required",
      title: "Identify the HVAC equipment",
      prompt: "No unique equipment tag was found. Select the unit or its schedule before system repair.",
      page: null,
      sheetNumber: null,
      sourceIds: [],
      suggestedActions: ["Select equipment on the plan", "Open the equipment schedule", "Enter the equipment tag"],
    });
  } else {
    equipment.filter((fact) => fact.tonnageStatus === "missing").forEach((fact) => {
      questions.push({
        id: questionId("equipment", `${fact.id}|tonnage`),
        category: "equipment",
        priority: fact.conflictingTonnages.length ? "required" : "recommended",
        title: `${fact.conflictingTonnages.length ? "Resolve" : "Add"} ${fact.tag} capacity`,
        prompt: fact.conflictingTonnages.length
          ? `${fact.tag} is linked to conflicting capacities (${fact.conflictingTonnages.map((value) => `${value} tons`).join(", ")}). Choose the scheduled value.`
          : `No tonnage was tied to ${fact.tag}. Confirm its capacity before airflow sizing.`,
        page: fact.sources[0]?.page || null,
        sheetNumber: fact.sources[0]?.sheetNumber || null,
        sourceIds: fact.sources.map((source) => source.id),
        suggestedActions: ["Choose the scheduled capacity", "Open the equipment schedule", "Leave it unknown"],
      });
    });
  }

  const explicitSystems = systems.filter((fact) => fact.kind === "system");
  if (equipment.length && !explicitSystems.length) {
    questions.push({
      id: questionId("system", "missing"),
      category: "system",
      priority: "required",
      title: "Confirm the system assignments",
      prompt: "Equipment was found, but no explicit system labels were detected. Confirm which rooms and runs belong to each unit.",
      page: null,
      sheetNumber: null,
      sourceIds: equipment.flatMap((fact) => fact.sources.map((source) => source.id)),
      suggestedActions: ["Create systems from equipment", "Select system boundaries", "Open the mechanical plan"],
    });
  }

  const priorityOrder = { required: 0, recommended: 1 };
  const categoryOrder = { scale: 0, equipment: 1, system: 2, "room-height": 3 };
  return questions.sort((left, right) =>
    priorityOrder[left.priority] - priorityOrder[right.priority] ||
    categoryOrder[left.category] - categoryOrder[right.category] ||
    (left.page ?? Number.MAX_SAFE_INTEGER) - (right.page ?? Number.MAX_SAFE_INTEGER) ||
    left.title.localeCompare(right.title)
  );
}

function buildCounts(
  analysis: PlanAnalysis,
  scales: SheetScaleAssessment[],
  rooms: RoomFact[],
  equipment: EquipmentFact[],
  systems: SystemFact[],
  reviewQuestions: PlanSetupReviewQuestion[],
): PlanSetupCounts {
  return {
    sheets: scales.length,
    verifiedScales: scales.filter((scale) => scale.status === "verified").length,
    likelyScales: scales.filter((scale) => scale.status === "likely").length,
    estimatedScales: scales.filter((scale) => scale.status === "estimated").length,
    missingScales: scales.filter((scale) => scale.status === "missing").length,
    rooms: rooms.length,
    roomHeights: rooms.filter((room) => room.ceilingHeight).length,
    systems: systems.filter((system) => system.kind === "system").length,
    zones: systems.filter((system) => system.kind === "zone").length,
    equipment: equipment.length,
    equipmentReferences: analysis.summary.equipment,
    reviewItems: reviewQuestions.length,
    requiredReviewItems: reviewQuestions.filter((question) => question.priority === "required").length,
  };
}

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function buildSoloOperatorSummary(counts: PlanSetupCounts): SoloOperatorPlanSummary {
  const usableScaleCount = counts.verifiedScales + counts.likelyScales;
  const readyForConnectionRepair = counts.requiredReviewItems === 0 && counts.equipment > 0;
  const primaryAction = readyForConnectionRepair ? "connect-and-repair" : "review-plan-facts";
  return {
    headline: "Plan scan complete",
    detail: counts.reviewItems
      ? `${plural(counts.reviewItems, "item")} need${counts.reviewItems === 1 ? "s" : ""} your review before the Plan Helper relies on every detected fact.`
      : "The plan facts are ready for the draw-first workflow.",
    primaryActionLabel: readyForConnectionRepair
      ? "Draw the supply routes first"
      : `Review ${plural(counts.reviewItems, "item")}`,
    primaryAction,
    readyForConnectionRepair,
    statusLines: [
      `Scale: ${usableScaleCount} of ${counts.sheets} sheets directly detected`,
      `Rooms: ${counts.rooms} found; ${counts.roomHeights} with ceiling heights`,
      `Systems: ${counts.systems} found; ${counts.equipment} equipment units identified`,
      `Needs your review: ${counts.reviewItems}`,
    ],
  };
}

export function buildSmartPlanSetup(
  analysis: PlanAnalysis | null | undefined,
  textEvidence: readonly PlanSetupTextEvidence[] = [],
): SmartPlanSetup | null {
  if (!analysis) return null;
  const sources = normalizeSources(analysis, textEvidence);
  const scales = buildScaleAssessments(analysis, sources);
  const { rooms, unassigned } = buildRoomFacts(sources);
  const { equipment, systems } = buildEquipmentAndSystems(sources);
  const reviewQuestions = buildReviewQuestions(
    scales,
    rooms,
    unassigned,
    equipment,
    systems,
  );
  const counts = buildCounts(
    analysis,
    scales,
    rooms,
    equipment,
    systems,
    reviewQuestions,
  );
  return {
    version: SMART_PLAN_SETUP_VERSION,
    sourceFingerprint: analysis.sourceFingerprint,
    scales,
    rooms,
    unassignedCeilingHeights: unassigned,
    equipment,
    systems,
    reviewQuestions,
    counts,
    summary: buildSoloOperatorSummary(counts),
  };
}
