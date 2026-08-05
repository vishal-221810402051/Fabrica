import { z } from "zod";

import { LayerIdSchema, MaterialIdSchema } from "../ids";
import { MetadataSchema } from "../metadata";
import { PositiveLengthQuantitySchema } from "../quantities";

export const LayerSchema = z
  .object({
    id: LayerIdSchema,
    name: z.string().min(1),
    order: z.number().int().nonnegative(),
    thickness: PositiveLengthQuantitySchema,
    materialId: MaterialIdSchema.optional(),
    metadata: MetadataSchema,
  })
  .strict();

export type Layer = z.infer<typeof LayerSchema>;
