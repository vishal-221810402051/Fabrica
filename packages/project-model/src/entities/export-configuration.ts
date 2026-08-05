import { z } from "zod";

import { MetadataSchema } from "../metadata";

export const ExportConfigurationSchema = z
  .object({
    requestedFormats: z.array(z.enum(["json", "step", "stl"])),
    includeValidationResults: z.boolean(),
    metadata: MetadataSchema,
  })
  .strict();

export type ExportConfiguration = z.infer<typeof ExportConfigurationSchema>;
