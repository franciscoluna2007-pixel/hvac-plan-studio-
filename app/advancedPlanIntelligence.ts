import type {
  PlanAnalysis,
  PlanEvidence,
  PlanEvidenceCategory,
} from "./planReader";

export const ADVANCED_PLAN_INTELLIGENCE_VERSION = "advanced-plan-intelligence-v115.0";

export type EvidenceCoverageRow = {
  page: number;
  sheetNumber: string;
  title: string;
  classification: PlanAnalysis["pages"][number]["classification"];
  readable: boolean;
  ocrStatus: "not-needed" | "required";
  evidenceCount: number;
  coveredCategories: PlanEvidenceCategory[];
  missingCategories: PlanEvidenceCategory[];
  confidence: number;
  regionCoveragePercent: number;
};

export type SourceRelationship = {
  id: string;
  kind: "equipment-tag" | "schedule-link" | "airflow-link";
  label: string;
  sourceSheets: string[];
  evidenceIds: string[];
  confidence: number;
  confirmed: boolean;
};

export type AdvancedPlanIntelligence = {
  version: typeof ADVANCED_PLAN_INTELLIGENCE_VERSION;
  sourceFingerprint: string;
  coverage: EvidenceCoverageRow[];
  relationships: SourceRelationship[];
  ocrRequiredPages: number[];
  averageCoveragePercent: number;
  averageRegionCoveragePercent: number;
  readinessScore: number;
  blockers: string[];
  notices: string[];
};

const requiredCategoriesBySheet: Partial<Record<
  PlanAnalysis["pages"][number]["classification"],
  PlanEvidenceCategory[]
>> = {
  "Mechanical plan": ["Ductwork", "Air devices"],
  "Mechanical schedule": ["Equipment", "Airflow", "Schedules"],
  "RCP / coordination": ["Air devices"],
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function exactEquipmentTag(evidence: PlanEvidence) {
  if (evidence.category !== "Equipment" || evidence.label !== "Equipment tag") return "";
  const normalized = evidence.value.trim().toUpperCase().replace(/\s+/g, " ");
  if (["AHU", "FCU", "RTU", "ERV", "HRV", "MAU", "DOAS", "CU", "HP", "EF", "SF", "FURNACE", "AIR HANDLER"].includes(normalized)) {
    return "";
  }
  return normalized;
}

export function buildAdvancedPlanIntelligence(
  analysis: PlanAnalysis | null | undefined,
): AdvancedPlanIntelligence | null {
  if (!analysis) return null;
  const coverage = analysis.pages.map((page) => {
    const rows = analysis.evidence.filter((evidence) => evidence.page === page.page);
    const coveredCategories = [...new Set(rows.map((evidence) => evidence.category))]
      .sort((left, right) => left.localeCompare(right)) as PlanEvidenceCategory[];
    const relevantRequired = requiredCategoriesBySheet[page.classification] || [];
    const missingCategories = relevantRequired.filter((category) => !coveredCategories.includes(category));
    const regionRows = rows.filter((row) => row.region);
    return {
      page: page.page,
      sheetNumber: page.sheetNumber,
      title: page.title,
      classification: page.classification,
      readable: page.readable,
      ocrStatus: page.readable ? "not-needed" as const : "required" as const,
      evidenceCount: rows.length,
      coveredCategories,
      missingCategories,
      confidence: page.confidence,
      regionCoveragePercent: rows.length ? Math.round(regionRows.length / rows.length * 100) : 0,
    };
  });

  const relationships: SourceRelationship[] = [];
  const tags = new Map<string, PlanEvidence[]>();
  analysis.evidence.forEach((evidence) => {
    const tag = exactEquipmentTag(evidence);
    if (!tag) return;
    tags.set(tag, [...(tags.get(tag) || []), evidence]);
  });
  tags.forEach((rows, tag) => {
    const sourceSheets = [...new Set(rows.map((row) => row.sheetNumber))].sort();
    if (sourceSheets.length < 2) return;
    relationships.push({
      id: `relationship-${stableHash(`${tag}|${sourceSheets.join("|")}`)}`,
      kind: "equipment-tag",
      label: `${tag} appears across ${sourceSheets.length} sheets`,
      sourceSheets,
      evidenceIds: rows.map((row) => row.id),
      confidence: Math.min(...rows.map((row) => row.confidence)),
      confirmed: false,
    });
  });
  const mechanicalCoverage = coverage.filter((row) =>
    (requiredCategoriesBySheet[row.classification] || []).length > 0
  );
  const totalRequired = mechanicalCoverage.reduce((total, row) =>
    total + (requiredCategoriesBySheet[row.classification] || [])
      .filter((category) => row.coveredCategories.includes(category)).length, 0);
  const possibleRequired = Math.max(1, mechanicalCoverage.reduce((total, row) =>
    total + (requiredCategoriesBySheet[row.classification] || []).length, 0));
  const averageCoveragePercent = Math.round(totalRequired / possibleRequired * 100);
  const evidenceCount = analysis.evidence.length;
  const regionCount = analysis.evidence.filter((row) => row.region).length;
  const averageRegionCoveragePercent = evidenceCount ? Math.round(regionCount / evidenceCount * 100) : 0;
  const ocrRequiredPages = coverage
    .filter((row) => row.ocrStatus === "required" && row.classification !== "Unclassified")
    .map((row) => row.page);
  const blockers = [
    ...(ocrRequiredPages.length ? [`${ocrRequiredPages.length} classified HVAC page${ocrRequiredPages.length === 1 ? "" : "s"} need OCR or visual confirmation.`] : []),
    ...(!analysis.summary.equipment ? ["No equipment tag was detected in searchable text."] : []),
    ...(!analysis.summary.airDevices ? ["No air-device reference was detected in searchable text."] : []),
    ...(!analysis.evidence.some((row) => row.category === "Airflow") ? ["No airflow text reference was detected in the source plan."] : []),
  ];
  const notices = [
    ...(averageRegionCoveragePercent < 100 ? ["Some evidence is page-linked without an exact text region."] : []),
    ...(relationships.length ? [`${relationships.length} cross-sheet relationship${relationships.length === 1 ? "" : "s"} await human confirmation.`] : []),
    "Evidence readiness is a review heuristic and never authorizes plan mutation by itself.",
  ];
  const readinessScore = Math.max(0, Math.min(100,
    averageCoveragePercent -
    ocrRequiredPages.length * 12 -
    blockers.length * 8 +
    Math.round(averageRegionCoveragePercent * .15)
  ));
  return {
    version: ADVANCED_PLAN_INTELLIGENCE_VERSION,
    sourceFingerprint: analysis.sourceFingerprint,
    coverage,
    relationships,
    ocrRequiredPages,
    averageCoveragePercent,
    averageRegionCoveragePercent,
    readinessScore,
    blockers,
    notices,
  };
}

export function comparePlanAnalysisSources(
  previous: PlanAnalysis | null | undefined,
  current: PlanAnalysis | null | undefined,
) {
  if (!previous || !current) {
    return { changed: Boolean(previous || current), added: 0, removed: 0, unchanged: 0 };
  }
  const evidenceKey = (row: PlanEvidence) => {
    const region = row.region
      ? `${row.region.x.toFixed(2)},${row.region.y.toFixed(2)},${row.region.width.toFixed(2)},${row.region.height.toFixed(2)}`
      : "page-only";
    return `${row.page}|${row.sheetNumber}|${row.category}|${row.label}|${row.value}|${region}`;
  };
  const counts = (rows: PlanEvidence[]) => rows.reduce((result, row) => {
    const key = evidenceKey(row);
    result.set(key, (result.get(key) || 0) + 1);
    return result;
  }, new Map<string, number>());
  const previousEvidence = counts(previous.evidence);
  const currentEvidence = counts(current.evidence);
  const keys = new Set([...previousEvidence.keys(), ...currentEvidence.keys()]);
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  keys.forEach((key) => {
    const before = previousEvidence.get(key) || 0;
    const after = currentEvidence.get(key) || 0;
    unchanged += Math.min(before, after);
    added += Math.max(0, after - before);
    removed += Math.max(0, before - after);
  });
  return {
    changed: previous.sourceFingerprint !== current.sourceFingerprint || added > 0 || removed > 0,
    added,
    removed,
    unchanged,
  };
}
