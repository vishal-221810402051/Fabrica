import { z } from "zod";

import { MetadataSchema } from "../metadata";

export const ValveSchema = z
  .object({
    category: z.enum(["pneumatic", "membrane", "mechanical", "capillary", "generic"]),
    normallyOpen: z.boolean().optional(),
    actuatorInterface: MetadataSchema.optional(),
  })
  .strict();

export type Valve = z.infer<typeof ValveSchema>;
