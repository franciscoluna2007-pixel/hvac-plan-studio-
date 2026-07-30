export type RedlinePathPoint = {
  x: number;
  y: number;
};

function finite(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function coordinate(value: number) {
  return Number(finite(value).toFixed(3));
}

function pointCommand(point: RedlinePathPoint) {
  return `${coordinate(point.x)} ${coordinate(point.y)}`;
}

/**
 * Builds a live, rounded freehand path without changing the stored samples.
 * Midpoint quadratics remove the angular "connected dots" look while keeping
 * pointer movement responsive and deterministic for exports.
 */
export function smoothRedlineStrokePath(
  points: readonly RedlinePathPoint[],
) {
  if (!points.length) return "";
  if (points.length === 1) {
    const point = points[0];
    return `M ${pointCommand(point)} l 0.01 0`;
  }
  if (points.length === 2) {
    return `M ${pointCommand(points[0])} L ${pointCommand(points[1])}`;
  }

  const commands = [`M ${pointCommand(points[0])}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    const midpoint = {
      x: (control.x + next.x) / 2,
      y: (control.y + next.y) / 2,
    };
    commands.push(
      `Q ${pointCommand(control)} ${pointCommand(midpoint)}`,
    );
  }
  const last = points.at(-1)!;
  commands.push(`Q ${pointCommand(last)} ${pointCommand(last)}`);
  return commands.join(" ");
}
