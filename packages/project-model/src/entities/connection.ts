import { z } from "zod";

import { ConnectionIdSchema, PortIdSchema } from "../ids";
import { MetadataSchema } from "../metadata";

export const ConnectionSchema = z
  .object({
    id: ConnectionIdSchema,
    sourcePortId: PortIdSchema,
    targetPortId: PortIdSchema,
    metadata: MetadataSchema,
  })
  .strict();

export type Connection = z.infer<typeof ConnectionSchema>;
