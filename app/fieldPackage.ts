export type FieldPackageSectionId =
  | "plan"
  | "release"
  | "materials"
  | "airflow"
  | "review"
  | "coordination"
  | "startup";

export type FieldPackagePresetId =
  | "installer"
  | "sheet-metal"
  | "startup"
  | "closeout";

export const fieldPackageSections: Array<{
  id: FieldPackageSectionId;
  label: string;
  detail: string;
}> = [
  { id: "plan", label: "Marked-up plan", detail: "Current PDF sheet and controlled HVAC overlay" },
  { id: "release", label: "Analysis summary & run schedule", detail: "Source revision, review gates, checklist, and duct schedule" },
  { id: "materials", label: "Material takeoff", detail: "Duct, fittings, air devices, allowances, and review notes" },
  { id: "airflow", label: "Room airflow", detail: "Supply, return, balance, devices, and return-path review" },
  { id: "review", label: "Plan review log", detail: "Current findings, evidence, and recorded dispositions" },
  { id: "coordination", label: "Open findings & decisions", detail: "Plan questions, approvals, review issues, and recorded decisions" },
  { id: "startup", label: "Equipment & airflow checks", detail: "Equipment identity, static pressure, airflow, and source-plan checklist" },
];

export const fieldPackagePresets: Array<{
  id: FieldPackagePresetId;
  label: string;
  detail: string;
  sections: FieldPackageSectionId[];
}> = [
  {
    id: "installer",
    label: "Estimator",
    detail: "Marked plan, run schedule, materials, airflow, and open findings",
    sections: ["plan", "release", "materials", "airflow", "coordination"],
  },
  {
    id: "sheet-metal",
    label: "Sheet Metal Takeoff",
    detail: "Source-backed plan, run information, takeoff, and review holds",
    sections: ["plan", "release", "materials", "review"],
  },
  {
    id: "startup",
    label: "Plan Reviewer",
    detail: "Plan context, source revision, airflow, and equipment checks",
    sections: ["plan", "release", "airflow", "startup"],
  },
  {
    id: "closeout",
    label: "Complete Takeoff",
    detail: "Complete marked plan, takeoff, review decisions, and equipment package",
    sections: fieldPackageSections.map((section) => section.id),
  },
];

export function sectionsForPreset(presetId: FieldPackagePresetId) {
  return [...(fieldPackagePresets.find((preset) => preset.id === presetId)?.sections ||
    fieldPackagePresets.at(-1)?.sections ||
    [])];
}

export function normalizePackageSections(sections: FieldPackageSectionId[]) {
  const selected = new Set(sections);
  return fieldPackageSections
    .map((section) => section.id)
    .filter((section) => selected.has(section));
}
