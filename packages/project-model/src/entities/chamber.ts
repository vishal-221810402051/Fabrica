import { z } from "zod";

import { BoxDimensionsSchema, PositiveVolumeQuantitySchema } from "../quantities";

export const ChamberSchema = z
  .object({
    category: z.enum([
      "metering",
      "reaction",
      "incubation",
      "detection",
      "mixing",
      "neutralization",
      "generic",
    ]),
    dimensions: BoxDimensionsSchema,
    declaredVolume: PositiveVolumeQuantitySchema.optional(),
  })
  .strict();

export type Chamber = z.infer<typeof ChamberSchema>;
