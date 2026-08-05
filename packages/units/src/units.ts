import {
  canonicalUnitsByDimension,
  type CanonicalUnit,
  type Dimension,
} from "./dimensions";
import { DimensionMismatchError, UnknownUnitError } from "./errors";

export type Unit =
  | "um"
  | "mm"
  | "mm2"
  | "mm3"
  | "uL"
  | "mL"
  | "s"
  | "min"
  | "Pa"
  | "kPa"
  | "mm3/s"
  | "uL/min"
  | "degC"
  | "rad"
  | "deg";

export interface UnitDefinition {
  unit: Unit;
  dimension: Dimension;
  canonicalUnit: CanonicalUnit;
  toCanonical: (value: number) => number;
  fromCanonical: (value: number) => number;
}

export const unitRegistry = {
  um: {
    unit: "um",
    dimension: "length",
    canonicalUnit: "mm",
    toCanonical: (value) => value / 1000,
    fromCanonical: (value) => value * 1000,
  },
  mm: {
    unit: "mm",
    dimension: "length",
    canonicalUnit: "mm",
    toCanonical: (value) => value,
    fromCanonical: (value) => value,
  },
  mm2: {
    unit: "mm2",
    dimension: "area",
    canonicalUnit: "mm2",
    toCanonical: (value) => value,
    fromCanonical: (value) => value,
  },
  mm3: {
    unit: "mm3",
    dimension: "volume",
    canonicalUnit: "mm3",
    toCanonical: (value) => value,
    fromCanonical: (value) => value,
  },
  uL: {
    unit: "uL",
    dimension: "volume",
    canonicalUnit: "mm3",
    toCanonical: (value) => value,
    fromCanonical: (value) => value,
  },
  mL: {
    unit: "mL",
    dimension: "volume",
    canonicalUnit: "mm3",
    toCanonical: (value) => value * 1000,
    fromCanonical: (value) => value / 1000,
  },
  s: {
    unit: "s",
    dimension: "time",
    canonicalUnit: "s",
    toCanonical: (value) => value,
    fromCanonical: (value) => value,
  },
  min: {
    unit: "min",
    dimension: "time",
    canonicalUnit: "s",
    toCanonical: (value) => value * 60,
    fromCanonical: (value) => value / 60,
  },
  Pa: {
    unit: "Pa",
    dimension: "pressure",
    canonicalUnit: "Pa",
    toCanonical: (value) => value,
    fromCanonical: (value) => value,
  },
  kPa: {
    unit: "kPa",
    dimension: "pressure",
    canonicalUnit: "Pa",
    toCanonical: (value) => value * 1000,
    fromCanonical: (value) => value / 1000,
  },
  "mm3/s": {
    unit: "mm3/s",
    dimension: "flow-rate",
    canonicalUnit: "mm3/s",
    toCanonical: (value) => value,
    fromCanonical: (value) => value,
  },
  "uL/min": {
    unit: "uL/min",
    dimension: "flow-rate",
    canonicalUnit: "mm3/s",
    toCanonical: (value) => value / 60,
    fromCanonical: (value) => value * 60,
  },
  degC: {
    unit: "degC",
    dimension: "temperature",
    canonicalUnit: "degC",
    toCanonical: (value) => value,
    fromCanonical: (value) => value,
  },
  rad: {
    unit: "rad",
    dimension: "angle",
    canonicalUnit: "rad",
    toCanonical: (value) => value,
    fromCanonical: (value) => value,
  },
  deg: {
    unit: "deg",
    dimension: "angle",
    canonicalUnit: "rad",
    toCanonical: (value) => (value * Math.PI) / 180,
    fromCanonical: (value) => (value * 180) / Math.PI,
  },
} as const satisfies Record<Unit, UnitDefinition>;

export function getUnitDefinition(unit: string): UnitDefinition {
  const definition = unitRegistry[unit as Unit];
  if (!definition) {
    throw new UnknownUnitError(unit);
  }
  return definition;
}

export function assertUnitDimension(
  unit: string,
  dimension: Dimension,
): UnitDefinition {
  const definition = getUnitDefinition(unit);
  if (definition.dimension !== dimension) {
    throw new DimensionMismatchError(dimension, definition.dimension);
  }
  return definition;
}

export function getCanonicalUnit(dimension: Dimension): CanonicalUnit {
  return canonicalUnitsByDimension[dimension];
}
