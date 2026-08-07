export const AIRFLOW_SIZING_PROFILE_VERSION = "field-chart-v1" as const;

export type RoundAirflowCapacity = {
  diameterInches: number;
  cfm: number;
};

export type RectangularAirflowCapacity = {
  widthInches: number;
  heightInches: number;
  cfm: number;
};

export type AirflowSizingProfile = {
  version: typeof AIRFLOW_SIZING_PROFILE_VERSION;
  name: string;
  longRunThresholdFeet: number;
  flexibleFrictionRate: number;
  roundMetalFrictionRate: number;
  rectangularFrictionRate: number;
  flexible: RoundAirflowCapacity[];
  roundMetal: RoundAirflowCapacity[];
  rectangular: RectangularAirflowCapacity[];
};

export const DEFAULT_AIRFLOW_SIZING_PROFILE: AirflowSizingProfile = {
  version: AIRFLOW_SIZING_PROFILE_VERSION,
  name: "Field airflow chart",
  longRunThresholdFeet: 25,
  flexibleFrictionRate: 0.05,
  roundMetalFrictionRate: 0.06,
  rectangularFrictionRate: 0.07,
  flexible: [
    { diameterInches: 5, cfm: 50 },
    { diameterInches: 6, cfm: 75 },
    { diameterInches: 7, cfm: 110 },
    { diameterInches: 8, cfm: 160 },
    { diameterInches: 9, cfm: 225 },
    { diameterInches: 10, cfm: 300 },
    { diameterInches: 12, cfm: 480 },
    { diameterInches: 14, cfm: 700 },
    { diameterInches: 16, cfm: 1000 },
    { diameterInches: 18, cfm: 1300 },
    { diameterInches: 20, cfm: 1700 },
  ],
  roundMetal: [
    { diameterInches: 5, cfm: 50 },
    { diameterInches: 6, cfm: 85 },
    { diameterInches: 7, cfm: 125 },
    { diameterInches: 8, cfm: 180 },
    { diameterInches: 9, cfm: 240 },
    { diameterInches: 10, cfm: 325 },
    { diameterInches: 12, cfm: 525 },
    { diameterInches: 14, cfm: 750 },
    { diameterInches: 16, cfm: 1200 },
    { diameterInches: 18, cfm: 1500 },
    { diameterInches: 20, cfm: 2000 },
  ],
  rectangular: [
    { widthInches: 6, heightInches: 4, cfm: 60 },
    { widthInches: 8, heightInches: 4, cfm: 90 },
    { widthInches: 10, heightInches: 4, cfm: 120 },
    { widthInches: 12, heightInches: 4, cfm: 150 },
    { widthInches: 14, heightInches: 4, cfm: 180 },
    { widthInches: 16, heightInches: 4, cfm: 210 },
    { widthInches: 18, heightInches: 4, cfm: 240 },
    { widthInches: 20, heightInches: 4, cfm: 270 },
    { widthInches: 22, heightInches: 4, cfm: 300 },
    { widthInches: 24, heightInches: 4, cfm: 330 },
    { widthInches: 4, heightInches: 6, cfm: 60 },
    { widthInches: 6, heightInches: 6, cfm: 110 },
    { widthInches: 8, heightInches: 6, cfm: 160 },
    { widthInches: 10, heightInches: 6, cfm: 215 },
    { widthInches: 12, heightInches: 6, cfm: 270 },
    { widthInches: 14, heightInches: 6, cfm: 320 },
    { widthInches: 16, heightInches: 6, cfm: 375 },
    { widthInches: 18, heightInches: 6, cfm: 430 },
    { widthInches: 20, heightInches: 6, cfm: 490 },
    { widthInches: 22, heightInches: 6, cfm: 540 },
    { widthInches: 24, heightInches: 6, cfm: 600 },
    { widthInches: 26, heightInches: 6, cfm: 650 },
    { widthInches: 28, heightInches: 6, cfm: 710 },
    { widthInches: 30, heightInches: 6, cfm: 775 },
    { widthInches: 4, heightInches: 8, cfm: 90 },
    { widthInches: 6, heightInches: 8, cfm: 160 },
    { widthInches: 8, heightInches: 8, cfm: 230 },
    { widthInches: 10, heightInches: 8, cfm: 310 },
    { widthInches: 12, heightInches: 8, cfm: 400 },
    { widthInches: 14, heightInches: 8, cfm: 490 },
    { widthInches: 16, heightInches: 8, cfm: 580 },
    { widthInches: 18, heightInches: 8, cfm: 670 },
    { widthInches: 20, heightInches: 8, cfm: 750 },
    { widthInches: 22, heightInches: 8, cfm: 840 },
    { widthInches: 24, heightInches: 8, cfm: 930 },
    { widthInches: 26, heightInches: 8, cfm: 1020 },
    { widthInches: 28, heightInches: 8, cfm: 1100 },
    { widthInches: 30, heightInches: 8, cfm: 1200 },
    { widthInches: 32, heightInches: 8, cfm: 1300 },
    { widthInches: 34, heightInches: 8, cfm: 1400 },
    { widthInches: 36, heightInches: 8, cfm: 1500 },
    { widthInches: 4, heightInches: 10, cfm: 120 },
    { widthInches: 6, heightInches: 10, cfm: 215 },
    { widthInches: 8, heightInches: 10, cfm: 310 },
    { widthInches: 10, heightInches: 10, cfm: 430 },
    { widthInches: 12, heightInches: 10, cfm: 550 },
    { widthInches: 14, heightInches: 10, cfm: 670 },
    { widthInches: 16, heightInches: 10, cfm: 800 },
    { widthInches: 18, heightInches: 10, cfm: 930 },
    { widthInches: 20, heightInches: 10, cfm: 1060 },
    { widthInches: 22, heightInches: 10, cfm: 1200 },
    { widthInches: 24, heightInches: 10, cfm: 1320 },
    { widthInches: 26, heightInches: 10, cfm: 1430 },
    { widthInches: 28, heightInches: 10, cfm: 1550 },
    { widthInches: 30, heightInches: 10, cfm: 1670 },
    { widthInches: 32, heightInches: 10, cfm: 1800 },
    { widthInches: 34, heightInches: 10, cfm: 1930 },
    { widthInches: 36, heightInches: 10, cfm: 2060 },
    { widthInches: 38, heightInches: 10, cfm: 2200 },
    { widthInches: 40, heightInches: 10, cfm: 2350 },
    { widthInches: 4, heightInches: 12, cfm: 150 },
    { widthInches: 6, heightInches: 12, cfm: 270 },
    { widthInches: 8, heightInches: 12, cfm: 400 },
    { widthInches: 10, heightInches: 12, cfm: 550 },
    { widthInches: 12, heightInches: 12, cfm: 680 },
    { widthInches: 14, heightInches: 12, cfm: 800 },
    { widthInches: 16, heightInches: 12, cfm: 950 },
    { widthInches: 18, heightInches: 12, cfm: 1100 },
    { widthInches: 20, heightInches: 12, cfm: 1250 },
    { widthInches: 22, heightInches: 12, cfm: 1400 },
    { widthInches: 24, heightInches: 12, cfm: 1600 },
    { widthInches: 26, heightInches: 12, cfm: 1750 },
    { widthInches: 28, heightInches: 12, cfm: 1950 },
    { widthInches: 30, heightInches: 12, cfm: 2150 },
    { widthInches: 32, heightInches: 12, cfm: 2300 },
    { widthInches: 34, heightInches: 12, cfm: 2450 },
    { widthInches: 36, heightInches: 12, cfm: 2600 },
    { widthInches: 38, heightInches: 12, cfm: 2750 },
    { widthInches: 40, heightInches: 12, cfm: 2900 },
    { widthInches: 42, heightInches: 12, cfm: 3050 },
  ],
};

function finitePositive(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeRoundRows(
  rows: readonly RoundAirflowCapacity[] | undefined,
  fallback: readonly RoundAirflowCapacity[],
) {
  const normalized = (rows?.length ? rows : fallback)
    .map((row) => ({
      diameterInches: finitePositive(row.diameterInches, 0),
      cfm: Math.round(finitePositive(row.cfm, 0)),
    }))
    .filter((row) => row.diameterInches > 0 && row.cfm > 0)
    .sort((left, right) => left.diameterInches - right.diameterInches);
  return normalized.length ? normalized : fallback.map((row) => ({ ...row }));
}

function normalizeRectangularRows(
  rows: readonly RectangularAirflowCapacity[] | undefined,
  fallback: readonly RectangularAirflowCapacity[],
) {
  const normalized = (rows?.length ? rows : fallback)
    .map((row) => ({
      widthInches: finitePositive(row.widthInches, 0),
      heightInches: finitePositive(row.heightInches, 0),
      cfm: Math.round(finitePositive(row.cfm, 0)),
    }))
    .filter((row) => row.widthInches > 0 && row.heightInches > 0 && row.cfm > 0)
    .sort((left, right) => left.heightInches - right.heightInches || left.widthInches - right.widthInches);
  return normalized.length ? normalized : fallback.map((row) => ({ ...row }));
}

export function normalizeAirflowSizingProfile(
  value?: Partial<AirflowSizingProfile> | null,
): AirflowSizingProfile {
  const defaults = DEFAULT_AIRFLOW_SIZING_PROFILE;
  return {
    version: AIRFLOW_SIZING_PROFILE_VERSION,
    name: value?.name?.trim() || defaults.name,
    longRunThresholdFeet: finitePositive(value?.longRunThresholdFeet, defaults.longRunThresholdFeet),
    flexibleFrictionRate: finitePositive(value?.flexibleFrictionRate, defaults.flexibleFrictionRate),
    roundMetalFrictionRate: finitePositive(value?.roundMetalFrictionRate, defaults.roundMetalFrictionRate),
    rectangularFrictionRate: finitePositive(value?.rectangularFrictionRate, defaults.rectangularFrictionRate),
    flexible: normalizeRoundRows(value?.flexible, defaults.flexible),
    roundMetal: normalizeRoundRows(value?.roundMetal, defaults.roundMetal),
    rectangular: normalizeRectangularRows(value?.rectangular, defaults.rectangular),
  };
}

export function cloneDefaultAirflowSizingProfile() {
  return normalizeAirflowSizingProfile(DEFAULT_AIRFLOW_SIZING_PROFILE);
}
