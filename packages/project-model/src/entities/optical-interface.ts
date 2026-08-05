import { z } from "zod";

import { MetadataSchema } from "../metadata";
import { PlanarDimensionsSchema, Position2DSchema } from "../quantities";

export const OpticalInterfaceSchema = z
  .object({
    interfaceType: z.enum([
      "window",
      "waveguide",
      "fiber-coupling",
      "detection-zone",
      "generic",
    ]),
    measurementCategory: z
      .enum(["absorbance", "fluorescence", "scattering", "imaging", "generic"])
      .optional(),
    dimensions: PlanarDimensionsSchema,
    position: Position2DSchema.optional(),
    referenceMetadata: MetadataSchema.optional(),
  })
  .strict();

export type OpticalInterface = z.infer<typeof OpticalInterfaceSchema>;
