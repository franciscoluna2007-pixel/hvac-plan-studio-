export type PlanFindingSeverity = "critical" | "warning" | "info";

export type PlanFindingCategory =
  | "Connections"
  | "Airflow"
  | "Duct sizing"
  | "Return paths"
  | "Coordination";

export type PlanFindingIdentity = {
  id: string;
  ruleId: string;
  evidenceFingerprint: string;
};

export type PlanIntelligenceFinding = PlanFindingIdentity & {
  severity: PlanFindingSeverity;
  category: PlanFindingCategory;
  title: string;
  detail: string;
  drawingId?: string;
  reference: string;
  resolved: boolean;
  decisionStatus?: "accepted" | "rfi" | "punch" | "handled-elsewhere";
  decisionStale?: boolean;
};

export type PlanIntelligenceSummary = {
  score: number;
  total: number;
  open: number;
  resolved: number;
  critical: number;
  warnings: number;
  advisory: number;
  categories: Array<{
    category: PlanFindingCategory;
    total: number;
    open: number;
    critical: number;
  }>;
  headline: string;
  nextFinding?: PlanIntelligenceFinding;
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function findingRuleId(title: string) {
  return title
    .toLowerCase()
    .replace(/\b(supply|return|fresh-air)\b/g, "$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildFindingIdentity(input: {
  systemId: string;
  title: string;
  severity: PlanFindingSeverity;
  detail: string;
  drawingId?: string;
  instanceKey?: string;
}): PlanFindingIdentity {
  const ruleId = findingRuleId(input.title) || "coordination-review";
  const instance = [
    input.systemId,
    ruleId,
    input.drawingId || "system",
    input.instanceKey || "primary",
  ].join("|");
  const evidence = [
    input.systemId,
    ruleId,
    input.drawingId || "system",
    input.instanceKey || "primary",
    input.severity,
    input.detail,
  ].join("|");
  return {
    id: `review-${stableHash(instance)}`,
    ruleId,
    evidenceFingerprint: `evidence-${stableHash(evidence)}`,
  };
}

export function summarizePlanFindings(
  findings: PlanIntelligenceFinding[],
): PlanIntelligenceSummary {
  const severityOrder: Record<PlanFindingSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  const ordered = [...findings].sort((left, right) =>
    Number(left.resolved) - Number(right.resolved) ||
    severityOrder[left.severity] - severityOrder[right.severity] ||
    left.title.localeCompare(right.title)
  );
  const open = ordered.filter((finding) => !finding.resolved);
  const critical = open.filter((finding) => finding.severity === "critical").length;
  const warnings = open.filter((finding) => finding.severity === "warning").length;
  const advisory = open.filter((finding) => finding.severity === "info").length;
  const categoryOrder: PlanFindingCategory[] = [
    "Connections",
    "Airflow",
    "Duct sizing",
    "Return paths",
    "Coordination",
  ];
  const categories = categoryOrder.map((category) => {
    const rows = ordered.filter((finding) => finding.category === category);
    return {
      category,
      total: rows.length,
      open: rows.filter((finding) => !finding.resolved).length,
      critical: rows.filter((finding) => !finding.resolved && finding.severity === "critical").length,
    };
  });
  const score = Math.max(0, Math.min(100, 100 - critical * 18 - warnings * 7 - advisory * 2));
  const nextFinding = open[0];
  const headline = critical
    ? `${critical} critical drawing condition${critical === 1 ? "" : "s"} must be fixed`
    : warnings
      ? `${warnings} coordination warning${warnings === 1 ? "" : "s"} need review`
      : advisory
        ? `${advisory} advisory item${advisory === 1 ? "" : "s"} remain`
        : "Plan review is clear";
  return {
    score,
    total: ordered.length,
    open: open.length,
    resolved: ordered.length - open.length,
    critical,
    warnings,
    advisory,
    categories,
    headline,
    nextFinding,
  };
}

export function findingWhyItMatters(finding: PlanIntelligenceFinding) {
  if (finding.severity === "critical") {
    return "This condition blocks a controlled field release until the drawing itself is corrected.";
  }
  if (finding.category === "Connections") {
    return "A saved connection must match the physical endpoints so the field schedule and airflow network agree.";
  }
  if (finding.category === "Airflow") {
    return "Airflow evidence affects comfort, equipment delivery, room balance, and downstream sizing decisions.";
  }
  if (finding.category === "Duct sizing") {
    return "Velocity and pressure estimates help identify runs that need manual sizing or routing review.";
  }
  if (finding.category === "Return paths") {
    return "Return-air paths help prevent pressure-locked rooms and protect delivered supply airflow.";
  }
  return "This coordination item should be documented before fabrication or installation.";
}

export function findingRecommendedAction(finding: PlanIntelligenceFinding) {
  if (finding.severity === "critical") return "Show the object on the plan, correct the condition manually, then rerun review.";
  if (finding.category === "Connections") return "Inspect both endpoints and use the existing manual repair or reattach control.";
  if (finding.category === "Duct sizing") return "Review the evidence and apply only the individually approved sizing recommendation.";
  if (finding.category === "Return paths") return "Confirm the room return strategy and document any accepted field condition.";
  return "Open the review record to accept with a note, create an RFI, or add a punch item.";
}
