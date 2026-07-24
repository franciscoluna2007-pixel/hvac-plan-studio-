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
  { id: "release", label: "Field release & run book", detail: "Release certificate, gates, checklist, and duct schedule" },
  { id: "materials", label: "Material takeoff", detail: "Duct, fittings, air devices, allowances, and field notes" },
  { id: "airflow", label: "Room airflow", detail: "Supply, return, balance, devices, and return-path review" },
  { id: "review", label: "Plan review log", detail: "Current findings, evidence, and recorded dispositions" },
  { id: "coordination", label: "RFI & punch records", detail: "Open coordination, approvals, field issues, and as-builts" },
  { id: "startup", label: "Startup & commissioning", detail: "Equipment identity, static pressure, airflow, and closeout checklist" },
];

export const fieldPackagePresets: Array<{
  id: FieldPackagePresetId;
  label: string;
  detail: string;
  sections: FieldPackageSectionId[];
}> = [
  {
    id: "installer",
    label: "Installer",
    detail: "Plan, released run book, materials, airflow, and field coordination",
    sections: ["plan", "release", "materials", "airflow", "coordination"],
  },
  {
    id: "sheet-metal",
    label: "Sheet Metal Shop",
    detail: "Controlled plan, release information, takeoff, and review holds",
    sections: ["plan", "release", "materials", "review"],
  },
  {
    id: "startup",
    label: "Startup Technician",
    detail: "Plan context, release information, airflow, and commissioning",
    sections: ["plan", "release", "airflow", "startup"],
  },
  {
    id: "closeout",
    label: "Full Closeout",
    detail: "Complete controlled installation, review, coordination, and startup package",
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
