import {
  REDLINE_POLICY_LIMITS,
  type RedlineStrokeDraft,
  type RedlineStrokeKind,
  type RedlineStrokePoint,
  type RedlineStyle,
} from "./redlineDomain";

export const REDLINE_MAX_COALESCED_SAMPLES = 256;

export type RedlinePointerType = "mouse" | "pen" | "touch" | "unknown";

export type RedlineInputViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type RedlinePointerLike = {
  clientX: number;
  clientY: number;
  pressure?: number;
  timeStamp?: number;
  pointerId?: number;
  pointerType?: string;
  button?: number;
  buttons?: number;
  isPrimary?: boolean;
  getCoalescedEvents?: () => ArrayLike<RedlinePointerLike>;
};

export type RedlinePointerSample = RedlineStrokePoint & {
  pointerId: number;
  pointerType: RedlinePointerType;
};

export type RedlineStrokeSimplifyOptions = {
  tolerance?: number;
  pressureTolerance?: number;
  maxPoints?: number;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function rounded(value: number) {
  return Number(value.toFixed(8));
}

function pointerType(value: unknown): RedlinePointerType {
  return value === "mouse" || value === "pen" || value === "touch"
    ? value
    : "unknown";
}

function normalizedPressure(
  value: unknown,
  type: RedlinePointerType,
  buttons: unknown,
) {
  if (!finite(value)) return 0.5;
  if (type === "mouse" && value === 0 && finite(buttons) && buttons > 0) {
    return 0.5;
  }
  return rounded(clamp(value));
}

export function normalizeRedlinePointerSample(
  sample: RedlinePointerLike,
  viewport: RedlineInputViewport,
  fallback?: {
    pointerId?: number;
    pointerType?: RedlinePointerType;
  },
): RedlinePointerSample | null {
  if (
    !finite(sample.clientX) ||
    !finite(sample.clientY) ||
    !finite(viewport.left) ||
    !finite(viewport.top) ||
    !finite(viewport.width) ||
    !finite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return null;
  }
  const type = pointerType(sample.pointerType) === "unknown"
    ? fallback?.pointerType || "unknown"
    : pointerType(sample.pointerType);
  const pointerId = finite(sample.pointerId)
    ? Math.trunc(sample.pointerId)
    : Math.trunc(fallback?.pointerId ?? 0);
  return {
    x: rounded(clamp((sample.clientX - viewport.left) / viewport.width)),
    y: rounded(clamp((sample.clientY - viewport.top) / viewport.height)),
    pressure: normalizedPressure(sample.pressure, type, sample.buttons),
    t: rounded(Math.max(0, finite(sample.timeStamp) ? sample.timeStamp : 0)),
    pointerId,
    pointerType: type,
  };
}

function sameSample(
  left: RedlinePointerSample,
  right: RedlinePointerSample,
) {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.pressure === right.pressure &&
    left.t === right.t &&
    left.pointerId === right.pointerId
  );
}

export function normalizeCoalescedRedlineSamples(
  event: RedlinePointerLike,
  viewport: RedlineInputViewport,
  previous?: RedlinePointerSample,
): RedlinePointerSample[] {
  const rootPointerId = finite(event.pointerId) ? Math.trunc(event.pointerId) : 0;
  const rootPointerType = pointerType(event.pointerType);
  let coalesced: RedlinePointerLike[] = [];
  if (typeof event.getCoalescedEvents === "function") {
    try {
      coalesced = Array.from(event.getCoalescedEvents());
    } catch {
      coalesced = [];
    }
  }
  const candidates = coalesced.length ? [...coalesced] : [event];
  if (
    coalesced.length &&
    !coalesced.some((sample) =>
      sample.clientX === event.clientX &&
      sample.clientY === event.clientY &&
      sample.timeStamp === event.timeStamp)
  ) {
    candidates.push(event);
  }
  const normalized = candidates
    .slice(-REDLINE_MAX_COALESCED_SAMPLES)
    .map((sample, index) => ({
      sample: normalizeRedlinePointerSample(sample, viewport, {
        pointerId: rootPointerId,
        pointerType: rootPointerType,
      }),
      index,
    }))
    .filter((item): item is { sample: RedlinePointerSample; index: number } =>
      Boolean(item.sample))
    .filter((item) => item.sample.pointerId === rootPointerId)
    .sort((left, right) =>
      (left.sample.t || 0) - (right.sample.t || 0) ||
      left.index - right.index)
    .map((item) => item.sample)
    .filter((sample) => !previous || !(
      sample.pointerId === previous.pointerId &&
      (previous.t || 0) > 0 &&
      (sample.t || 0) <= (previous.t || 0)
    ));

  const result: RedlinePointerSample[] = [];
  for (const sample of normalized) {
    const last = result.at(-1) || previous;
    if (!last || !sameSample(last, sample)) result.push(sample);
  }
  return result;
}

export const collectRedlinePointerSamples = normalizeCoalescedRedlineSamples;

export function redlinePointerCanDraw(
  event: Pick<
    RedlinePointerLike,
    "button" | "buttons" | "isPrimary" | "pointerType"
  >,
  options: {
    allowTouch?: boolean;
    activePointerType?: RedlinePointerType | null;
  } = {},
) {
  const type = pointerType(event.pointerType);
  if (event.isPrimary === false) return false;
  if (finite(event.button) && event.button !== 0) return false;
  if (type === "touch" && !options.allowTouch) return false;
  if (type === "touch" && options.activePointerType === "pen") return false;
  return true;
}

function pointSegmentDistance(
  point: RedlineStrokePoint,
  start: RedlineStrokePoint,
  end: RedlineStrokePoint,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const fraction = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) /
    (dx * dx + dy * dy),
  );
  return Math.hypot(
    point.x - (start.x + fraction * dx),
    point.y - (start.y + fraction * dy),
  );
}

function pressureDeviation(
  point: RedlineStrokePoint,
  start: RedlineStrokePoint,
  end: RedlineStrokePoint,
) {
  if (
    !finite(point.pressure) ||
    !finite(start.pressure) ||
    !finite(end.pressure)
  ) {
    return 0;
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy;
  const fraction = denominator === 0
    ? 0
    : clamp(
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
      denominator,
    );
  const expected = start.pressure + (end.pressure - start.pressure) * fraction;
  return Math.abs(point.pressure - expected);
}

function normalizedStrokePoints(points: readonly RedlineStrokePoint[]) {
  const normalized: RedlineStrokePoint[] = [];
  for (const raw of points) {
    if (!finite(raw.x) || !finite(raw.y)) continue;
    const point: RedlineStrokePoint = {
      x: rounded(clamp(raw.x)),
      y: rounded(clamp(raw.y)),
      ...(finite(raw.pressure)
        ? { pressure: rounded(clamp(raw.pressure)) }
        : {}),
      ...(finite(raw.t) ? { t: rounded(Math.max(0, raw.t)) } : {}),
    };
    const last = normalized.at(-1);
    if (
      !last ||
      last.x !== point.x ||
      last.y !== point.y ||
      last.pressure !== point.pressure
    ) {
      normalized.push(point);
    }
  }
  return normalized;
}

function evenlyCapped(
  points: readonly RedlineStrokePoint[],
  maximum: number,
) {
  if (points.length <= maximum) return [...points];
  if (maximum <= 1) return [points[0]];
  const result: RedlineStrokePoint[] = [];
  for (let index = 0; index < maximum; index += 1) {
    const sourceIndex = Math.round(
      index * (points.length - 1) / (maximum - 1),
    );
    const point = points[sourceIndex];
    if (result.at(-1) !== point) result.push(point);
  }
  return result;
}

export function simplifyRedlineStroke(
  points: readonly RedlineStrokePoint[],
  options: number | RedlineStrokeSimplifyOptions = {},
): RedlineStrokePoint[] {
  const resolved = typeof options === "number"
    ? { tolerance: options }
    : options;
  const tolerance = clamp(
    finite(resolved.tolerance) ? resolved.tolerance : 0.0012,
    0.00001,
    0.1,
  );
  const pressureTolerance = clamp(
    finite(resolved.pressureTolerance) ? resolved.pressureTolerance : 0.08,
    0.001,
    1,
  );
  const maximum = Math.max(
    2,
    Math.min(
      REDLINE_POLICY_LIMITS.maxPointsPerStroke,
      Math.trunc(
        finite(resolved.maxPoints)
          ? resolved.maxPoints
          : REDLINE_POLICY_LIMITS.maxPointsPerStroke,
      ),
    ),
  );
  const source = normalizedStrokePoints(points);
  if (source.length <= 2) return evenlyCapped(source, maximum);

  const keep = new Uint8Array(source.length);
  keep[0] = 1;
  keep[source.length - 1] = 1;
  const segments: Array<[number, number]> = [[0, source.length - 1]];
  while (segments.length) {
    const [startIndex, endIndex] = segments.pop()!;
    const start = source[startIndex];
    const end = source[endIndex];
    let chosenIndex = -1;
    let chosenScore = 1;
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const geometryScore =
        pointSegmentDistance(source[index], start, end) / tolerance;
      const pressureScore =
        pressureDeviation(source[index], start, end) / pressureTolerance;
      const score = Math.max(geometryScore, pressureScore);
      if (score > chosenScore) {
        chosenScore = score;
        chosenIndex = index;
      }
    }
    if (chosenIndex >= 0) {
      keep[chosenIndex] = 1;
      segments.push([chosenIndex, endIndex], [startIndex, chosenIndex]);
    }
  }
  const simplified = source.filter((_, index) => keep[index] === 1);
  return evenlyCapped(simplified, maximum);
}

export function redlineStrokePointsFromSamples(
  samples: readonly RedlinePointerSample[],
  options?: number | RedlineStrokeSimplifyOptions,
) {
  return simplifyRedlineStroke(
    samples.map(({ x, y, pressure, t }) => ({ x, y, pressure, t })),
    options,
  );
}

export function createRedlineStrokeDraft(input: {
  kind: RedlineStrokeKind;
  page: number;
  samples: readonly RedlinePointerSample[];
  layerId?: string;
  style?: Partial<RedlineStyle>;
  simplify?: number | RedlineStrokeSimplifyOptions;
}): RedlineStrokeDraft | null {
  if (
    (input.kind !== "ink" && input.kind !== "highlighter") ||
    !Number.isInteger(input.page) ||
    input.page < 1
  ) {
    return null;
  }
  const points = redlineStrokePointsFromSamples(
    input.samples,
    input.simplify,
  );
  if (!points.length) return null;
  return {
    kind: input.kind,
    page: input.page,
    ...(input.layerId ? { layerId: input.layerId } : {}),
    ...(input.style ? { style: { ...input.style } } : {}),
    points,
  };
}
