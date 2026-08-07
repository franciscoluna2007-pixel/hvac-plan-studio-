import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  DEFAULT_AIRFLOW_SIZING_PROFILE,
  normalizeAirflowSizingProfile,
} from "../app/airflowSizingProfile.ts";
import { recommendFlexibleDuctSize, recommendRoundCapacitySize } from "../app/ductSizing.ts";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const studioSource = await readFile(new URL("../app/AirflowSizingProfileStudio.tsx", import.meta.url), "utf8");

test("preserves the uploaded flexible, round metal, and rectangular capacity values", () => {
  const profile = DEFAULT_AIRFLOW_SIZING_PROFILE;
  assert.deepEqual(profile.flexible.find((row) => row.diameterInches === 14), { diameterInches: 14, cfm: 700 });
  assert.deepEqual(profile.flexible.find((row) => row.diameterInches === 16), { diameterInches: 16, cfm: 1000 });
  assert.deepEqual(profile.roundMetal.find((row) => row.diameterInches === 14), { diameterInches: 14, cfm: 750 });
  assert.deepEqual(profile.roundMetal.find((row) => row.diameterInches === 20), { diameterInches: 20, cfm: 2000 });
  assert.deepEqual(
    profile.rectangular.find((row) => row.widthInches === 42 && row.heightInches === 12),
    { widthInches: 42, heightInches: 12, cfm: 3050 },
  );
  assert.equal(profile.longRunThresholdFeet, 25);
});

test("uses the flexible chart and moves long runs up one available size", () => {
  const normal = recommendRoundCapacitySize({
    cfm: 700,
    capacities: DEFAULT_AIRFLOW_SIZING_PROFILE.flexible,
    maxDiameterInches: 16,
    physicalLengthFeet: 25,
    longRunThresholdFeet: 25,
  });
  assert.equal(normal.recommendedDiameterInches, 14);
  assert.equal(normal.longRunUpsized, false);

  const long = recommendRoundCapacitySize({
    cfm: 700,
    capacities: DEFAULT_AIRFLOW_SIZING_PROFILE.flexible,
    maxDiameterInches: 16,
    physicalLengthFeet: 25.1,
    longRunThresholdFeet: 25,
  });
  assert.equal(long.baseDiameterInches, 14);
  assert.equal(long.recommendedDiameterInches, 16);
  assert.equal(long.longRunUpsized, true);
  assert.ok(long.reasonCodes.includes("LONG_RUN_UPSIZE"));
});

test("keeps a long run blocked when it cannot move beyond the configured maximum", () => {
  const result = recommendRoundCapacitySize({
    cfm: 1_000,
    capacities: DEFAULT_AIRFLOW_SIZING_PROFILE.flexible,
    maxDiameterInches: 16,
    physicalLengthFeet: 30,
    longRunThresholdFeet: 25,
  });

  assert.equal(result.recommendedDiameterInches, 16);
  assert.equal(result.overCapacity, true);
  assert.deepEqual(result.reasonCodes, [
    "FIELD_CAPACITY_CHART",
    "LONG_RUN_AT_MAXIMUM",
    "NO_COMPLIANT_FLEX_SIZE",
  ]);
});

test("keeps chart-driven sizing advisory, bounded, and airflow-source gated", () => {
  const recommendation = recommendFlexibleDuctSize({
    cfm: 480,
    airflowSource: "manual",
    velocityLimitFpm: 900,
    maxDiameterInches: 16,
    capacityTable: DEFAULT_AIRFLOW_SIZING_PROFILE.flexible,
    physicalLengthFeet: 20,
    longRunThresholdFeet: 25,
  });
  assert.equal(recommendation.recommendedDiameterInches, 12);
  assert.equal(recommendation.status, "review");
  assert.equal(recommendation.applyEligible, true);
  assert.ok(recommendation.reasonCodes.includes("FIELD_CAPACITY_CHART"));
  assert.ok(recommendation.reasonCodes.includes("PRESSURE_EVIDENCE_MISSING"));

  const planningSeed = recommendFlexibleDuctSize({
    cfm: 480,
    airflowSource: "planning-seed",
    velocityLimitFpm: 900,
    maxDiameterInches: 16,
    capacityTable: DEFAULT_AIRFLOW_SIZING_PROFILE.flexible,
  });
  assert.equal(planningSeed.applyEligible, false);
});

test("normalizes edited project values without mutating the default chart", () => {
  const edited = normalizeAirflowSizingProfile({
    ...DEFAULT_AIRFLOW_SIZING_PROFILE,
    name: "My company chart",
    longRunThresholdFeet: 30,
    flexible: DEFAULT_AIRFLOW_SIZING_PROFILE.flexible.map((row) => row.diameterInches === 14
      ? { ...row, cfm: 725 }
      : row),
  });
  assert.equal(edited.name, "My company chart");
  assert.equal(edited.longRunThresholdFeet, 30);
  assert.equal(edited.flexible.find((row) => row.diameterInches === 14)?.cfm, 725);
  assert.equal(DEFAULT_AIRFLOW_SIZING_PROFILE.flexible.find((row) => row.diameterInches === 14)?.cfm, 700);
});

test("persists the editable chart and keeps future construction types explicit", () => {
  assert.match(pageSource, /airflowSizingProfile\?: AirflowSizingProfile/);
  assert.match(pageSource, /airflowSizingProfile,/);
  assert.match(pageSource, /setAirflowSizingProfile\(normalizeAirflowSizingProfile\(project\.airflowSizingProfile\)\)/);
  assert.match(pageSource, /capacityTable: airflowSizingProfile\.flexible/);
  assert.match(pageSource, /no duct sizes changed/);
  assert.match(studioSource, /Drives current flex-run suggestions/);
  assert.match(studioSource, /Round \/ spiral/);
  assert.match(studioSource, /Rectangular/);
  assert.match(studioSource, /Saved for future metal runs/);
  assert.match(studioSource, /Saved for future trunk runs/);
});
