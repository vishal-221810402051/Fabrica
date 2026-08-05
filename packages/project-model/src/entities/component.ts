import { z } from "zod";

import { ComponentIdSchema, LaneIdSchema, LayerIdSchema, PortIdSchema } from "../ids";
import { ExtensionsSchema, MetadataSchema } from "../metadata";
import {
  AngleQuantitySchema,
  BoxDimensionsSchema,
  PlanarDimensionsSchema,
  Position2DSchema,
} from "../quantities";
import { ChamberSchema } from "./chamber";
import { ChannelSchema } from "./channel";
import { JunctionSchema } from "./junction";
import { OpticalInterfaceSchema } from "./optical-interface";
import { ReservoirSchema } from "./reservoir";
import { SensorInterfaceSchema } from "./sensor-interface";
import { ValveSchema } from "./valve";

const ComponentCommonSchema = z
  .object({
    id: ComponentIdSchema,
    name: z.string().min(1),
    laneId: LaneIdSchema.optional(),
    layerId: LayerIdSchema,
    position: Position2DSchema,
    rotation: AngleQuantitySchema,
    portIds: z.array(PortIdSchema),
    metadata: MetadataSchema,
    extensions: ExtensionsSchema,
  })
  .strict();

export const ChannelComponentSchema = ComponentCommonSchema.extend({
  kind: z.literal("channel"),
  channel: ChannelSchema,
}).strict();

export const JunctionComponentSchema = ComponentCommonSchema.extend({
  kind: z.literal("junction"),
  junction: JunctionSchema,
}).strict();

export const ChamberComponentSchema = ComponentCommonSchema.extend({
  kind: z.literal("chamber"),
  chamber: ChamberSchema,
}).strict();

export const ReservoirComponentSchema = ComponentCommonSchema.extend({
  kind: z.literal("reservoir"),
  reservoir: ReservoirSchema,
}).strict();

export const ValveComponentSchema = ComponentCommonSchema.extend({
  kind: z.literal("valve"),
  valve: ValveSchema,
}).strict();

export const SensorInterfaceComponentSchema = ComponentCommonSchema.extend({
  kind: z.literal("sensor-interface"),
  sensorInterface: SensorInterfaceSchema,
}).strict();

export const OpticalInterfaceComponentSchema = ComponentCommonSchema.extend({
  kind: z.literal("optical-interface"),
  opticalInterface: OpticalInterfaceSchema,
}).strict();

export const GenericComponentSchema = ComponentCommonSchema.extend({
  kind: z.literal("generic"),
  dimensions: z.union([PlanarDimensionsSchema, BoxDimensionsSchema]).optional(),
}).strict();

export const ComponentSchema = z.discriminatedUnion("kind", [
  ChannelComponentSchema,
  JunctionComponentSchema,
  ChamberComponentSchema,
  ReservoirComponentSchema,
  ValveComponentSchema,
  SensorInterfaceComponentSchema,
  OpticalInterfaceComponentSchema,
  GenericComponentSchema,
]);

export type Component = z.infer<typeof ComponentSchema>;
