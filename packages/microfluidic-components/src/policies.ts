import type { LanePolicy, LayerPolicy } from "./types";

export const defaultLayerPolicy: LayerPolicy = "same-layer";
export const defaultLanePolicy: LanePolicy = "optional";

export function isLayerCompatible(
  policy: LayerPolicy,
  sourceLayerId: string,
  targetLayerId: string,
): boolean {
  return policy === "layer-agnostic" || sourceLayerId === targetLayerId;
}

export function isLaneCompatible(input: {
  sourceLanePolicy: LanePolicy;
  targetLanePolicy: LanePolicy;
  sourceLaneId?: string;
  targetLaneId?: string;
}): boolean {
  if (input.sourceLanePolicy === "shared" || input.targetLanePolicy === "shared") {
    return true;
  }
  if (
    input.sourceLanePolicy === "forbidden" ||
    input.targetLanePolicy === "forbidden"
  ) {
    return true;
  }
  if (input.sourceLaneId && input.targetLaneId) {
    return input.sourceLaneId === input.targetLaneId;
  }
  return !input.sourceLaneId && !input.targetLaneId;
}
