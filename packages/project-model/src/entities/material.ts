import { z } from "zod";

import { MaterialIdSchema } from "../ids";
import { MetadataSchema } from "../metadata";

export const MaterialCategorySchema = z.enum([
  "pdms",
  "glass",
  "silicon",
  "thermoplastic",
  "metal",
  "adhesive",
  "other",
  "unknown",
]);

export const MaterialSchema = z
  .object({
    id: MaterialIdSchema,
    name: z.string().min(1),
    category: MaterialCategorySchema,
    manufacturer: z.string().optional(),
    reference: z.string().optional(),
    metadata: MetadataSchema,
  })
  .strict();

export type Material = z.infer<typeof MaterialSchema>;
