export type FocusRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type PlanFocusTarget = {
  x: number;
  y: number;
  mode: "visible-region" | "full-viewport" | "close-occluder";
};

type FocusRegion = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const MIN_VISIBLE_WIDTH = 240;
const MIN_VISIBLE_HEIGHT = 180;
const EDGE_MARGIN = 24;

function regionWidth(region: FocusRegion) {
  return Math.max(0, region.right - region.left);
}

function regionHeight(region: FocusRegion) {
  return Math.max(0, region.bottom - region.top);
}

function regionArea(region: FocusRegion) {
  return regionWidth(region) * regionHeight(region);
}

export function planFocusTarget(
  viewport: FocusRect,
  occluder?: FocusRect | null,
): PlanFocusTarget {
  const fullViewport = {
    x: viewport.width / 2,
    y: viewport.height / 2,
    mode: "full-viewport" as const,
  };
  if (!occluder) return fullViewport;

  const overlap = {
    left: Math.max(viewport.left, occluder.left),
    top: Math.max(viewport.top, occluder.top),
    right: Math.min(viewport.right, occluder.right),
    bottom: Math.min(viewport.bottom, occluder.bottom),
  };
  if (regionWidth(overlap) <= 0 || regionHeight(overlap) <= 0) return fullViewport;

  const candidates: FocusRegion[] = [
    {
      left: viewport.left,
      top: viewport.top,
      right: overlap.left,
      bottom: viewport.bottom,
    },
    {
      left: overlap.right,
      top: viewport.top,
      right: viewport.right,
      bottom: viewport.bottom,
    },
    {
      left: viewport.left,
      top: viewport.top,
      right: viewport.right,
      bottom: overlap.top,
    },
    {
      left: viewport.left,
      top: overlap.bottom,
      right: viewport.right,
      bottom: viewport.bottom,
    },
  ].filter((region) =>
    regionWidth(region) >= MIN_VISIBLE_WIDTH &&
    regionHeight(region) >= MIN_VISIBLE_HEIGHT
  );
  const visibleRegion = candidates.reduce<FocusRegion | null>(
    (largest, region) => !largest || regionArea(region) > regionArea(largest) ? region : largest,
    null,
  );
  if (!visibleRegion) {
    return {
      ...fullViewport,
      mode: "close-occluder",
    };
  }

  const horizontalMargin = Math.min(EDGE_MARGIN, regionWidth(visibleRegion) / 4);
  const verticalMargin = Math.min(EDGE_MARGIN, regionHeight(visibleRegion) / 4);
  return {
    x:
      (visibleRegion.left + horizontalMargin +
        visibleRegion.right - horizontalMargin) / 2 -
      viewport.left,
    y:
      (visibleRegion.top + verticalMargin +
        visibleRegion.bottom - verticalMargin) / 2 -
      viewport.top,
    mode: "visible-region",
  };
}
