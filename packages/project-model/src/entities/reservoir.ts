import { z } from "zod";

import { BoxDimensionsSchema, PositiveVolumeQuantitySchema } from "../quantities";

export const ReservoirSchema = z
  .object({
    category: z.enum(["inlet", "outlet", "reagent", "waste", "buffer", "generic"]),
    dimensions: BoxDimensionsSchema,
    declaredCapacity: PositiveVolumeQuantitySchema.optional(),
  })
  .strict();

export type Reservoir = z.infer<typeof ReservoirSchema>;
