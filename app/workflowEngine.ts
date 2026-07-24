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
