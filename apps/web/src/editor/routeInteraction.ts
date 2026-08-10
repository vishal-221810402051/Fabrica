export const EDGE_INTERACTION_STROKE_PX = 24;
export const PREFERRED_ENDPOINT_EXCLUSION_PX = 28;
export const MINIMUM_INTERACTIVE_ROUTE_LENGTH_PX = 12;

export function deriveEndpointSafeInteractionPath(
  points: readonly { x: number; y: number }[],
  endpointExclusionPx = PREFERRED_ENDPOINT_EXCLUSION_PX,
  minimumInteractiveLengthPx = MINIMUM_INTERACTIVE_ROUTE_LENGTH_PX,
): string {
  const cleanPoints = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  if (cleanPoints.length < 2) {
    return "";
  }
  const segmentLengths = cleanPoints.slice(1).map((point, index) => {
    const previous = cleanPoints[index]!;
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength <= 0) {
    return "";
  }
  const safeMinimum = Math.max(0, minimumInteractiveLengthPx);
  const maxSafeTrim = Math.max(0, (totalLength - safeMinimum) / 2);
  const actualTrim = Math.min(Math.max(0, endpointExclusionPx), maxSafeTrim);
  const startDistance = actualTrim;
  const endDistance = totalLength - actualTrim;
  const trimmedPoints = [
    pointAtDistance(cleanPoints, segmentLengths, startDistance),
    ...interiorPointsBetween(cleanPoints, segmentLengths, startDistance, endDistance),
    pointAtDistance(cleanPoints, segmentLengths, endDistance),
  ].filter((point, index, array) => {
    const previous = array[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
  if (trimmedPoints.length < 2) {
    return "";
  }
  return trimmedPoints
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${formatPathNumber(point.x)} ${formatPathNumber(
          point.y,
        )}`,
    )
    .join(" ");
}

function interiorPointsBetween(
  points: readonly { x: number; y: number }[],
  segmentLengths: readonly number[],
  startDistance: number,
  endDistance: number,
): { x: number; y: number }[] {
  const interior: { x: number; y: number }[] = [];
  let walked = 0;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    walked += segmentLengths[index]!;
    if (walked > startDistance && walked < endDistance) {
      interior.push(points[index + 1]!);
    }
  }
  return interior;
}

function pointAtDistance(
  points: readonly { x: number; y: number }[],
  segmentLengths: readonly number[],
  distance: number,
): { x: number; y: number } {
  let walked = 0;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index]!;
    const start = points[index]!;
    const end = points[index + 1]!;
    if (length === 0) {
      continue;
    }
    if (walked + length >= distance) {
      const ratio = (distance - walked) / length;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    walked += length;
  }
  return points[points.length - 1]!;
}

function formatPathNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}
