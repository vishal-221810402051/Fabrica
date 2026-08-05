import { z } from "zod";

import { PositiveLengthQuantitySchema } from "../quantities";

const BaseChannelSchema = z
  .object({
    length: PositiveLengthQuantitySchema,
    bendRadius: PositiveLengthQuantitySchema.optional(),
  })
  .strict();

export const RectangularChannelSchema = BaseChannelSchema.extend({
  crossSection: z.literal("rectangular"),
  width: PositiveLengthQuantitySchema,
  depth: PositiveLengthQuantitySchema,
}).strict();

export const CircularChannelSchema = BaseChannelSchema.extend({
  crossSection: z.literal("circular"),
  diameter: PositiveLengthQuantitySchema,
}).strict();

export const TrapezoidalChannelSchema = BaseChannelSchema.extend({
  crossSection: z.literal("trapezoidal"),
  width: PositiveLengthQuantitySchema,
  depth: PositiveLengthQuantitySchema,
}).strict();

export const ChannelSchema = z.discriminatedUnion("crossSection", [
  RectangularChannelSchema,
  CircularChannelSchema,
  TrapezoidalChannelSchema,
]);

export type Channel = z.infer<typeof ChannelSchema>;
