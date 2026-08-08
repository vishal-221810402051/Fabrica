import { z } from "zod";

import { ConnectionIdSchema, LayerIdSchema, RouteIdSchema } from "../ids";
import { MetadataSchema } from "../metadata";
import { Position2DSchema, PositiveLengthQuantitySchema } from "../quantities";

export const PhysicalRouteSchema = z
  .object({
    id: RouteIdSchema,
    connectionId: ConnectionIdSchema,
    layerId: LayerIdSchema,
    waypoints: z.array(Position2DSchema),
    width: PositiveLengthQuantitySchema.optional(),
    depth: PositiveLengthQuantitySchema.optional(),
    bendRadius: PositiveLengthQuantitySchema.optional(),
    metadata: MetadataSchema,
  })
  .strict();

export type PhysicalRoute = z.infer<typeof PhysicalRouteSchema>;
