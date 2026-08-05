import { z } from "zod";

import { ChipIdSchema, LayerIdSchema, MaterialIdSchema } from "../ids";
import { MetadataSchema } from "../metadata";
import { BoxDimensionsSchema } from "../quantities";

export const ChipSchema = z
  .object({
    id: ChipIdSchema,
    name: z.string().min(1),
    overallDimensions: BoxDimensionsSchema,
    layerIds: z.array(LayerIdSchema),
    materialId: MaterialIdSchema.optional(),
    metadata: MetadataSchema,
  })
  .strict();

export type Chip = z.infer<typeof ChipSchema>;
