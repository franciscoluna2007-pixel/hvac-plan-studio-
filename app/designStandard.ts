export const DESIGN_STANDARD_ENGINE_VERSION = "design-standard-v116.0";
export const DESIGN_STANDARD_NAME = "My HVAC Rules";
export const DESIGN_STANDARD_PROFILE_VERSION = "1.0";

export type DesignStandardRuleLevel = "locked" | "calculated" | "recommended" | "project";
export type DesignStandardRuleStatus = "clear" | "review" | "blocked" | "not-evaluated";

export type DesignStandardRule = {
  id: string;
  level: DesignStandardRuleLevel;
  title: string;
  standard: string;
  status: DesignStandardRuleStatus;
  finding: string;
  action: string;
  evidence: string[];
  drawingIds: string[];
  overrideAllowed: boolean;
};

export type DesignStandardProfile = {
  engineVersion: string;
  name: string;
  profileVersion: string;
  systemId: string;
  evidenceFingerprint: string;
  score: number;
  clear: number;
  review: number;
  blocked: number;
  rules: DesignStandardRule[];
  nonClaims: string[];
};

export type BuildDesignStandardInput = {
  systemId: string;
  evidenceFingerprint: string;
  runs: Array<{
    id: string;
    type: "supply" | "return" | "fresh";
    size: string;
    runNumber?: string;
    sizeReviewed?: boolean;
    terminalLinked?: boolean;
    roomName?: string;
    roomType?: "general" | "bedroom" | "bathroom" | "closet";
  }>;
  terminals: Array<{
    id: string;
    kind: "diffuser" | "returnGrille";
    roomName?: string;
    roomType?: "general" | "bedroom" | "bathroom" | "closet";
    connected: boolean;
  }>;
  tyFittingIds: string[];
  motorDamperIds: string[];
  residentialFlexMax: string;
  projectOverrides?: Partial<Record<string, string>>;
};

function normalizeRoom(value = "") {
  return value.trim().toLocaleLowerCase();
}

function asNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rule(
  input: Omit<DesignStandardRule, "drawingIds" | "overrideAllowed"> &
  Partial<Pick<DesignStandardRule, "drawingIds" | "overrideAllowed">>,
): DesignStandardRule {
  return {
    ...input,
    drawingIds: [...(input.drawingIds || [])],
    overrideAllowed: input.overrideAllowed ?? input.level !== "locked",
  };
}

export function buildDesignStandardProfile(input: BuildDesignStandardInput): DesignStandardProfile {
  const oversized = input.runs.filter((run) => asNumber(run.size) > 16);
  const unreviewedLabels = input.runs.filter((run) =>
    !run.size.trim() ||
    (run.type !== "fresh" && (
      run.sizeReviewed !== true ||
      (run.terminalLinked && !run.runNumber?.trim())
    ))
  );
  const freshRuns = input.runs.filter((run) => run.type === "fresh");
  const supplyRuns = input.runs.filter((run) => run.type === "supply");
  const bedroomSupplies = input.terminals.filter((terminal) =>
    terminal.kind === "diffuser" &&
    terminal.roomType === "bedroom" &&
    normalizeRoom(terminal.roomName)
  );
  const bedroomReturns = new Set(input.terminals
    .filter((terminal) =>
      terminal.kind === "returnGrille" &&
      terminal.connected &&
      normalizeRoom(terminal.roomName)
    )
    .map((terminal) => normalizeRoom(terminal.roomName)));
  const bedroomsWithoutReturn = bedroomSupplies.filter((terminal) =>
    !bedroomReturns.has(normalizeRoom(terminal.roomName))
  );
  const disconnectedTerminals = input.terminals.filter((terminal) => !terminal.connected);
  const preferredTyMinimum = Math.max(0, Math.ceil((supplyRuns.length - 2) / 3));
  const maxSetting = asNumber(input.residentialFlexMax);
  const overrides = input.projectOverrides || {};

  const rules: DesignStandardRule[] = [
    rule({
      id: "residential-flex-limit",
      level: "locked",
      title: "Residential flex stays at 16 inches or below",
      standard: "Never recommend or apply residential flex larger than 16 inches.",
      status: oversized.length || maxSetting > 16 ? "blocked" : "clear",
      finding: oversized.length
        ? `${oversized.length} run${oversized.length === 1 ? "" : "s"} exceed the 16-inch residential-flex ceiling.`
        : maxSetting > 16
          ? `The project flex ceiling is set to ${input.residentialFlexMax} inches.`
          : "All marked residential flex and the project ceiling remain within the locked limit.",
      action: "Resize through reviewed airflow and pressure evidence, or use a documented parallel-path or hard-duct solution.",
      evidence: [
        `${input.runs.length} marked duct runs`,
        `${input.residentialFlexMax || "unset"}-inch project flex ceiling`,
        DESIGN_STANDARD_ENGINE_VERSION,
      ],
      drawingIds: oversized.map((run) => run.id),
      overrideAllowed: false,
    }),
    rule({
      id: "connected-terminal-paths",
      level: "locked",
      title: "Every terminal keeps a connected system path",
      standard: "Do not release disconnected supplies or returns, and never bridge separate systems.",
      status: disconnectedTerminals.length ? "blocked" : "clear",
      finding: disconnectedTerminals.length
        ? `${disconnectedTerminals.length} terminal${disconnectedTerminals.length === 1 ? "" : "s"} do not have a connected run.`
        : "Every marked terminal in this system has a connected run.",
      action: "Show each disconnected terminal on plan and repair its system-specific path before release.",
      evidence: [
        `${input.terminals.length} terminals reviewed`,
        `${disconnectedTerminals.length} disconnected`,
        `System ${input.systemId}`,
      ],
      drawingIds: disconnectedTerminals.map((terminal) => terminal.id),
      overrideAllowed: false,
    }),
    rule({
      id: "reviewed-sizing",
      level: "calculated",
      title: "Sizing follows reviewed airflow",
      standard: "Use reviewed CFM, velocity, capacity, and pressure inputs; never infer airflow from diameter.",
      status: input.runs.length ? "review" : "not-evaluated",
      finding: input.runs.length
        ? `${input.runs.length} run${input.runs.length === 1 ? "" : "s"} remain subject to the Sizing and Guided Repair evidence gates.`
        : "Add connected runs before evaluating sizing.",
      action: "Keep size changes in Guided Repair with the current calculation fingerprint and reviewer acknowledgement.",
      evidence: [
        "Connected-network airflow propagation",
        "Velocity and capacity screen",
        "Explicit pressure-evidence boundary",
      ],
    }),
    rule({
      id: "field-readable-run-labels",
      level: "recommended",
      title: "Every run has a field-readable number and size",
      standard: "After routing, place a readable run number and reviewed size beside each supply and return; keep fresh-air sizes visible.",
      status: unreviewedLabels.length ? "review" : input.runs.length ? "clear" : "not-evaluated",
      finding: unreviewedLabels.length
        ? `${unreviewedLabels.length} run${unreviewedLabels.length === 1 ? "" : "s"} need a number or reviewed size.`
        : input.runs.length
          ? "Every marked run has its required field-readable detail."
          : "No runs are available to evaluate.",
      action: "Use the post-draw detail pass to add the missing number or confirm the size without changing route geometry.",
      evidence: [`${input.runs.length - unreviewedLabels.length} of ${input.runs.length} runs detailed`],
      drawingIds: unreviewedLabels.map((run) => run.id),
    }),
    rule({
      id: "bedroom-return-path",
      level: "recommended",
      title: "Bedrooms have a visible return-air path",
      standard: "Review closed-door bedrooms for a dedicated return, transfer path, or documented undercut strategy.",
      status: bedroomsWithoutReturn.length ? "review" : bedroomSupplies.length ? "clear" : "not-evaluated",
      finding: bedroomsWithoutReturn.length
        ? `${bedroomsWithoutReturn.length} supplied bedroom${bedroomsWithoutReturn.length === 1 ? "" : "s"} have no connected same-room return path.`
        : bedroomSupplies.length
          ? "Every supplied bedroom has a connected same-room return path."
          : "No supplied bedrooms with room assignments are available to evaluate.",
      action: "Inspect the room boundary and document a dedicated or transfer return path; do not place one automatically.",
      evidence: [
        `${bedroomSupplies.length} supplied bedrooms`,
        `${bedroomReturns.size} bedroom return locations`,
        "Room names and room types from marked objects",
      ],
      drawingIds: bedroomsWithoutReturn.map((terminal) => terminal.id),
    }),
    rule({
      id: "reviewed-ty-strategy",
      level: "recommended",
      title: "Use practical T/Y branch points",
      standard: "Carry the trunk deep, branch backward, and prefer reviewable T/Y fittings over ambiguous line crossings.",
      status: supplyRuns.length < 4
        ? "not-evaluated"
        : input.tyFittingIds.length < preferredTyMinimum
          ? "review"
          : "clear",
      finding: supplyRuns.length < 4
        ? "The marked supply network is too small for a meaningful branch-strategy screen."
        : input.tyFittingIds.length < preferredTyMinimum
          ? `${input.tyFittingIds.length} confirmed T/Y fitting${input.tyFittingIds.length === 1 ? "" : "s"} serve ${supplyRuns.length} supply runs; review branch clarity.`
          : `${input.tyFittingIds.length} confirmed T/Y fittings provide a visible branch strategy.`,
      action: "Use the branch pass to inspect existing run intersections and confirm only the T/Y fittings that belong on plan.",
      evidence: [
        `${supplyRuns.length} supply runs`,
        `${input.tyFittingIds.length} confirmed T/Y fittings`,
        "Existing geometry only; no invented branch stubs",
      ],
      drawingIds: input.tyFittingIds,
    }),
    rule({
      id: "fresh-air-control",
      level: "recommended",
      title: "Fresh air shows its control point",
      standard: "Identify the outside-air path and its motorized damper clearly.",
      status: freshRuns.length && !input.motorDamperIds.length
        ? "review"
        : freshRuns.length
          ? "clear"
          : "not-evaluated",
      finding: freshRuns.length && !input.motorDamperIds.length
        ? "A fresh-air run is marked without a motorized outside-air damper."
        : freshRuns.length
          ? "The marked fresh-air path includes a motorized damper."
          : "No fresh-air run is marked for this system.",
      action: "Confirm the control location and add the correct OA damper symbol only after plan review.",
      evidence: [
        `${freshRuns.length} fresh-air runs`,
        `${input.motorDamperIds.length} motorized dampers`,
      ],
      drawingIds: freshRuns.length && !input.motorDamperIds.length
        ? freshRuns.map((run) => run.id)
        : input.motorDamperIds,
    }),
  ].map((row) => overrides[row.id]
    ? {
      ...row,
      level: "project" as const,
      finding: `Project override: ${overrides[row.id]}`,
      status: row.status === "blocked" ? row.status : "review" as const,
      evidence: [...row.evidence, "Project-only exception; My HVAC Rules is unchanged"],
    }
    : row);

  const blocked = rules.filter((row) => row.status === "blocked").length;
  const review = rules.filter((row) => row.status === "review").length;
  const clear = rules.filter((row) => row.status === "clear").length;
  const evaluated = blocked + review + clear;
  const score = evaluated ? Math.max(0, Math.round(100 - blocked * 25 - review * 8)) : 0;

  return {
    engineVersion: DESIGN_STANDARD_ENGINE_VERSION,
    name: DESIGN_STANDARD_NAME,
    profileVersion: DESIGN_STANDARD_PROFILE_VERSION,
    systemId: input.systemId,
    evidenceFingerprint: input.evidenceFingerprint,
    score,
    clear,
    review,
    blocked,
    rules,
    nonClaims: [
      "My HVAC Rules is a drafting and review profile, not an automatic HVAC design approval.",
      "Geometry, airflow, pressure, equipment, code, and field conditions remain separately reviewable evidence.",
      "Project overrides never rewrite the shared standard unless an authorized person publishes a new profile version.",
    ],
  };
}
