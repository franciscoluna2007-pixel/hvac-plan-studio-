export type DedicatedExhaustSymbolKind = "rangeHood" | "dryerVent";

export type DedicatedExhaustSymbolPreset = {
  id: string;
  category: "Air devices";
  kind: DedicatedExhaustSymbolKind;
  label: "Range Hood" | "Dryer Vent";
  size: "FIELD VERIFY";
  cfm: 0;
  variant: "range-hood" | "dryer-vent";
};

export const dedicatedExhaustSymbolPresets: readonly DedicatedExhaustSymbolPreset[] = [
  {
    id: "device-range-hood",
    category: "Air devices",
    kind: "rangeHood",
    label: "Range Hood",
    size: "FIELD VERIFY",
    cfm: 0,
    variant: "range-hood",
  },
  {
    id: "device-dryer-vent",
    category: "Air devices",
    kind: "dryerVent",
    label: "Dryer Vent",
    size: "FIELD VERIFY",
    cfm: 0,
    variant: "dryer-vent",
  },
] as const;

export function isDedicatedExhaustSymbolKind(
  kind: string | undefined,
): kind is DedicatedExhaustSymbolKind {
  return kind === "rangeHood" || kind === "dryerVent";
}

type DedicatedExhaustDrawing = {
  symbol?: {
    kind?: string;
  };
};

export type DedicatedExhaustTakeoffRow = {
  category: "Air devices";
  item: "Range Hood" | "Dryer Vent";
  size: "Field verify";
  quantity: string;
  note: "Device count only · duct route, length, and size are not inferred";
};

export function buildDedicatedExhaustTakeoffRows(
  drawings: readonly DedicatedExhaustDrawing[],
): DedicatedExhaustTakeoffRow[] {
  return dedicatedExhaustSymbolPresets.flatMap((preset) => {
    const count = drawings.filter(
      (drawing) => drawing.symbol?.kind === preset.kind,
    ).length;
    return count
      ? [{
          category: "Air devices" as const,
          item: preset.label,
          size: "Field verify" as const,
          quantity: `${count} EA`,
          note: "Device count only · duct route, length, and size are not inferred" as const,
        }]
      : [];
  });
}
