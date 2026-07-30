export type TerminalPlanLabelInput = {
  kind: string;
  size: string;
  label: string;
  usesCatalogLabel?: boolean;
};

function normalizedPlanText(value: string) {
  return value
    .trim()
    .replace(
      /(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/g,
      "$1×$2",
    )
    .replace(/\s+/g, " ");
}

export function compactTerminalPlanLabel({
  kind,
  size,
  label,
  usesCatalogLabel = false,
}: TerminalPlanLabelInput) {
  if (!["diffuser", "returnGrille"].includes(kind)) return label;

  const formattedSize = normalizedPlanText(size);
  const trimmedLabel = label.trim();
  const comparableLabel = normalizedPlanText(trimmedLabel);
  const airflowRole = kind === "returnGrille" ? "RETURN" : "SUPPLY";
  const automaticLabels = new Set([
    formattedSize.toUpperCase(),
    `${formattedSize} ${airflowRole}`.toUpperCase(),
    `${formattedSize} ${airflowRole} GRILLE`.toUpperCase(),
  ]);

  if (
    usesCatalogLabel ||
    !trimmedLabel ||
    automaticLabels.has(comparableLabel.toUpperCase())
  ) {
    return formattedSize;
  }

  return trimmedLabel;
}
