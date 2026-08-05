import type { CanonicalUnit, Dimension } from "./dimensions";
import { InvalidQuantityError } from "./errors";
import type { Unit } from "./units";
import { assertUnitDimension, getCanonicalUnit } from "./units";
import type { ValueProvenance } from "./provenance";

export interface NormalizedQuantity<
  TDimension extends Dimension,
  TUnit extends CanonicalUnit,
> {
  value: number;
  unit: TUnit;
  provenance: ValueProvenance;
  dimension: TDimension;
}

export type LengthQuantity = NormalizedQuantity<"length", "mm">;
export type AreaQuantity = NormalizedQuantity<"area", "mm2">;
export type VolumeQuantity = NormalizedQuantity<"volume", "mm3">;
export type TimeQuantity = NormalizedQuantity<"time", "s">;
export type PressureQuantity = NormalizedQuantity<"pressure", "Pa">;
export type FlowRateQuantity = NormalizedQuantity<"flow-rate", "mm3/s">;
export type TemperatureQuantity = NormalizedQuantity<"temperature", "degC">;
export type AngleQuantity = NormalizedQuantity<"angle", "rad">;

export type EngineeringQuantity =
  | LengthQuantity
  | AreaQuantity
  | VolumeQuantity
  | TimeQuantity
  | PressureQuantity
  | FlowRateQuantity
  | TemperatureQuantity
  | AngleQuantity;

export interface QuantityInput {
  value: number;
  unit: Unit;
  provenance: ValueProvenance;
}

function assertFiniteNumber(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidQuantityError("Quantity value must be a finite number");
  }
}

export function normalizeQuantity<TDimension extends Dimension>(
  input: QuantityInput,
  dimension: TDimension,
): NormalizedQuantity<TDimension, Extract<CanonicalUnit, string>> {
  assertFiniteNumber(input.value);

  if (!input.unit) {
    throw new InvalidQuantityError("Quantity unit is required");
  }

  const definition = assertUnitDimension(input.unit, dimension);
  return {
    value: definition.toCanonical(input.value),
    unit: getCanonicalUnit(dimension) as Extract<CanonicalUnit, string>,
    provenance: input.provenance,
    dimension,
  };
}

export function createLengthQuantity(input: QuantityInput): LengthQuantity {
  return normalizeQuantity(input, "length") as LengthQuantity;
}

export function createAreaQuantity(input: QuantityInput): AreaQuantity {
  return normalizeQuantity(input, "area") as AreaQuantity;
}

export function createVolumeQuantity(input: QuantityInput): VolumeQuantity {
  return normalizeQuantity(input, "volume") as VolumeQuantity;
}

export function createTimeQuantity(input: QuantityInput): TimeQuantity {
  return normalizeQuantity(input, "time") as TimeQuantity;
}

export function createPressureQuantity(input: QuantityInput): PressureQuantity {
  return normalizeQuantity(input, "pressure") as PressureQuantity;
}

export function createFlowRateQuantity(input: QuantityInput): FlowRateQuantity {
  return normalizeQuantity(input, "flow-rate") as FlowRateQuantity;
}

export function createTemperatureQuantity(input: QuantityInput): TemperatureQuantity {
  return normalizeQuantity(input, "temperature") as TemperatureQuantity;
}

export function createAngleQuantity(input: QuantityInput): AngleQuantity {
  return normalizeQuantity(input, "angle") as AngleQuantity;
}
