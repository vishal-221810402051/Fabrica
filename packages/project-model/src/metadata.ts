import { z } from "zod";

const JsonLiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    JsonLiteralSchema,
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export const MetadataSchema = z.record(z.string(), JsonValueSchema);

export const ExtensionsSchema = z.record(
  z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/),
  JsonValueSchema,
);

export const ISO8601StringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);

export type Metadata = z.infer<typeof MetadataSchema>;
export type Extensions = z.infer<typeof ExtensionsSchema>;
