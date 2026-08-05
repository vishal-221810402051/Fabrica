import { z } from "zod";

import { provenanceSources } from "units";

export const ProvenanceSchema = z
  .object({
    source: z.enum(provenanceSources),
    note: z.string().optional(),
    reference: z.string().optional(),
    timestamp: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)
      .optional(),
    actor: z.string().optional(),
  })
  .strict();

const FiniteNumberSchema = z.number().finite();
const PositiveFiniteNumberSchema = z.number().finite().positive();

function normalizedQuantitySchema<TUnit extends string>(
  unit: TUnit,
  valueSchema = FiniteNumberSchema,
) {
  return z
    .object({
      value: valueSchema,
      unit: z.literal(unit),
      provenance: ProvenanceSchema,
    })
    .strict();
}

export const LengthQuantitySchema = normalizedQuantitySchema("mm");
export const PositiveLengthQuantitySchema = normalizedQuantitySchema(
  "mm",
  PositiveFiniteNumberSchema,
);
export const AreaQuantitySchema = normalizedQuantitySchema("mm2");
export const PositiveAreaQuantitySchema = normalizedQuantitySchema(
  "mm2",
  PositiveFiniteNumberSchema,
);
export const VolumeQuantitySchema = normalizedQuantitySchema("mm3");
export const PositiveVolumeQuantitySchema = normalizedQuantitySchema(
  "mm3",
  PositiveFiniteNumberSchema,
);
export const TimeQuantitySchema = normalizedQuantitySchema("s");
export const PositiveTimeQuantitySchema = normalizedQuantitySchema(
  "s",
  PositiveFiniteNumberSchema,
);
export const PressureQuantitySchema = normalizedQuantitySchema("Pa");
export const FlowRateQuantitySchema = normalizedQuantitySchema("mm3/s");
export const TemperatureQuantitySchema = normalizedQuantitySchema("degC");
export const AngleQuantitySchema = normalizedQuantitySchema("rad");

export const Position2DSchema = z
  .object({
    x: LengthQuantitySchema,
    y: LengthQuantitySchema,
  })
  .strict();

export const PlanarDimensionsSchema = z
  .object({
    width: PositiveLengthQuantitySchema,
    height: PositiveLengthQuantitySchema,
  })
  .strict();

export const BoxDimensionsSchema = z
  .object({
    width: PositiveLengthQuantitySchema,
    height: PositiveLengthQuantitySchema,
    depth: PositiveLengthQuantitySchema,
  })
  .strict();

export type Provenance = z.infer<typeof ProvenanceSchema>;
export type LengthQuantity = z.infer<typeof LengthQuantitySchema>;
export type VolumeQuantity = z.infer<typeof VolumeQuantitySchema>;
export type AngleQuantity = z.infer<typeof AngleQuantitySchema>;
