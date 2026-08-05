import { z } from "zod";

import { ComponentIdSchema, LaneIdSchema } from "../ids";
import { MetadataSchema } from "../metadata";

export const LaneSchema = z
  .object({
    id: LaneIdSchema,
    name: z.string().min(1),
    componentIds: z.array(ComponentIdSchema),
    metadata: MetadataSchema,
  })
  .strict();

export type Lane = z.infer<typeof LaneSchema>;
