import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = "0.1.0" as const;

export const SchemaVersionSchema = z.literal(CURRENT_SCHEMA_VERSION);

export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

export function compareSchemaVersions(left: string, right: string): number {
  const parse = (version: string) => version.split(".").map((part) => Number(part));
  const leftParts = parse(left);
  const rightParts = parse(right);

  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}
