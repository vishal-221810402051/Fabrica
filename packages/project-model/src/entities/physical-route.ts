import { z } from "zod";

import { ConnectionIdSchema, LayerIdSchema, RouteIdSchema } from "../ids";
import { MetadataSchema } from "../metadata";
import { Position2DSchema, PositiveLengthQuantitySchema } from "../quantities";

export const StraightRoutePatternSchema = z
  .object({
    kind: z.literal("straight"),
  })
  .strict();

export const ManualRoutePatternSchema = z
  .object({
    kind: z.literal("manual"),
    waypoints: z.array(Position2DSchema),
  })
  .strict();

export const SerpentineExplicitSizingSchema = z
  .object({
    mode: z.literal("explicit"),
    amplitude: PositiveLengthQuantitySchema,
  })
  .strict();

export const SerpentineTargetLengthSizingSchema = z
  .object({
    mode: z.literal("target-length"),
    targetLength: PositiveLengthQuantitySchema,
  })
  .strict();

export const SerpentineAutoPlacementSchema = z
  .object({
    mode: z.literal("auto"),
  })
  .strict();

export const SerpentineManualPlacementSchema = z
  .object({
    mode: z.literal("manual"),
    coreCenter: Position2DSchema,
  })
  .strict();

export const SerpentinePlacementSchema = z.discriminatedUnion("mode", [
  SerpentineAutoPlacementSchema,
  SerpentineManualPlacementSchema,
]);

export const SerpentineRoutePatternSchema = z
  .object({
    kind: z.literal("serpentine"),
    turnCount: z.number().int().positive(),
    pitch: PositiveLengthQuantitySchema,
    axis: z.enum(["auto", "horizontal", "vertical"]),
    entranceLength: PositiveLengthQuantitySchema.optional(),
    exitLength: PositiveLengthQuantitySchema.optional(),
    sizing: z.discriminatedUnion("mode", [
      SerpentineExplicitSizingSchema,
      SerpentineTargetLengthSizingSchema,
    ]),
    placement: SerpentinePlacementSchema,
  })
  .strict();

export const RoutePatternSchema = z.discriminatedUnion("kind", [
  StraightRoutePatternSchema,
  ManualRoutePatternSchema,
  SerpentineRoutePatternSchema,
]);

export const PhysicalRouteSchema = z
  .object({
    id: RouteIdSchema,
    connectionId: ConnectionIdSchema,
    layerId: LayerIdSchema,
    pattern: RoutePatternSchema,
    width: PositiveLengthQuantitySchema.optional(),
    depth: PositiveLengthQuantitySchema.optional(),
    bendRadius: PositiveLengthQuantitySchema.optional(),
    metadata: MetadataSchema,
  })
  .strict();

export type PhysicalRoute = z.infer<typeof PhysicalRouteSchema>;
export type RoutePattern = z.infer<typeof RoutePatternSchema>;
export type SerpentinePlacement = z.infer<typeof SerpentinePlacementSchema>;
