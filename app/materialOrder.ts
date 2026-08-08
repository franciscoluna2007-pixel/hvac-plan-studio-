export type MaterialOrderCategory = "Duct" | "Fittings" | "Air devices" | "Equipment" | "Accessories";

export type MaterialOrderRow = {
  id: string;
  category: MaterialOrderCategory;
  item: string;
  size: string;
  quantity: string;
  note: string;
  orderCount: number;
  orderUnit: "box" | "each" | "lot";
  breakdown?: string;
  sourceDrawingIds: string[];
  measuredLengthFeet?: number;
  allowancePercent?: number;
  orderLengthFeet?: number;
  packageLengthFeet?: number;
};

export type MaterialRunInput = {
  id: string;
  type: "supply" | "return" | "fresh";
  size: string;
  lengthFeet: number;
};

export type MaterialRigidRunInput = {
  id: string;
  networkKind: "supply" | "return" | "fresh";
  construction: "rectangular" | "round-metal" | "spiral";
  size: string;
  lengthFeet: number | null;
  lengthStatus?: "ready" | "scale-required" | "takeout-required";
};

export type MaterialRigidFittingInput = {
  id: string;
  networkKind: "supply" | "return" | "fresh";
  construction: "rectangular" | "round-metal" | "spiral";
  size: string;
  angleDegrees: 45 | 90;
  rectangularStyle?: "radius" | "square";
};

export type MaterialRigidTransitionInput = {
  id: string;
  networkKind: "supply" | "return" | "fresh";
  construction: "rectangular" | "round-metal" | "spiral";
  inletSize: string;
  outletSize: string;
  lengthInches: number;
  alignment: "centered" | "top-flat" | "bottom-flat" | "left-flat" | "right-flat";
};

export type MaterialRigidCollarInput = {
  id: string;
  construction: "round-metal" | "spiral";
  diameterInches: number;
};

export type MaterialSymbolInput = {
  id: string;
  kind: string;
  label: string;
  size: string;
  neckSize?: string;
  variant?: string;
};

export type MaterialFittingInput = {
  id: string;
  style?: "wye45" | "tee90";
  upstreamSize: string;
  downstreamSize: string;
  branchSize: string;
};

type MaterialOrderInput = {
  runs: readonly MaterialRunInput[];
  rigidRuns?: readonly MaterialRigidRunInput[];
  rigidFittings?: readonly MaterialRigidFittingInput[];
  rigidTransitions?: readonly MaterialRigidTransitionInput[];
  rigidCollars?: readonly MaterialRigidCollarInput[];
  symbols: readonly MaterialSymbolInput[];
  fittings: readonly MaterialFittingInput[];
  allowancePercent: number;
  packageLengthFeet?: number;
  rigidStockLengthFeet?: number;
};

const categoryOrder = new Map<MaterialOrderCategory, number>([
  ["Duct", 0],
  ["Fittings", 1],
  ["Air devices", 2],
  ["Equipment", 3],
  ["Accessories", 4],
]);

function largestSize(value: string) {
  return Math.max(0, ...[...value.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0])));
}

function sourceLabel(types: Set<MaterialRunInput["type"]>) {
  const labels = [
    types.has("supply") ? "supply" : "",
    types.has("return") ? "return" : "",
    types.has("fresh") ? "fresh air" : "",
  ].filter(Boolean);
  return labels.join(" + ");
}

function alreadyIncludesBox(kind: string, variant: string) {
  if (kind === "diffuser") return ["supply-can", "boot"].includes(variant);
  if (kind === "returnGrille") return variant === "return-can";
  return false;
}

export function buildMaterialOrder({
  runs,
  rigidRuns = [],
  rigidFittings = [],
  rigidTransitions = [],
  rigidCollars = [],
  symbols,
  fittings,
  allowancePercent,
  packageLengthFeet = 25,
  rigidStockLengthFeet = 5,
}: MaterialOrderInput): MaterialOrderRow[] {
  const ductGroups = new Map<string, {
    material: "flex" | "fresh-air";
    size: string;
    lengthFeet: number;
    types: Set<MaterialRunInput["type"]>;
    sourceDrawingIds: string[];
  }>();

  for (const run of runs) {
    const material = run.type === "fresh" ? "fresh-air" : "flex";
    const key = `${material}|${run.size}`;
    const current = ductGroups.get(key) || {
      material,
      size: run.size,
      lengthFeet: 0,
      types: new Set<MaterialRunInput["type"]>(),
      sourceDrawingIds: [],
    };
    current.lengthFeet += Math.max(0, run.lengthFeet);
    current.types.add(run.type);
    current.sourceDrawingIds.push(run.id);
    ductGroups.set(key, current);
  }

  const rows: MaterialOrderRow[] = [];
  for (const group of ductGroups.values()) {
    const orderLengthFeet = group.lengthFeet * (1 + allowancePercent / 100);
    const boxes = Math.max(1, Math.ceil(orderLengthFeet / packageLengthFeet));
    const sources = sourceLabel(group.types);
    rows.push({
      id: `duct:${group.material}:${group.size}`,
      category: "Duct",
      item: group.material === "flex" ? "Flexible duct" : "Fresh-air duct",
      size: `${group.size}\"`,
      quantity: `${boxes} × ${packageLengthFeet}-ft ${boxes === 1 ? "box" : "boxes"}`,
      note: `${group.lengthFeet.toFixed(1)} LF measured · ${allowancePercent}% allowance`,
      orderCount: boxes,
      orderUnit: "box",
      breakdown: `${sources} · ${group.lengthFeet.toFixed(1)} LF measured + ${allowancePercent}% = ${orderLengthFeet.toFixed(1)} LF · ${packageLengthFeet}-ft boxes = ${boxes}`,
      sourceDrawingIds: [...new Set(group.sourceDrawingIds)],
      measuredLengthFeet: group.lengthFeet,
      allowancePercent,
      orderLengthFeet,
      packageLengthFeet,
    });
  }

  const rigidGroups = new Map<string, {
    construction: MaterialRigidRunInput["construction"];
    size: string;
    lengthFeet: number;
    hasUnverifiedLength: boolean;
    hasMissingTakeout: boolean;
    networkKinds: Set<MaterialRigidRunInput["networkKind"]>;
    sourceDrawingIds: string[];
  }>();
  for (const run of rigidRuns) {
    const key = `${run.construction}|${run.size}`;
    const current = rigidGroups.get(key) || {
      construction: run.construction,
      size: run.size,
      lengthFeet: 0,
      hasUnverifiedLength: false,
      hasMissingTakeout: false,
      networkKinds: new Set<MaterialRigidRunInput["networkKind"]>(),
      sourceDrawingIds: [],
    };
    if (run.lengthFeet == null) {
      if (run.lengthStatus === "takeout-required") current.hasMissingTakeout = true;
      else current.hasUnverifiedLength = true;
    }
    else current.lengthFeet += Math.max(0, run.lengthFeet);
    current.networkKinds.add(run.networkKind);
    current.sourceDrawingIds.push(run.id);
    rigidGroups.set(key, current);
  }
  const rigidItemNames: Record<MaterialRigidRunInput["construction"], string> = {
    rectangular: "Rectangular sheet-metal duct",
    "round-metal": "Round metal pipe",
    spiral: "Spiral pipe",
  };
  for (const group of rigidGroups.values()) {
    const sources = sourceLabel(group.networkKinds);
    const sourceDrawingIds = [...new Set(group.sourceDrawingIds)];
    if (group.hasUnverifiedLength || group.hasMissingTakeout) {
      const takeoutRequired = group.hasMissingTakeout && !group.hasUnverifiedLength;
      rows.push({
        id: `rigid:${group.construction}:${group.size}`,
        category: "Duct",
        item: rigidItemNames[group.construction],
        size: group.size,
        quantity: takeoutRequired ? "Takeout required" : "Scale required",
        note: takeoutRequired
          ? "Enter every connected fitting takeout before ordering"
          : "Verify every source sheet scale before ordering",
        orderCount: 0,
        orderUnit: "lot",
        breakdown: `${sources} · ${sourceDrawingIds.length} source ${sourceDrawingIds.length === 1 ? "segment" : "segments"} · ${takeoutRequired ? "finished length blocked until takeouts are entered" : "no length or stock quantity inferred"}`,
        sourceDrawingIds,
      });
      continue;
    }
    const orderLengthFeet = group.lengthFeet * (1 + allowancePercent / 100);
    const pieces = Math.max(1, Math.ceil(orderLengthFeet / rigidStockLengthFeet));
    rows.push({
      id: `rigid:${group.construction}:${group.size}`,
      category: "Duct",
      item: rigidItemNames[group.construction],
      size: group.size,
      quantity: `${pieces} × ${rigidStockLengthFeet}-ft ${pieces === 1 ? "piece" : "pieces"}`,
      note: `${group.lengthFeet.toFixed(1)} LF measured · ${allowancePercent}% allowance`,
      orderCount: pieces,
      orderUnit: "each",
      breakdown: `${sources} · ${group.lengthFeet.toFixed(1)} LF measured + ${allowancePercent}% = ${orderLengthFeet.toFixed(1)} LF · ${rigidStockLengthFeet}-ft stock = ${pieces}`,
      sourceDrawingIds,
      measuredLengthFeet: group.lengthFeet,
      allowancePercent,
      orderLengthFeet,
      packageLengthFeet: rigidStockLengthFeet,
    });
  }

  const rigidFittingGroups = new Map<string, MaterialRigidFittingInput[]>();
  for (const fitting of rigidFittings) {
    const key = [fitting.construction, fitting.size, fitting.angleDegrees, fitting.rectangularStyle || "metal"].join("|");
    rigidFittingGroups.set(key, [...(rigidFittingGroups.get(key) || []), fitting]);
  }
  for (const group of rigidFittingGroups.values()) {
    const first = group[0];
    const construction = rigidItemNames[first.construction].replace(/ duct$| pipe$/i, "");
    const style = first.construction === "rectangular" ? ` ${first.rectangularStyle}` : "";
    rows.push({
      id: `rigid-fitting:${first.construction}:${first.size}:${first.angleDegrees}:${first.rectangularStyle || "metal"}`,
      category: "Fittings",
      item: `${first.angleDegrees}° ${construction}${style} elbow`,
      size: first.size,
      quantity: `${group.length}`,
      note: "Explicit plan fittings",
      orderCount: group.length,
      orderUnit: "each",
      breakdown: `${sourceLabel(new Set(group.map((fitting) => fitting.networkKind)))} · ${group.length} plan ${group.length === 1 ? "fitting" : "fittings"}`,
      sourceDrawingIds: group.map((fitting) => fitting.id),
    });
  }

  const transitionGroups = new Map<string, MaterialRigidTransitionInput[]>();
  for (const transition of rigidTransitions) {
    const key = [
      transition.construction,
      transition.inletSize,
      transition.outletSize,
      transition.lengthInches,
      transition.alignment,
    ].join("|");
    transitionGroups.set(key, [...(transitionGroups.get(key) || []), transition]);
  }
  for (const group of transitionGroups.values()) {
    const first = group[0];
    const round = first.construction !== "rectangular";
    rows.push({
      id: `rigid-transition:${first.construction}:${first.inletSize}:${first.outletSize}:${first.lengthInches}:${first.alignment}`,
      category: "Fittings",
      item: round
        ? `${first.construction === "spiral" ? "Spiral" : "Round metal"} reducer`
        : "Rectangular transition",
      size: `${first.inletSize} → ${first.outletSize}`,
      quantity: `${group.length} each`,
      note: `${first.lengthInches} in long · ${first.alignment.replace("-", " ")}`,
      orderCount: group.length,
      orderUnit: "each",
      breakdown: `${sourceLabel(new Set(group.map((item) => item.networkKind)))} · explicit plan fitting · verify orientation before fabrication`,
      sourceDrawingIds: group.map((item) => item.id),
    });
  }

  const collarGroups = new Map<string, MaterialRigidCollarInput[]>();
  for (const collar of rigidCollars) {
    const key = `${collar.construction}|${collar.diameterInches}`;
    collarGroups.set(key, [...(collarGroups.get(key) || []), collar]);
  }
  for (const group of collarGroups.values()) {
    const first = group[0];
    rows.push({
      id: `rigid-collar:${first.construction}:${first.diameterInches}`,
      category: "Fittings",
      item: "Supply-can straight collar",
      size: `Ø${first.diameterInches}\" · ${first.construction === "spiral" ? "spiral" : "round metal"}`,
      quantity: `${group.length} each`,
      note: "Explicit rigid terminal connections",
      orderCount: group.length,
      orderUnit: "each",
      breakdown: `${group.length} connected supply ${group.length === 1 ? "can" : "cans"} · field verify fastening and seal`,
      sourceDrawingIds: group.map((item) => item.id),
    });
  }

  const symbolGroups = new Map<string, MaterialSymbolInput[]>();
  for (const symbol of symbols) {
    if (["airflow", "note"].includes(symbol.kind)) continue;
    const key = [symbol.kind, symbol.size, symbol.neckSize || "", symbol.variant || "standard", symbol.label].join("|");
    symbolGroups.set(key, [...(symbolGroups.get(key) || []), symbol]);
  }

  for (const group of symbolGroups.values()) {
    const first = group[0];
    const count = group.length;
    const variant = first.variant || "standard";
    const category: MaterialOrderCategory = ["diffuser", "returnGrille", "rangeHood", "dryerVent"].includes(first.kind)
      ? "Air devices"
      : first.kind === "equipment"
        ? "Equipment"
        : "Accessories";
    const fieldVerifyExhaust = ["rangeHood", "dryerVent"].includes(first.kind);
    rows.push({
      id: `symbol:${first.kind}:${variant}:${first.size}:${first.label}`,
      category,
      item: first.label,
      size: fieldVerifyExhaust ? "Field verify" : first.size || "Per plan",
      quantity: `${count} each`,
      note: "",
      orderCount: count,
      orderUnit: "each",
      breakdown: fieldVerifyExhaust
        ? "Device count only · duct route, length, and size are not inferred"
        : `${variant.replaceAll("-", " ")} style · field label governs`,
      sourceDrawingIds: group.map((symbol) => symbol.id),
    });

    if (["diffuser", "returnGrille"].includes(first.kind) && !alreadyIncludesBox(first.kind, variant)) {
      const isSupply = first.kind === "diffuser";
      rows.push({
        id: `box:${first.kind}:${variant}:${first.neckSize || (isSupply ? "8" : "12")}:${first.size}`,
        category: "Air devices",
        item: isSupply ? "Supply can / plenum box" : "Return can / box",
        size: `Ø${first.neckSize || (isSupply ? "8" : "12")}\" neck`,
        quantity: `${count} each`,
        note: "",
        orderCount: count,
        orderUnit: "each",
        breakdown: `${first.size} face · match ${first.label.toLowerCase()}`,
        sourceDrawingIds: group.map((symbol) => symbol.id),
      });
    }
  }

  const fittingGroups = new Map<string, MaterialFittingInput[]>();
  for (const fitting of fittings) {
    const style = fitting.style || "wye45";
    const size = `${fitting.upstreamSize}×${fitting.downstreamSize}×${fitting.branchSize}`;
    const key = `${style}|${size}`;
    fittingGroups.set(key, [...(fittingGroups.get(key) || []), fitting]);
  }
  for (const [key, group] of fittingGroups) {
    const [style, size] = key.split("|");
    const styleLabel = style === "tee90" ? "90° tee" : "45° wye";
    rows.push({
      id: `fitting:${style}:${size}`,
      category: "Fittings",
      item: `T Branch · ${styleLabel}`,
      size: size.split("×").map((value) => `${value}\"`).join(" × "),
      quantity: `${group.length} each`,
      note: "",
      orderCount: group.length,
      orderUnit: "each",
      breakdown: "Verify orientation before fabrication.",
      sourceDrawingIds: group.map((fitting) => fitting.id),
    });
  }

  if (runs.length) {
    rows.push({
      id: "accessories:installation-lot",
      category: "Accessories",
      item: "Hangers, strap, sealant, mastic & fasteners",
      size: "As required",
      quantity: "1 lot",
      note: "",
      orderCount: 1,
      orderUnit: "lot",
      breakdown: "Field verify structure and support spacing.",
      sourceDrawingIds: runs.map((run) => run.id),
    });
  }

  return rows.sort((a, b) =>
    (categoryOrder.get(a.category) ?? 99) - (categoryOrder.get(b.category) ?? 99) ||
    largestSize(b.size) - largestSize(a.size) ||
    a.item.localeCompare(b.item)
  );
}

type MaterialCsvOptions = {
  project: string;
  system: string;
  status: string;
  scale: string;
};

export function buildMaterialOrderCsv(rows: readonly MaterialOrderRow[], options: MaterialCsvOptions) {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const header = [
    "Project", "System", "Status", "Scale", "Category", "Item", "Size", "Quantity", "Unit",
    "Measured LF", "Allowance %", "Order LF", "Package", "Source objects",
  ];
  const records = rows.map((row) => [
    options.project,
    options.system,
    options.status,
    options.scale,
    row.category,
    row.item,
    row.size,
    row.orderCount,
    row.orderUnit,
    row.measuredLengthFeet?.toFixed(1) || "",
    row.allowancePercent ?? "",
    row.orderLengthFeet?.toFixed(1) || "",
    row.packageLengthFeet ? `${row.packageLengthFeet}-ft box` : "",
    row.sourceDrawingIds.length,
  ]);
  return `\uFEFF${[header, ...records].map((row) => row.map(quote).join(",")).join("\r\n")}`;
}
