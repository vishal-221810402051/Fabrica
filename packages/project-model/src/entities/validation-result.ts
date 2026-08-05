import { z } from "zod";

import {
  ComponentIdSchema,
  ConnectionIdSchema,
  LayerIdSchema,
  PortIdSchema,
  ResultIdSchema,
} from "../ids";
import { ISO8601StringSchema, MetadataSchema } from "../metadata";

export const ValidationSeveritySchema = z.enum([
  "error",
  "critical-warning",
  "warning",
  "recommendation",
  "information",
]);

export const ValidationEntityReferenceSchema = z
  .object({
    entityType: z.enum(["layer", "component", "port", "connection"]),
    entityId: z.union([
      LayerIdSchema,
      ComponentIdSchema,
      PortIdSchema,
      ConnectionIdSchema,
    ]),
  })
  .strict();

export const ValidationResultSchema = z
  .object({
    id: ResultIdSchema,
    ruleId: z.string().min(1),
    severity: ValidationSeveritySchema,
    message: z.string().min(1),
    entityReferences: z.array(ValidationEntityReferenceSchema),
    createdAt: ISO8601StringSchema,
    metadata: MetadataSchema,
  })
  .strict();

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
