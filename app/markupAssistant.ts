import {
  findingRecommendedAction,
  findingWhyItMatters,
  summarizePlanFindings,
  type PlanFindingCategory,
  type PlanFindingSeverity,
  type PlanIntelligenceFinding,
} from "./planIntelligence";

export type MarkupRecommendationAction =
  | "focus"
  | "manual-review"
  | "branch-pass"
  | "sizing-review";

export type MarkupRecommendationPriority = "do-first" | "next" | "later";

export type MarkupRecommendation = {
  id: string;
  findingId?: string;
  drawingId?: string;
  evidenceFingerprint: string;
  severity: PlanFindingSeverity;
  category: PlanFindingCategory | "Branch strategy" | "Field details";
  title: string;
  detail: string;
  whyItMatters: string;
  proposedAction: string;
  action: MarkupRecommendationAction;
  confidence: number;
  evidence: string[];
  resolved: boolean;
  decisionStale?: boolean;
  priorityTier: MarkupRecommendationPriority;
  priorityScore: number;
  priorityReason: string;
  relatedDrawingIds: string[];
  preview?:
    | { kind: "drawing"; drawingId: string }
    | {
      kind: "branch-junction";
      point: { x: number; y: number };
      angle: number;
      branchAngle: number;
      side: 1 | -1;
      style: "wye45" | "tee90";
      mainRunId: string;
      branchRunId: string;
    };
};

export type MarkupAssistantSummary = {
  score: number;
  open: number;
  critical: number;
  warnings: number;
  sizingCandidates: number;
  branchOpportunities: number;
  doFirst: number;
  headline: string;
};

type BranchOpportunityEvidence = {
  id: string;
  center: { x: number; y: number };
  angle: number;
  branchAngle: number;
  side: 1 | -1;
  mainRunId: string;
  branchRunId: string;
  parentSize: string;
  style: "wye45" | "tee90";
  score: number;
};

function confidenceForFinding(finding: PlanIntelligenceFinding) {
  if (finding.category === "Connections") return 0.99;
  if (finding.category === "Duct sizing") return 0.94;
  if (finding.category === "Airflow") return 0.91;
  if (finding.category === "Return paths") return 0.86;
  return 0.82;
}

function actionForFinding(finding: PlanIntelligenceFinding): MarkupRecommendationAction {
  if (finding.category === "Duct sizing" || finding.category === "Airflow") return "sizing-review";
  if (finding.drawingId) return "focus";
  return "manual-review";
}

function priorityForFinding(finding: PlanIntelligenceFinding) {
  if (finding.resolved) {
    return {
      priorityTier: "later" as const,
      priorityScore: 0,
      priorityReason: "This item is already resolved.",
    };
  }
  if (finding.severity === "critical" || finding.category === "Connections") {
    return {
      priorityTier: "do-first" as const,
      priorityScore: finding.severity === "critical" ? 100 : 90,
      priorityReason: finding.category === "Connections"
        ? "Fix this first because downstream airflow and sizing depend on a connected system."
        : "Fix this first because it can block a reviewed plan release.",
    };
  }
  if (finding.severity === "warning" || ["Airflow", "Duct sizing", "Return paths"].includes(finding.category)) {
    return {
      priorityTier: "next" as const,
      priorityScore: finding.severity === "warning" ? 70 : 60,
      priorityReason: "Review this after connection blockers and before the field package.",
    };
  }
  return {
    priorityTier: "later" as const,
    priorityScore: 30,
    priorityReason: "This improves field clarity but does not block the next calculation step.",
  };
}

function proposedActionForFinding(finding: PlanIntelligenceFinding) {
  if (finding.category === "Connections") {
    return "Open Connect & repair, preview the exact endpoint or saved-port repair, then approve only the match you recognize.";
  }
  if (finding.category === "Return paths") {
    return "Confirm the return strategy: dedicated return, transfer grille, jump duct, documented door undercut, or an approved open circulation path. Draw only the option you choose.";
  }
  return findingRecommendedAction(finding);
}

export function buildMarkupRecommendations(input: {
  findings: PlanIntelligenceFinding[];
  branchOpportunities?: BranchOpportunityEvidence[];
  sizingCandidateCount?: number;
  sizingEvidenceFingerprint?: string;
  runNumberCandidateCount?: number;
  runNumberEvidenceFingerprint?: string;
  scaleVerified: boolean;
  designCfm: number;
}): MarkupRecommendation[] {
  const recommendations: MarkupRecommendation[] = input.findings.map((finding) => ({
    id: `assistant-${finding.id}`,
    findingId: finding.id,
    drawingId: finding.drawingId,
    evidenceFingerprint: finding.evidenceFingerprint,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    detail: finding.detail,
    whyItMatters: findingWhyItMatters(finding),
    proposedAction: proposedActionForFinding(finding),
    action: actionForFinding(finding),
    confidence: confidenceForFinding(finding),
    evidence: [
      finding.reference,
      finding.evidenceFingerprint.toUpperCase(),
      finding.drawingId ? "Plan object linked" : "System-level evidence",
    ],
    resolved: finding.resolved,
    decisionStale: finding.decisionStale,
    ...priorityForFinding(finding),
    relatedDrawingIds: finding.drawingId ? [finding.drawingId] : [],
    preview: finding.drawingId
      ? { kind: "drawing", drawingId: finding.drawingId }
      : undefined,
  }));

  const branchOpportunities = [...(input.branchOpportunities || [])]
    .sort((left, right) => left.score - right.score)
    .slice(0, 8);
  branchOpportunities.forEach((opportunity, index) => {
    const branchEvidenceFingerprint = [
      "branch",
      opportunity.id,
      opportunity.center.x.toFixed(2),
      opportunity.center.y.toFixed(2),
      opportunity.angle.toFixed(2),
      opportunity.branchAngle.toFixed(2),
      opportunity.side,
      opportunity.style,
      opportunity.parentSize,
      opportunity.mainRunId,
      opportunity.branchRunId,
    ].join("-");
    recommendations.push({
      id: `assistant-branch-${opportunity.id}`,
      drawingId: opportunity.mainRunId,
      evidenceFingerprint: branchEvidenceFingerprint,
      severity: "info",
      category: "Branch strategy",
      title: `T/Y junction opportunity ${index + 1}`,
      detail: `Two already-drawn supply runs align for a reviewable ${opportunity.style === "wye45" ? "45° wye" : "90° tee"} junction. No duct or fitting has been placed.`,
      whyItMatters: "Reviewing junctions after the runs are drawn preserves the trunk-first workflow and avoids invented branch stubs.",
      proposedAction: "Open the run-first branch pass, inspect the highlighted junction, and place only the fitting you approve.",
      action: "branch-pass",
      confidence: 0.88,
      evidence: [
        `${opportunity.parentSize}″ parent run`,
        "Two existing supply runs",
        "Endpoint and angle proximity",
      ],
      resolved: false,
      priorityTier: "later",
      priorityScore: 35,
      priorityReason: "Review branch fittings after the routes and required connections are complete.",
      relatedDrawingIds: [opportunity.mainRunId, opportunity.branchRunId],
      preview: {
        kind: "branch-junction",
        point: opportunity.center,
        angle: opportunity.angle,
        branchAngle: opportunity.branchAngle,
        side: opportunity.side,
        style: opportunity.style,
        mainRunId: opportunity.mainRunId,
        branchRunId: opportunity.branchRunId,
      },
    });
  });

  if ((input.sizingCandidateCount || 0) > 0 && !recommendations.some((row) => row.category === "Duct sizing")) {
    recommendations.push({
      id: "assistant-sizing-review",
      evidenceFingerprint: `sizing-${input.sizingEvidenceFingerprint || `${input.designCfm}-${input.sizingCandidateCount}`}-${input.scaleVerified ? "scaled" : "unscaled"}`,
      severity: "warning",
      category: "Duct sizing",
      title: `${input.sizingCandidateCount} duct size candidate${input.sizingCandidateCount === 1 ? "" : "s"} need review`,
      detail: `${input.designCfm || "No"} planning CFM is being screened against connected terminal airflow and the current velocity limits.`,
      whyItMatters: "A proposed diameter affects velocity, estimated pressure loss, sound, fitting progression, and available system capacity.",
      proposedAction: "Open the sizing review, inspect each current and proposed diameter, then apply only checked rows.",
      action: "sizing-review",
      confidence: input.scaleVerified ? 0.94 : 0.84,
      evidence: [
        "Connected airflow network",
        input.scaleVerified ? "Verified drawing scale" : "Scale not verified",
        "User-controlled velocity limits",
      ],
      resolved: false,
      priorityTier: "next",
      priorityScore: 65,
      priorityReason: "Review sizing after connections and terminal airflow are current.",
      relatedDrawingIds: [],
    });
  }

  if ((input.runNumberCandidateCount || 0) > 0) {
    recommendations.push({
      id: "assistant-run-details",
      evidenceFingerprint: `run-details-${input.runNumberEvidenceFingerprint || input.runNumberCandidateCount}`,
      severity: "warning",
      category: "Field details",
      title: `${input.runNumberCandidateCount} terminal run${input.runNumberCandidateCount === 1 ? "" : "s"} need field numbers`,
      detail: "The routes are drawn, but one or more proven terminal-linked supply or return legs still have a blank or duplicate field number.",
      whyItMatters: "Clear F/R numbers let one-person crews match the plan, run list, material package, and field installation without guessing.",
      proposedAction: "Preview the proposed blank-field labels, keep every existing number, and approve only the labels you want added.",
      action: "focus",
      confidence: 0.99,
      evidence: [
        "Terminal-linked routes only",
        "Existing run numbers preserved",
        "No trunk or unknown-role segment is auto-numbered",
      ],
      resolved: false,
      priorityTier: "next",
      priorityScore: 55,
      priorityReason: "Finish field labels after drawing and before materials or printing.",
      relatedDrawingIds: [],
    });
  }

  return recommendations.sort((left, right) =>
    Number(left.resolved) - Number(right.resolved) ||
    right.priorityScore - left.priorityScore ||
    left.title.localeCompare(right.title)
  );
}

export function summarizeMarkupAssistant(
  recommendations: MarkupRecommendation[],
  findings: PlanIntelligenceFinding[],
  sizingCandidates: number,
  branchOpportunities: number,
): MarkupAssistantSummary {
  const findingSummary = summarizePlanFindings(findings);
  const openRows = recommendations.filter((row) => !row.resolved);
  const critical = openRows.filter((row) => row.severity === "critical").length;
  const warnings = openRows.filter((row) => row.severity === "warning").length;
  const doFirst = openRows.filter((row) => row.priorityTier === "do-first").length;
  const headline = critical
    ? `${critical} condition${critical === 1 ? "" : "s"} must be fixed on the drawing before release`
    : warnings
      ? `${warnings} recommendation${warnings === 1 ? "" : "s"} need your review`
      : openRows.length
        ? `${openRows.length} advisory markup opportunit${openRows.length === 1 ? "y" : "ies"} ready`
        : "The marked system is clear";
  return {
    score: findingSummary.score,
    open: openRows.length,
    critical,
    warnings,
    sizingCandidates,
    branchOpportunities,
    doFirst,
    headline,
  };
}
