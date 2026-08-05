import {
  STORAGE_VERSION,
  StorageVersionError,
  validateProjectRecord,
  type ProjectRecord,
} from "../projects/projectRecord";

export function migrateProjectRecord(input: unknown): ProjectRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Stored project record must be an object");
  }

  const version = Reflect.get(input, "storageVersion");
  if (version === STORAGE_VERSION) {
    return validateProjectRecord(structuredClone(input));
  }

  throw new StorageVersionError(version);
}
