import { z } from "zod";

import { MetadataSchema } from "../metadata";
import { PlanarDimensionsSchema, Position2DSchema } from "../quantities";

export const SensorInterfaceSchema = z
  .object({
    interfaceType: z.enum([
      "electrical",
      "electrochemical",
      "thermal",
      "pressure",
      "generic",
    ]),
    measurementCategory: z
      .enum(["temperature", "pressure", "flow", "conductivity", "optical", "generic"])
      .optional(),
    dimensions: PlanarDimensionsSchema,
    position: Position2DSchema.optional(),
    referenceMetadata: MetadataSchema.optional(),
  })
  .strict();

export type SensorInterface = z.infer<typeof SensorInterfaceSchema>;
