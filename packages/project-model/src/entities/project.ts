import { z } from "zod";

import { ChipSchema } from "./chip";
import { ComponentSchema } from "./component";
import { ConnectionSchema } from "./connection";
import { ExportConfigurationSchema } from "./export-configuration";
import { FluidSchema } from "./fluid";
import { LaneSchema } from "./lane";
import { LayerSchema } from "./layer";
import { ManufacturingProcessSchema } from "./manufacturing-process";
import { MaterialSchema } from "./material";
import { PortSchema } from "./port";
import { ValidationResultSchema } from "./validation-result";
import { ProjectIdSchema } from "../ids";
import { ExtensionsSchema, ISO8601StringSchema, MetadataSchema } from "../metadata";
import { SchemaVersionSchema } from "../version";

export const ProjectSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: ProjectIdSchema,
    name: z.string().min(1),
    createdAt: ISO8601StringSchema,
    updatedAt: ISO8601StringSchema,
    chip: ChipSchema,
    layers: z.array(LayerSchema),
    lanes: z.array(LaneSchema),
    components: z.array(ComponentSchema),
    ports: z.array(PortSchema),
    connections: z.array(ConnectionSchema),
    fluids: z.array(FluidSchema),
    materials: z.array(MaterialSchema),
    manufacturingProcesses: z.array(ManufacturingProcessSchema),
    validationResults: z.array(ValidationResultSchema),
    exportConfiguration: ExportConfigurationSchema,
    metadata: MetadataSchema,
    extensions: ExtensionsSchema,
  })
  .strict();

export type Project = z.infer<typeof ProjectSchema>;
