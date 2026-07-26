export type BalanceRunType = "supply" | "return" | "fresh";

export type BalanceRules = {
  supplyVelocityLimit: number;
  returnVelocityLimit: number;
  freshVelocityLimit: number;
  residentialFlexMax: string;
};

export type BalanceRunReview = {
  id: string;
  type: BalanceRunType;
  room: string;
  currentSize: string;
  recommendedSize: string;
  cfm: number;
  currentVelocity: number;
  recommendedVelocity: number;
  velocityLimit: number;
  classification: "planning-estimate" | "pressure-screened" | "imported-professional" | "field-verified";
  sizingStatus: "pass" | "review" | "blocked" | "unknown";
  applyEligible: boolean;
  reasonCodes: string[];
  alternatives: Array<{
    pathCount: number;
    diameterInches: number;
    airflowPerPathCfm: number;
    velocityPerPathFpm: number;
  }>;
  physicalLength: number;
  equivalentLength: number;
  equivalentLengthPerBend: number;
  frictionRate: number;
  pressureDrop: number;
  pressureAssumption: string;
  airflowSource: "terminal-linked" | "manual" | "estimated";
  airflowReviewed: boolean;
  airflowEvidence: string[];
  overCapacity: boolean;
};

export type BalanceRoomReview = {
  name: string;
  type: string;
  supplyTarget: number;
  supplyScheduled: number;
  returnTarget: number;
  returnScheduled: number;
  diffusers: number;
  returns: number;
  connectedDevices: number;
  deviceCount: number;
  missingCfm: number;
  needsReturn: boolean;
  drawingIds: string[];
};

export type BalanceNetworkReview = {
  unitId: string;
  unitLabel: string;
  rootRunId?: string;
  designCfm: number;
  assignedCfm: number;
  remainingCfm: number;
  returnCfm: number;
  percent: number;
  runCount: number;
  fittingCount: number;
  terminalCount: number;
  problemCount: number;
  firstProblemDrawingId?: string;
  balanced: boolean;
};

export type BalanceCfmProposal = {
  id: string;
  drawingId: string;
  kind: "supply" | "return";
  room: string;
  label: string;
  current: number;
  proposed: number;
  connected: boolean;
};

export type BalanceReviewRecord = {
  id: string;
  systemId: string;
  reviewer: string;
  note: string;
  createdAt: string;
  evidenceFingerprint: string;
  score: number;
  designCfm: number;
  supplyCfm: number;
  returnCfm: number;
  openSizeRecommendations: number;
  openCfmRecommendations: number;
  connectionProblems: number;
};

export type SystemBalanceModel = {
  systemId: string;
  systemName: string;
  calculationVersion: string;
  ductSizingVersion: string;
  evidenceFingerprint: string;
  designCfm: number;
  supplyCfm: number;
  returnCfm: number;
  connectedSupplyCfm: number;
  connectedReturnCfm: number;
  connectedSupplyTerminals: number;
  connectedReturnTerminals: number;
  supplyTerminalCount: number;
  returnTerminalCount: number;
  totalRunCount: number;
  scaleVerified: boolean;
  airflowTargetSource: "missing" | "planning-seed" | "user-entered" | "mixed";
  planningSeedTerminalCount: number;
  missingTerminalCfm: number;
  roomTargetSource: "draft-allocation" | "saved-targets";
  rules: BalanceRules;
  runs: BalanceRunReview[];
  rooms: BalanceRoomReview[];
  networks: BalanceNetworkReview[];
  cfmProposals: BalanceCfmProposal[];
  reviews: BalanceReviewRecord[];
};

export type SystemBalanceSummary = {
  score: number;
  tone: "clear" | "attention" | "hold";
  headline: string;
  supplyGap: number;
  returnGap: number;
  supplyPercent: number;
  returnPercent: number;
  connectionProblems: number;
  unresolvedNetworks: number;
  missingRootNetworks: number;
  disconnectedDevices: number;
  overCapacityRuns: number;
  missingReturnRooms: number;
  pressureUnverified: boolean;
  planningEstimate: boolean;
  draftRoomTargets: boolean;
  latestReview?: BalanceReviewRecord;
  reviewStale: boolean;
};

export const BALANCE_CALCULATION_VERSION = "system-balance-v112.0";

function percent(value: number, total: number) {
  return total > 0 ? Math.round(value / total * 100) : 0;
}

export function summarizeSystemBalance(model: SystemBalanceModel): SystemBalanceSummary {
  const supplyGap = model.designCfm - model.supplyCfm;
  const returnGap = model.designCfm - model.returnCfm;
  const connectionProblems = model.networks.reduce((total, row) => total + row.problemCount, 0);
  const unresolvedNetworks = model.networks.filter((row) => !row.balanced).length;
  const missingRootNetworks = model.networks.filter((row) => !row.rootRunId).length;
  const disconnectedDevices =
    Math.max(0, model.supplyTerminalCount - model.connectedSupplyTerminals) +
    Math.max(0, model.returnTerminalCount - model.connectedReturnTerminals);
  const overCapacityRuns = model.runs.filter((run) => run.overCapacity).length;
  const missingReturnRooms = model.rooms.filter((room) => room.needsReturn).length;
  const pressureUnverified = model.runs.some((run) => run.classification === "planning-estimate");
  const planningEstimate = model.airflowTargetSource !== "user-entered";
  const draftRoomTargets = model.roomTargetSource === "draft-allocation";
  const supplyVariance = model.designCfm ? Math.abs(supplyGap) / model.designCfm : 1;
  const returnVariance = model.designCfm ? Math.abs(returnGap) / model.designCfm : 1;
  let score = 100;
  if (!model.designCfm) score -= 35;
  score -= Math.min(24, Math.round(supplyVariance * 60));
  score -= Math.min(18, Math.round(returnVariance * 40));
  score -= Math.min(20, connectionProblems * 4);
  score -= Math.min(18, unresolvedNetworks * 6);
  score -= Math.min(15, disconnectedDevices * 3);
  score -= Math.min(15, overCapacityRuns * 5);
  score -= Math.min(12, missingReturnRooms * 4);
  score -= Math.min(15, model.planningSeedTerminalCount * 2);
  score -= Math.min(15, model.missingTerminalCfm * 4);
  if (planningEstimate) score = Math.min(score, 79);
  if (draftRoomTargets && model.rooms.length) score -= 5;
  score = Math.max(0, Math.min(100, score));
  const latestReview = [...model.reviews]
    .filter((review) => review.systemId === model.systemId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const reviewStale = Boolean(latestReview && latestReview.evidenceFingerprint !== model.evidenceFingerprint);
  const hold =
    !model.designCfm ||
    unresolvedNetworks > 0 ||
    connectionProblems > 0 ||
    disconnectedDevices > 0 ||
    overCapacityRuns > 0 ||
    model.missingTerminalCfm > 0;
  const attention =
    hold ||
    planningEstimate ||
    model.planningSeedTerminalCount > 0 ||
    draftRoomTargets ||
    model.cfmProposals.length > 0 ||
    model.runs.length > 0 ||
    pressureUnverified ||
    supplyVariance > .1 ||
    returnVariance > .1 ||
    missingReturnRooms > 0;
  const tone = hold ? "hold" : attention ? "attention" : "clear";
  let headline = model.totalRunCount ? "Ready for a named balance review" : "Draw and connect runs to begin";
  if (!model.designCfm) headline = "Set equipment airflow before sizing";
  else if (missingRootNetworks) headline = "Connect each equipment supply plenum";
  else if (connectionProblems) headline = "Repair the connected network first";
  else if (unresolvedNetworks) headline = "Reconcile each equipment network";
  else if (disconnectedDevices) headline = "Connect every scheduled air device";
  else if (overCapacityRuns) headline = "Add capacity before accepting sizes";
  else if (model.missingTerminalCfm) headline = "Enter CFM for every scheduled terminal";
  else if (planningEstimate) headline = "Verify the planning airflow target";
  else if (model.planningSeedTerminalCount) headline = "Replace planning-seed terminal CFM";
  else if (draftRoomTargets && model.rooms.length) headline = "Review and save the draft room targets";
  else if (model.cfmProposals.length) headline = "Review the room CFM candidates";
  else if (model.runs.length) headline = "Review the velocity-screened size candidates";
  else if (pressureUnverified) headline = "Review velocity previews and pressure assumptions";
  else if (supplyVariance > .1) headline = "Reconcile scheduled supply airflow";
  else if (returnVariance > .1) headline = "Review system return airflow";
  else if (missingReturnRooms) headline = "Review bedroom return paths";
  return {
    score,
    tone,
    headline,
    supplyGap,
    returnGap,
    supplyPercent: percent(model.supplyCfm, model.designCfm),
    returnPercent: percent(model.returnCfm, model.designCfm),
    connectionProblems,
    unresolvedNetworks,
    missingRootNetworks,
    disconnectedDevices,
    overCapacityRuns,
    missingReturnRooms,
    pressureUnverified,
    planningEstimate,
    draftRoomTargets,
    latestReview,
    reviewStale,
  };
}
