export type PlanContextWheelKind = "icon" | "run" | "fitting";

export type ContextWheelActionPosition = {
  left: number;
  top: number;
};

/**
 * Stable action contracts for each selected plan-object type.
 *
 * Keeping these lists outside React makes it easy to test that fittings never
 * inherit unsafe symbol actions such as copy or mirror.
 */
export const PLAN_CONTEXT_WHEEL_ACTION_IDS = {
  icon: [
    "rotate-left",
    "rotate-right",
    "mirror",
    "compact",
    "duplicate",
    "delete",
    "close",
  ],
  run: [
    "label-smaller",
    "label-larger",
    "label-reset",
    "extend-b",
    "split",
    "extend-a",
    "delete",
    "close",
  ],
  fitting: [
    "inspect-connections",
    "edit-properties",
    "delete",
    "close",
  ],
} as const;

export function planContextWheelCaption(kind: PlanContextWheelKind) {
  return kind.toUpperCase();
}

/**
 * Returns the next roving-tab-index position for toolbar keyboard navigation.
 * An unfocused toolbar enters at its first action when moving forward and its
 * last action when moving backward.
 */
export function nextContextWheelActionIndex(
  currentIndex: number,
  key: string,
  actionCount: number,
): number | null {
  if (!Number.isInteger(actionCount) || actionCount <= 0) return null;
  const lastIndex = actionCount - 1;
  if (key === "Home") return 0;
  if (key === "End") return lastIndex;
  if (key === "ArrowRight" || key === "ArrowDown") {
    if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex > lastIndex) {
      return 0;
    }
    return (currentIndex + 1) % actionCount;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex > lastIndex) {
      return lastIndex;
    }
    return currentIndex === 0 ? lastIndex : currentIndex - 1;
  }
  return null;
}

/**
 * Places any number of object actions evenly around the existing wheel ring.
 * Close remains a center action and therefore is not included in this count.
 */
export function contextWheelActionPosition(
  index: number,
  actionCount: number,
): ContextWheelActionPosition {
  if (
    !Number.isInteger(index)
    || !Number.isInteger(actionCount)
    || actionCount <= 0
    || index < 0
    || index >= actionCount
  ) {
    return { left: 50, top: 50 };
  }
  const startAngleDegrees = -120;
  const angle = (startAngleDegrees + index * 360 / actionCount) * Math.PI / 180;
  const radiusPercent = 36;
  return {
    left: Number((50 + Math.cos(angle) * radiusPercent).toFixed(3)),
    top: Number((50 + Math.sin(angle) * radiusPercent).toFixed(3)),
  };
}
