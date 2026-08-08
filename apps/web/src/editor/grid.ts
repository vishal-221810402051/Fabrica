import { PHYSICAL_SNAP_MM } from "geometry-core";

import type { Point } from "./editor.types";
import { editorError } from "./editorErrors";

export const GRID_SIZE_MM = PHYSICAL_SNAP_MM;

export function snapToGrid(value: number, gridSize = GRID_SIZE_MM): number {
  if (!Number.isFinite(value)) {
    throw editorError("EDITOR_NONFINITE_POSITION", "Position must be finite");
  }
  return Number((Math.round(value / gridSize) * gridSize).toFixed(6));
}

export function snapPoint(point: Point, gridSize = GRID_SIZE_MM): Point {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize),
  };
}
