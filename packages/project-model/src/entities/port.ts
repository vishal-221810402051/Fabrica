import { z } from "zod";

import { ComponentIdSchema, FluidIdSchema, PortIdSchema } from "../ids";
import { MetadataSchema } from "../metadata";

export const PortDirectionSchema = z.enum(["input", "output", "bidirectional"]);

export const PortSchema = z
  .object({
    id: PortIdSchema,
    componentId: ComponentIdSchema,
    name: z.string().min(1),
    direction: PortDirectionSchema,
    fluidId: FluidIdSchema.optional(),
    metadata: MetadataSchema,
  })
  .strict();

export type Port = z.infer<typeof PortSchema>;
