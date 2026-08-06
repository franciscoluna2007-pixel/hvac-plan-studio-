export type AirflowBudgetNode = {
  id: string;
  childIds: string[];
  scheduledCfm?: number;
  manualCfm?: number;
};

export type AirflowBudgetRoot = {
  runId: string;
  availableCfm: number;
};

export function allocateBranchAirflow(
  nodes: AirflowBudgetNode[],
  roots: AirflowBudgetRoot[],
) {
  const allocated = new Map<string, number>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const distribute = (runId: string, availableCfm: number, visiting = new Set<string>()) => {
    if (visiting.has(runId)) return;
    const node = nodeById.get(runId);
    if (!node) return;
    const next = new Set(visiting).add(runId);
    const assignedCfm = Math.round(
      Math.max(0, node.manualCfm || node.scheduledCfm || availableCfm),
    );
    allocated.set(runId, assignedCfm);

    const childIds = [...new Set(node.childIds)].filter((childId) => nodeById.has(childId));
    if (!childIds.length) return;

    const fixed = new Map<string, number>();
    childIds.forEach((childId) => {
      const child = nodeById.get(childId)!;
      const fixedCfm = Math.max(0, child.manualCfm || child.scheduledCfm || 0);
      if (fixedCfm) fixed.set(childId, Math.round(fixedCfm));
    });
    const fixedTotal = [...fixed.values()].reduce((sum, cfm) => sum + cfm, 0);
    const openChildren = childIds.filter((childId) => !fixed.has(childId));
    const remaining = Math.max(0, assignedCfm - fixedTotal);
    let distributed = 0;

    childIds.forEach((childId) => {
      const isLastOpen = childId === openChildren.at(-1);
      const childBudget = fixed.get(childId) ?? (isLastOpen
        ? Math.max(0, remaining - distributed)
        : Math.round(remaining / openChildren.length));
      if (!fixed.has(childId)) distributed += childBudget;
      distribute(childId, childBudget, next);
    });
  };

  roots.forEach((root) => distribute(root.runId, Math.max(0, root.availableCfm)));
  return allocated;
}
