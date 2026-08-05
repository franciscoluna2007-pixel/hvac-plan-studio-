import type { FieldPackageSectionId } from "./fieldPackage";

export const FINISH_JOB_VERSION = "finish-job-v132.0";

export type FinishJobStepId =
  | "materials"
  | "holds"
  | "checklist"
  | "revision"
  | "print-share";

export type FinishJobGateId =
  | "materials"
  | "runs"
  | "critical"
  | "warning"
  | "connections"
  | "elevations"
  | "rooms"
  | "scale"
  | "checklist"
  | "rfi"
  | "punch"
  | "cloud"
  | string;

export type FinishJobGate = {
  id: FinishJobGateId;
  label: string;
  clear: boolean;
  detail: string;
};

export type FinishJobStep = {
  id: FinishJobStepId;
  label: string;
  detail: string;
  complete: boolean;
  waiting: boolean;
};

export type FinishJobModel = {
  steps: FinishJobStep[];
  currentStep: FinishJobStepId;
  technicalHolds: FinishJobGate[];
  cloudGate?: FinishJobGate;
  completedSteps: number;
  progress: number;
  jobReady: boolean;
  summary: string;
};

export type OutputSectionReadiness = Record<
  FieldPackageSectionId,
  { ready: boolean; detail: string }
>;

type BuildFinishJobInput = {
  materialRowCount: number;
  materialReviewCurrent: boolean;
  gates: FinishJobGate[];
  checklistComplete: number;
  checklistTotal: number;
  releaseCurrent: boolean;
  releaseStale: boolean;
  releaseRevision?: string;
};

const stepLabels: Record<FinishJobStepId, string> = {
  materials: "Review materials",
  holds: "Clear holds",
  checklist: "Complete field checklist",
  revision: "Name and issue revision",
  "print-share": "Print or share",
};

export function finishJobGateActionLabel(gateId: FinishJobGateId) {
  const actions: Record<string, string> = {
    materials: "Review materials",
    runs: "Start drawing runs",
    critical: "Open in Plan Check",
    warning: "Open in Plan Check",
    connections: "Fix the next connection",
    elevations: "Show the missing elevation",
    rooms: "Assign the missing room",
    scale: "Set the drawing scale",
    checklist: "Finish the checklist",
    rfi: "Review the field question",
    punch: "Review the punch item",
    cloud: "Open saved revisions",
  };
  return actions[gateId] || "Open this item";
}

export function buildFinishJobModel(input: BuildFinishJobInput): FinishJobModel {
  const materialComplete = input.materialRowCount > 0 && input.materialReviewCurrent;
  const technicalHolds = input.gates.filter(
    (gate) => !gate.clear && !["materials", "checklist", "cloud", "critical", "warning"].includes(gate.id),
  );
  const cloudGate = input.gates.find((gate) => gate.id === "cloud");
  const holdsComplete = technicalHolds.length === 0;
  const checklistDone = input.checklistTotal > 0 &&
    input.checklistComplete === input.checklistTotal;
  const releaseComplete = input.releaseCurrent && !input.releaseStale;
  const printReady = materialComplete && releaseComplete;

  const steps: FinishJobStep[] = [
    {
      id: "materials",
      label: stepLabels.materials,
      detail: input.materialRowCount === 0
        ? "Draw the system to build a material list"
        : input.materialReviewCurrent
          ? `${input.materialRowCount} current material item${input.materialRowCount === 1 ? "" : "s"} reviewed`
          : `Review ${input.materialRowCount} material item${input.materialRowCount === 1 ? "" : "s"}`,
      complete: materialComplete,
      waiting: false,
    },
    {
      id: "holds",
      label: stepLabels.holds,
      detail: technicalHolds.length
        ? `Clear ${technicalHolds.length} hold${technicalHolds.length === 1 ? "" : "s"}`
        : "Plan and coordination holds are clear",
      complete: holdsComplete,
      waiting: !materialComplete,
    },
    {
      id: "checklist",
      label: stepLabels.checklist,
      detail: checklistDone
        ? "Field checklist complete"
        : `Finish ${Math.max(0, input.checklistTotal - input.checklistComplete)} field check${input.checklistTotal - input.checklistComplete === 1 ? "" : "s"}`,
      complete: checklistDone,
      waiting: !materialComplete || !holdsComplete,
    },
    {
      id: "revision",
      label: stepLabels.revision,
      detail: releaseComplete
        ? `Revision ${input.releaseRevision || "reviewed"} is current`
        : input.releaseStale
          ? "The prior revision changed and must be issued again"
          : cloudGate && !cloudGate.clear
            ? cloudGate.detail
            : "Name and approve this exact revision",
      complete: releaseComplete,
      waiting: !materialComplete || !holdsComplete || !checklistDone,
    },
    {
      id: "print-share",
      label: stepLabels["print-share"],
      detail: printReady
        ? `Revision ${input.releaseRevision || "reviewed"} is ready to print or share`
        : "Available after the current revision is issued",
      complete: printReady,
      waiting: !releaseComplete,
    },
  ];

  const currentStep = (
    steps.find((step) => !step.complete && !step.waiting) ||
    steps.find((step) => !step.complete) ||
    steps.at(-1)!
  ).id;
  const completedSteps = steps.filter((step) => step.complete).length;
  const jobReady = printReady;
  const summary = jobReady
    ? `Revision ${input.releaseRevision || "reviewed"} is ready to print or share`
    : steps.find((step) => step.id === currentStep)?.detail || "Finish the job";

  return {
    steps,
    currentStep,
    technicalHolds,
    cloudGate,
    completedSteps,
    progress: Math.round(completedSteps / steps.length * 100),
    jobReady,
    summary,
  };
}

export function finishJobApprovalFingerprint(input: {
  systemId: string;
  sourceFingerprint: string;
  releaseSignature: string;
  materialFingerprint: string;
  materialReviewId: string;
  revision: string;
  reviewedBy: string;
  note: string;
}) {
  return JSON.stringify({
    version: FINISH_JOB_VERSION,
    systemId: input.systemId,
    sourceFingerprint: input.sourceFingerprint,
    releaseSignature: input.releaseSignature,
    materialFingerprint: input.materialFingerprint,
    materialReviewId: input.materialReviewId,
    revision: input.revision.trim(),
    reviewedBy: input.reviewedBy.trim(),
    note: input.note.trim(),
  });
}

export function buildOutputSectionReadiness(input: {
  releaseCurrent: boolean;
  materialReviewCurrent: boolean;
  commissioningReady: boolean;
  scaleVerified: boolean;
  hvacLayersVisible: boolean;
}): OutputSectionReadiness {
  const releaseDetail = input.releaseCurrent
    ? "Current issued revision"
    : "Issue the current revision first";
  return {
    plan: {
      ready: input.releaseCurrent && input.scaleVerified && input.hvacLayersVisible,
      detail: !input.releaseCurrent
        ? releaseDetail
        : !input.scaleVerified
          ? "The current sheet scale is not verified"
          : !input.hvacLayersVisible
            ? "Show every HVAC layer before final plan output"
            : "Current sheet and HVAC layers",
    },
    release: { ready: input.releaseCurrent, detail: releaseDetail },
    materials: {
      ready: input.releaseCurrent && input.materialReviewCurrent,
      detail: !input.releaseCurrent
        ? releaseDetail
        : input.materialReviewCurrent
          ? "Current reviewed quantities"
          : "Material quantities changed and need review",
    },
    airflow: { ready: input.releaseCurrent, detail: releaseDetail },
    review: { ready: input.releaseCurrent, detail: releaseDetail },
    coordination: { ready: input.releaseCurrent, detail: releaseDetail },
    startup: {
      ready: input.releaseCurrent && input.commissioningReady,
      detail: !input.releaseCurrent
        ? releaseDetail
        : input.commissioningReady
          ? "Current startup and commissioning record"
          : "Startup and commissioning are incomplete",
    },
  };
}

export function selectedOutputIsReady(
  sections: FieldPackageSectionId[],
  readiness: OutputSectionReadiness,
) {
  return sections.length > 0 &&
    sections.includes("release") &&
    sections.every((section) => readiness[section].ready);
}
