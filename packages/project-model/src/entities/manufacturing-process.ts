import { z } from "zod";

import { ProcessIdSchema } from "../ids";
import { MetadataSchema } from "../metadata";

export const ManufacturingProcessTypeSchema = z.enum([
  "soft-lithography",
  "micromilling",
  "injection-molding",
  "laser-ablation",
  "3d-printing",
  "other",
  "unknown",
]);

export const ManufacturingProcessSchema = z
  .object({
    id: ProcessIdSchema,
    name: z.string().min(1),
    processType: ManufacturingProcessTypeSchema,
    profileReference: z.string().optional(),
    metadata: MetadataSchema,
  })
  .strict();

export type ManufacturingProcess = z.infer<typeof ManufacturingProcessSchema>;
