export const DUCT_SIZING_CALCULATION_VERSION = "duct-sizing-v112.0";

export const SUPPORTED_RESIDENTIAL_FLEX_DIAMETERS = [
  4, 6, 7, 8, 10, 12, 14, 16,
] as const;

export type DuctSizingClassification =
  | "planning-estimate"
  | "pressure-screened"
  | "imported-professional"
  | "field-verified";

export type DuctSizingStatus = "pass" | "review" | "blocked" | "unknown";

export type SizingAirflowSource =
  | "imported-design"
  | "manual"
  | "room-target"
  | "terminal-linked"
  | "planning-seed"
  | "missing";

export type ParallelFlexAlternative = {
  pathCount: number;
  diameterInches: number;
  airflowPerPathCfm: number;
  velocityPerPathFpm: number;
};

export type FlexibleDuctRecommendation = {
  calculationVersion: typeof DUCT_SIZING_CALCULATION_VERSION;
  classification: "planning-estimate";
  status: Exclude<DuctSizingStatus, "unknown">;
  cfm: number;
  airflowSource: SizingAirflowSource;
  velocityLimitFpm: number;
  maxDiameterInches: number;
  recommendedDiameterInches: number;
  recommendedVelocityFpm: number;
  overCapacity: boolean;
  applyEligible: boolean;
  reasonCodes: string[];
  alternatives: ParallelFlexAlternative[];
};

export type PressureBasisInput = {
  externalStaticPressureInWg: number;
  componentLossesInWg: readonly number[];
  totalEffectiveLengthFeet: number;
};

export type PressureBasisResult = {
  classification: "pressure-screened";
  status: "pass" | "blocked";
  externalStaticPressureInWg: number;
  componentLossInWg: number;
  availableStaticPressureInWg: number;
  totalEffectiveLengthFeet: number;
  designFrictionRateInWgPer100Ft?: number;
  reason?: string;
};

export type SegmentPressureEstimate = {
  classification: "planning-estimate";
  physicalLengthFeet: number;
  bendCount: number;
  equivalentLengthPerBendFeet: number;
  equivalentLengthFeet: number;
  frictionRateInWgPer100Ft: number;
  pressureDropInWg: number;
  assumptionNotice: string;
};

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function validDiameter(value: number | string) {
  const diameter = Number(value);
  return Number.isFinite(diameter) && diameter > 0 ? diameter : 0;
}

export function planningAirflowCfm(tons: number, cfmPerTon = 400) {
  return Math.round(nonNegative(tons) * nonNegative(cfmPerTon));
}

export function roundDuctAreaSquareFeet(diameterInches: number | string) {
  const diameterFeet = validDiameter(diameterInches) / 12;
  return Math.PI * diameterFeet * diameterFeet / 4;
}

export const roundAreaFt2 = roundDuctAreaSquareFeet;

export function rectangularAreaFt2(widthInches: number, heightInches: number) {
  return nonNegative(widthInches) * nonNegative(heightInches) / 144;
}

export function roundDuctVelocityFpm(diameterInches: number | string, cfm: number) {
  const area = roundDuctAreaSquareFeet(diameterInches);
  return area > 0 ? nonNegative(cfm) / area : 0;
}

export const roundVelocityFpm = roundDuctVelocityFpm;

export function roundDuctVelocityCapacity(diameterInches: number | string, velocityFpm: number) {
  return roundDuctAreaSquareFeet(diameterInches) * nonNegative(velocityFpm);
}

export const roundCapacityCfm = roundDuctVelocityCapacity;

export function estimateFlexFrictionRate(
  diameterInches: number | string,
  cfm: number,
  installationMultiplier = 1.5,
) {
  const diameter = validDiameter(diameterInches);
  const airflow = nonNegative(cfm);
  if (!diameter || !airflow) return 0;
  return 0.109136 * Math.pow(airflow, 1.9) / Math.pow(diameter, 5.02) * nonNegative(installationMultiplier);
}

export function equivalentLengthFeet(
  physicalLengthFeet: number,
  bendCount: number,
  equivalentLengthPerBendFeet = 8,
) {
  return nonNegative(physicalLengthFeet) +
    Math.floor(nonNegative(bendCount)) * nonNegative(equivalentLengthPerBendFeet);
}

export function pressureDropInWg(
  frictionRateInWgPer100Ft: number,
  physicalLengthFeet: number,
  additionalEquivalentLengthFeet = 0,
) {
  return nonNegative(frictionRateInWgPer100Ft) *
    (nonNegative(physicalLengthFeet) + nonNegative(additionalEquivalentLengthFeet)) / 100;
}

export function estimateRunPressureDrop(input: {
  diameterInches: number | string;
  cfm: number;
  physicalLengthFeet: number;
  bendCount: number;
  installationMultiplier?: number;
  equivalentLengthPerBendFeet?: number;
}): SegmentPressureEstimate {
  const physicalLength = nonNegative(input.physicalLengthFeet);
  const bends = Math.floor(nonNegative(input.bendCount));
  const bendAllowance = nonNegative(input.equivalentLengthPerBendFeet ?? 8);
  const totalEquivalentLength = equivalentLengthFeet(physicalLength, bends, bendAllowance);
  const frictionRate = estimateFlexFrictionRate(
    input.diameterInches,
    input.cfm,
    input.installationMultiplier ?? 1.5,
  );
  return {
    classification: "planning-estimate",
    physicalLengthFeet: physicalLength,
    bendCount: bends,
    equivalentLengthPerBendFeet: bendAllowance,
    equivalentLengthFeet: totalEquivalentLength,
    frictionRateInWgPer100Ft: frictionRate,
    pressureDropInWg: pressureDropInWg(frictionRate, totalEquivalentLength),
    assumptionNotice: "Rough flex estimate using a 1.5× installation multiplier and 8 equivalent feet per drawn bend; not a pressure verification.",
  };
}

export function calculatePressureBasis(input?: PressureBasisInput): PressureBasisResult | {
  classification: "pressure-screened";
  status: "unknown";
  reason: string;
} {
  if (!input) {
    return {
      classification: "pressure-screened",
      status: "unknown",
      reason: "External static pressure, component losses, and total effective length are required.",
    };
  }
  const externalStaticPressure = nonNegative(input.externalStaticPressureInWg);
  const componentLoss = input.componentLossesInWg.reduce((total, loss) => total + nonNegative(loss), 0);
  const totalEffectiveLength = nonNegative(input.totalEffectiveLengthFeet);
  const availableStaticPressure = externalStaticPressure - componentLoss;
  if (availableStaticPressure <= 0) {
    return {
      classification: "pressure-screened",
      status: "blocked",
      externalStaticPressureInWg: externalStaticPressure,
      componentLossInWg: componentLoss,
      availableStaticPressureInWg: availableStaticPressure,
      totalEffectiveLengthFeet: totalEffectiveLength,
      reason: "Component losses consume all available external static pressure.",
    };
  }
  if (!totalEffectiveLength) {
    return {
      classification: "pressure-screened",
      status: "blocked",
      externalStaticPressureInWg: externalStaticPressure,
      componentLossInWg: componentLoss,
      availableStaticPressureInWg: availableStaticPressure,
      totalEffectiveLengthFeet: totalEffectiveLength,
      reason: "Total effective length must be greater than zero.",
    };
  }
  return {
    classification: "pressure-screened",
    status: "pass",
    externalStaticPressureInWg: externalStaticPressure,
    componentLossInWg: componentLoss,
    availableStaticPressureInWg: availableStaticPressure,
    totalEffectiveLengthFeet: totalEffectiveLength,
    designFrictionRateInWgPer100Ft: availableStaticPressure * 100 / totalEffectiveLength,
  };
}

export function parallelFlexAlternatives(input: {
  cfm: number;
  velocityLimitFpm: number;
  maxDiameterInches?: number | string;
  maximumPaths?: number;
}) {
  const maxDiameter = Math.min(16, validDiameter(input.maxDiameterInches ?? 16) || 16);
  const capacityPerPath = roundDuctVelocityCapacity(maxDiameter, input.velocityLimitFpm);
  const airflow = nonNegative(input.cfm);
  const minimumPathCount = capacityPerPath > 0 ? Math.max(2, Math.ceil(airflow / capacityPerPath)) : 0;
  const maximumPaths = Math.max(2, Math.floor(nonNegative(input.maximumPaths ?? 6)));
  if (!minimumPathCount || minimumPathCount > maximumPaths) return [];
  return Array.from({ length: maximumPaths - minimumPathCount + 1 }, (_, index) => {
    const pathCount = minimumPathCount + index;
    const airflowPerPathCfm = airflow / pathCount;
    return {
      pathCount,
      diameterInches: maxDiameter,
      airflowPerPathCfm,
      velocityPerPathFpm: roundDuctVelocityFpm(maxDiameter, airflowPerPathCfm),
    };
  });
}

export function recommendFlexibleDuctSize(input: {
  cfm: number;
  airflowSource: SizingAirflowSource;
  velocityLimitFpm: number;
  maxDiameterInches?: number | string;
}): FlexibleDuctRecommendation {
  const airflow = nonNegative(input.cfm);
  const velocityLimit = nonNegative(input.velocityLimitFpm);
  const requestedMaximum = validDiameter(input.maxDiameterInches ?? 16) || 16;
  const maximum = Math.min(16, requestedMaximum);
  const sizes = SUPPORTED_RESIDENTIAL_FLEX_DIAMETERS.filter((diameter) => diameter <= maximum);
  const maximumDiameter = sizes.at(-1) ?? 16;
  const recommendedDiameter = sizes.find((diameter) =>
    roundDuctVelocityFpm(diameter, airflow) <= velocityLimit
  ) ?? maximumDiameter;
  const recommendedVelocity = roundDuctVelocityFpm(recommendedDiameter, airflow);
  const overCapacity = !airflow || !velocityLimit || recommendedVelocity > velocityLimit;
  const airflowApplyEligible = !["missing", "planning-seed"].includes(input.airflowSource);
  const reasonCodes = [
    ...(!airflow ? ["AIRFLOW_MISSING"] : []),
    ...(input.airflowSource === "planning-seed" ? ["AIRFLOW_PLANNING_SEED"] : []),
    ...(recommendedVelocity > velocityLimit ? ["NO_COMPLIANT_FLEX_SIZE"] : []),
    ...(requestedMaximum > 16 ? ["MAX_FLEX_16"] : []),
    "PRESSURE_EVIDENCE_MISSING",
  ];
  return {
    calculationVersion: DUCT_SIZING_CALCULATION_VERSION,
    classification: "planning-estimate",
    status: overCapacity ? "blocked" : "review",
    cfm: airflow,
    airflowSource: input.airflowSource,
    velocityLimitFpm: velocityLimit,
    maxDiameterInches: maximumDiameter,
    recommendedDiameterInches: recommendedDiameter,
    recommendedVelocityFpm: recommendedVelocity,
    overCapacity,
    applyEligible: airflowApplyEligible && !overCapacity,
    reasonCodes,
    alternatives: overCapacity
      ? parallelFlexAlternatives({
        cfm: airflow,
        velocityLimitFpm: velocityLimit,
        maxDiameterInches: maximumDiameter,
      })
      : [],
  };
}

export function allocateCfm(
  totalCfm: number,
  rows: readonly { key: string; weight: number }[],
  incrementCfm = 5,
) {
  const ordered = [...rows].sort((left, right) => left.key.localeCompare(right.key));
  const increment = Math.max(1, Math.round(nonNegative(incrementCfm)));
  const totalUnits = Math.round(nonNegative(totalCfm) / increment);
  const weightTotal = ordered.reduce((sum, row) => sum + nonNegative(row.weight), 0);
  const result: Record<string, number> = {};
  if (!ordered.length || !weightTotal) return result;
  const allocations = ordered.map((row) => {
    const exactUnits = totalUnits * nonNegative(row.weight) / weightTotal;
    return {
      key: row.key,
      units: Math.floor(exactUnits),
      remainder: exactUnits - Math.floor(exactUnits),
    };
  });
  let remainingUnits = totalUnits - allocations.reduce((sum, row) => sum + row.units, 0);
  [...allocations]
    .sort((left, right) => right.remainder - left.remainder || left.key.localeCompare(right.key))
    .forEach((row) => {
      if (remainingUnits <= 0) return;
      row.units += 1;
      remainingUnits -= 1;
    });
  allocations.forEach((row) => {
    result[row.key] = row.units * increment;
  });
  return result;
}

export function evaluateTransition(input: {
  parentDiameterInches: number;
  childDiameterInches: number;
  portKind: "straight" | "branch";
}) {
  const catalog = [...SUPPORTED_RESIDENTIAL_FLEX_DIAMETERS];
  const parentIndex = catalog.indexOf(input.parentDiameterInches as typeof catalog[number]);
  const childIndex = catalog.indexOf(input.childDiameterInches as typeof catalog[number]);
  if (parentIndex < 0 || childIndex < 0) {
    return { status: "unknown" as const, reasonCodes: ["SIZE_OUTSIDE_CATALOG"] };
  }
  if (childIndex > parentIndex) {
    return { status: "blocked" as const, reasonCodes: ["DOWNSTREAM_SIZE_GROWTH"] };
  }
  const drop = parentIndex - childIndex;
  const allowedDrop = input.portKind === "straight" ? 1 : 2;
  return drop > allowedDrop
    ? {
      status: "review" as const,
      reasonCodes: [input.portKind === "straight" ? "AGGRESSIVE_STRAIGHT_REDUCTION" : "AGGRESSIVE_BRANCH_REDUCTION"],
    }
    : { status: "pass" as const, reasonCodes: [] };
}
