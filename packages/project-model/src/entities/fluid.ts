import { z } from "zod";

import { FluidIdSchema } from "../ids";
import { MetadataSchema } from "../metadata";

export const FluidCategorySchema = z.enum([
  "aqueous",
  "oil",
  "buffer",
  "reagent",
  "sample",
  "waste",
  "gas",
  "unknown",
]);

export const FluidSchema = z
  .object({
    id: FluidIdSchema,
    name: z.string().min(1),
    category: FluidCategorySchema,
    manufacturer: z.string().optional(),
    reference: z.string().optional(),
    metadata: MetadataSchema,
  })
  .strict();

export type Fluid = z.infer<typeof FluidSchema>;
