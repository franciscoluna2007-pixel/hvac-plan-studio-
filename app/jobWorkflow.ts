export type DrawFirstStage =
  | "routes"
  | "flex-details"
  | "returns"
  | "connections"
  | "complete";

export type DrawFirstWorkflowInput = {
  pdfLoaded: boolean;
  hasPrimaryUnit: boolean;
  supplyRunCount: number;
  supplyDeviceCount: number;
  pendingSupplyNumbers: number;
  pendingSupplySizes: number;
  returnRunCount: number;
  returnDeviceCount: number;
  pendingReturnNumbers: number;
  pendingReturnSizes: number;
  connectionProblems: number;
  connectionsComplete: boolean;
};

export type DrawFirstWorkflowState = {
  stage: DrawFirstStage;
  title: string;
  detail: string;
  complete: boolean;
};

export function deriveDrawFirstWorkflow(
  input: DrawFirstWorkflowInput,
): DrawFirstWorkflowState {
  if (
    !input.pdfLoaded ||
    !input.hasPrimaryUnit ||
    !input.supplyRunCount ||
    !input.supplyDeviceCount ||
    input.supplyRunCount < input.supplyDeviceCount
  ) {
    return {
      stage: "routes",
      title: "Draw the system first",
      detail: !input.pdfLoaded
        ? "Open the plan"
        : !input.hasPrimaryUnit
          ? "Place the system unit, supply cans, and blue routes"
          : !input.supplyDeviceCount
            ? "Place the supply cans, then draw every blue route"
            : input.supplyRunCount < input.supplyDeviceCount
              ? `Draw ${input.supplyDeviceCount - input.supplyRunCount} more supply route${input.supplyDeviceCount - input.supplyRunCount === 1 ? "" : "s"}`
              : "Draw the main route and every supply run",
      complete: false,
    };
  }

  if (input.pendingSupplyNumbers || input.pendingSupplySizes) {
    const pending = input.pendingSupplyNumbers + input.pendingSupplySizes;
    return {
      stage: "flex-details",
      title: "Add flex numbers and sizes",
      detail: `${pending} flex detail${pending === 1 ? "" : "s"} need${pending === 1 ? "s" : ""} review`,
      complete: false,
    };
  }

  if (
    !input.returnRunCount ||
    !input.returnDeviceCount ||
    input.pendingReturnNumbers ||
    input.pendingReturnSizes
  ) {
    return {
      stage: "returns",
      title: "Add the returns",
      detail: !input.returnDeviceCount
        ? "Place return grilles or cans"
        : !input.returnRunCount
          ? "Draw the red return routes"
      : `${input.pendingReturnNumbers + input.pendingReturnSizes} return detail${input.pendingReturnNumbers + input.pendingReturnSizes === 1 ? "" : "s"} need${input.pendingReturnNumbers + input.pendingReturnSizes === 1 ? "s" : ""} review`,
      complete: false,
    };
  }

  if (!input.connectionsComplete || input.connectionProblems) {
    return {
      stage: "connections",
      title: "Connect and repair the system",
      detail: input.connectionProblems
        ? `${input.connectionProblems} connection${input.connectionProblems === 1 ? "" : "s"} need review`
        : "Review equipment, cans, returns, and T/Y ports",
      complete: false,
    };
  }

  return {
    stage: "complete",
    title: "Drawing and details complete",
    detail: "Routes, numbers, sizes, returns, and connections are ready",
    complete: true,
  };
}
