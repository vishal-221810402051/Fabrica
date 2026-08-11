import { z } from "zod";

import { BoxDimensionsSchema } from "../quantities";

export const JunctionSchema = z
  .object({
    category: z.enum(["y", "t", "splitter", "merger", "manifold", "generic"]),
    dimensions: BoxDimensionsSchema.optional(),
  })
  .strict();

export type Junction = z.infer<typeof JunctionSchema>;
