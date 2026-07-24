export type WorkflowStageId =
  | "runs"
  | "branches"
  | "connections"
  | "airflow"
  | "review"
  | "release";

export type WorkflowStageStatus = "complete" | "active" | "locked";

export type WorkflowStage = {
  id: WorkflowStageId;
  number: number;
  label: string;
  shortLabel: string;
  status: WorkflowStageStatus;
  detail: string;
  actionLabel: string;
};

export type WorkflowSummary = {
  version: 1;
  activeSystemId: string;
  stage: WorkflowStageId;
  progress: number;
  nextAction: string;
  updatedAt: string;
  systems: Array<{
    id: string;
    name: string;
    stage: string;
    progress: number;
    blockers: number;
    fieldReady: boolean;
  }>;
};

export type ProjectIntelligenceSummary = {
  health: "critical" | "attention" | "ready";
  score: number;
  headline: string;
  detail: string;
  action: "work" | "reviews" | "files" | "command";
  counts: {
    open: number;
    critical: number;
    blocked: number;
    pendingApprovals: number;
  };
};

type SystemWorkflowInput = {
  runs: number;
  fittings: number;
  devices: number;
  openConnections: number;
  brokenPorts: number;
  hasPrimaryUnit: boolean;
  airflowBalanced: boolean;
  sizingReviews: number;
  criticalIssues: number;
  warningIssues: number;
  releaseReady: boolean;
  released: boolean;
  releaseStale: boolean;
};

const definitions: Array<Omit<WorkflowStage, "status" | "detail">> = [
  { id: "runs", number: 1, label: "Draw runs", shortLabel: "Runs", actionLabel: "Continue drawing runs" },
  { id: "branches", number: 2, label: "Place T/Y fittings", shortLabel: "T/Y", actionLabel: "Open branch placement" },
  { id: "connections", number: 3, label: "Connect equipment & cans", shortLabel: "Connect", actionLabel: "Review connections" },
  { id: "airflow", number: 4, label: "Balance CFM & sizes", shortLabel: "Airflow", actionLabel: "Open airflow balancing" },
  { id: "review", number: 5, label: "Review the plan", shortLabel: "Review", actionLabel: "Open HVAC plan review" },
  { id: "release", number: 6, label: "Prepare field release", shortLabel: "Release", actionLabel: "Open field release" },
];

export function buildSystemWorkflow(input: SystemWorkflowInput) {
  const complete: Record<WorkflowStageId, boolean> = {
    runs: input.runs > 0,
    branches: input.runs > 0 && input.fittings > 0,
    connections:
      input.runs > 0 &&
      input.devices > 0 &&
      input.openConnections === 0 &&
      input.brokenPorts === 0,
    airflow:
      input.hasPrimaryUnit &&
      input.airflowBalanced &&
      input.sizingReviews === 0,
    review:
      input.runs > 0 &&
      input.criticalIssues === 0 &&
      input.warningIssues === 0,
    release: input.released && !input.releaseStale,
  };

  const activeIndex = Math.max(0, definitions.findIndex((stage) => !complete[stage.id]));
  const activeStage = definitions[activeIndex]?.id || "release";
  const stages: WorkflowStage[] = definitions.map((definition, index) => {
    const status: WorkflowStageStatus = complete[definition.id]
      ? "complete"
      : index === activeIndex
        ? "active"
        : "locked";
    const details: Record<WorkflowStageId, string> = {
      runs: input.runs
        ? `${input.runs} duct run${input.runs === 1 ? "" : "s"} drawn`
        : "Draw supply, return, or fresh-air runs first",
      branches: input.fittings
        ? `${input.fittings} fitting${input.fittings === 1 ? "" : "s"} placed`
        : "Split the finished runs with T/Y fittings",
      connections: input.openConnections || input.brokenPorts
        ? `${input.openConnections} open device${input.openConnections === 1 ? "" : "s"} · ${input.brokenPorts} broken port${input.brokenPorts === 1 ? "" : "s"}`
        : input.devices
          ? "All placed devices and saved fitting ports are connected"
          : "Place equipment, supply cans, and return cans",
      airflow: !input.hasPrimaryUnit
        ? "Place primary equipment to establish design airflow"
        : input.sizingReviews
          ? `${input.sizingReviews} duct size review${input.sizingReviews === 1 ? "" : "s"} waiting`
          : input.airflowBalanced
            ? "Supply and return airflow are balanced"
            : "Finish room CFM and return-air balance",
      review: input.criticalIssues || input.warningIssues
        ? `${input.criticalIssues} critical · ${input.warningIssues} warning`
        : input.runs
          ? "No open critical or warning findings"
          : "The plan review starts after ductwork is drawn",
      release: input.releaseStale
        ? "The issued field release is stale"
        : input.released
          ? "Named field revision issued"
          : input.releaseReady
            ? "All gates are clear for named approval"
            : "Clear the remaining field-release gates",
    };
    return { ...definition, status, detail: details[definition.id] };
  });

  const completed = stages.filter((stage) => stage.status === "complete").length;
  return {
    stages,
    activeStage,
    progress: input.released && !input.releaseStale
      ? 100
      : Math.round((completed + 0.35) / stages.length * 100),
    nextAction: stages.find((stage) => stage.status === "active")?.actionLabel || "Review completed system",
  };
}

export function normalizeWorkflowSummary(value: unknown): WorkflowSummary | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WorkflowSummary>;
  if (candidate.version !== 1 || typeof candidate.progress !== "number" || !candidate.stage) return null;
  return {
    version: 1,
    activeSystemId: candidate.activeSystemId || "system-1",
    stage: candidate.stage,
    progress: Math.max(0, Math.min(100, candidate.progress)),
    nextAction: candidate.nextAction || "Continue project",
    updatedAt: candidate.updatedAt || new Date(0).toISOString(),
    systems: Array.isArray(candidate.systems) ? candidate.systems : [],
  };
}

export function buildProjectIntelligenceSummary(input: {
  workflow: WorkflowSummary | null;
  workItems: Array<{ status: string; priority: string; title: string }>;
  approvals: Array<{ status: string }>;
  latestRevisionNumber: number;
  driveSyncedRevisionNumber: number;
}) {
  const openItems = input.workItems.filter((item) => !["resolved", "closed"].includes(item.status));
  const criticalItems = openItems.filter((item) => item.priority === "critical");
  const blockedItems = openItems.filter((item) => item.status === "blocked");
  const pendingApprovals = input.approvals.filter((approval) => approval.status === "requested");
  const requestedChanges = input.approvals.filter((approval) => approval.status === "changes_requested");
  const driveBehind = input.latestRevisionNumber > input.driveSyncedRevisionNumber;
  const workflowProgress = input.workflow?.progress || 0;
  const coordinationPenalty = Math.min(35,
    criticalItems.length * 12 +
    blockedItems.length * 6 +
    requestedChanges.length * 10 +
    pendingApprovals.length * 3 +
    (driveBehind ? 5 : 0));
  const score = Math.max(0, Math.min(100, workflowProgress - coordinationPenalty));

  const counts = {
    open: openItems.length,
    critical: criticalItems.length,
    blocked: blockedItems.length,
    pendingApprovals: pendingApprovals.length,
  };

  if (criticalItems.length) {
    return {
      health: "critical",
      score,
      headline: criticalItems[0].title,
      detail: `${criticalItems.length} critical coordination item${criticalItems.length === 1 ? "" : "s"} must be resolved before field release.`,
      action: "work",
      counts,
    } satisfies ProjectIntelligenceSummary;
  }
  if (requestedChanges.length) {
    return {
      health: "critical",
      score,
      headline: "Revision changes requested",
      detail: "Review the decision note, coordinate the drawing changes, and save a new named revision.",
      action: "reviews",
      counts,
    } satisfies ProjectIntelligenceSummary;
  }
  if (blockedItems.length) {
    return {
      health: "attention",
      score,
      headline: blockedItems[0].title,
      detail: `${blockedItems.length} blocked task${blockedItems.length === 1 ? "" : "s"} need coordination.`,
      action: "work",
      counts,
    } satisfies ProjectIntelligenceSummary;
  }
  if (pendingApprovals.length) {
    return {
      health: "attention",
      score,
      headline: `${pendingApprovals.length} revision approval${pendingApprovals.length === 1 ? "" : "s"} pending`,
      detail: "Approval is review-only and never changes drawing geometry.",
      action: "reviews",
      counts,
    } satisfies ProjectIntelligenceSummary;
  }
  if (driveBehind) {
    return {
      health: "attention",
      score,
      headline: `Google Drive is behind revision ${input.latestRevisionNumber}`,
      detail: "Sync the latest immutable cloud revision to restore a verified project package.",
      action: "files",
      counts,
    } satisfies ProjectIntelligenceSummary;
  }
  return {
    health: workflowProgress >= 100 ? "ready" : "attention",
    score,
    headline: input.workflow?.nextAction || "Save the first named revision",
    detail: input.workflow
      ? "Continue the next safe system step. Recommendations remain review-only."
      : "Create a named checkpoint to activate project intelligence.",
    action: "command",
    counts,
  } satisfies ProjectIntelligenceSummary;
}
