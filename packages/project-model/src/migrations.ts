import { FutureVersionError, UnsupportedVersionError } from "./errors";
import { compareSchemaVersions, CURRENT_SCHEMA_VERSION } from "./version";

export type MigrationFunction = (input: unknown) => unknown;

export const migrationRegistry = new Map<string, MigrationFunction>();

export function migrateProjectDocument(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const schemaVersion = Reflect.get(input, "schemaVersion");

  if (typeof schemaVersion !== "string") {
    return input;
  }

  const comparison = compareSchemaVersions(schemaVersion, CURRENT_SCHEMA_VERSION);
  if (comparison === 0) {
    return structuredClone(input);
  }

  if (comparison > 0) {
    throw new FutureVersionError(schemaVersion);
  }

  const migration = migrationRegistry.get(schemaVersion);
  if (!migration) {
    throw new UnsupportedVersionError(schemaVersion);
  }

  return migration(structuredClone(input));
}
