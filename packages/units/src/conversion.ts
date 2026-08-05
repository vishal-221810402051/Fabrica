import type { Dimension } from "./dimensions";
import { assertUnitDimension } from "./units";
import type { Unit } from "./units";

export function convertUnitValue(
  value: number,
  fromUnit: Unit,
  toUnit: Unit,
  dimension: Dimension,
): number {
  const from = assertUnitDimension(fromUnit, dimension);
  const to = assertUnitDimension(toUnit, dimension);
  return to.fromCanonical(from.toCanonical(value));
}

export function approximatelyEqual(
  left: number,
  right: number,
  tolerance = 1e-12,
): boolean {
  return Math.abs(left - right) <= tolerance;
}
