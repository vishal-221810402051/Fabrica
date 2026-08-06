import type { Point } from "./editor.types";
import { editorError } from "./editorErrors";

export const GRID_SIZE_MM = 1;

export function snapToGrid(value: number, gridSize = GRID_SIZE_MM): number {
  if (!Number.isFinite(value)) {
    throw editorError("EDITOR_NONFINITE_POSITION", "Position must be finite");
  }
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(point: Point, gridSize = GRID_SIZE_MM): Point {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize),
  };
}
