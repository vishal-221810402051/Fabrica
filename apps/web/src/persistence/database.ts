import { openDB } from "idb";

import { ProjectStorageError } from "./storageErrors";
import type { FabricgammaDatabaseConnection } from "./projectStorage.types";

export const DATABASE_NAME = "fabricgamma";
export const DATABASE_VERSION = 1;
export const PROJECT_STORE_NAME = "projects";

let databasePromise: Promise<FabricgammaDatabaseConnection> | null = null;

export function initializeStorage(): Promise<FabricgammaDatabaseConnection> {
  databasePromise ??= openDatabase();
  return databasePromise;
}

export async function closeStorage(): Promise<void> {
  const database = await databasePromise;
  database?.close();
  databasePromise = null;
}

export function resetStorageConnectionForTests(): void {
  databasePromise = null;
}

async function openDatabase(): Promise<FabricgammaDatabaseConnection> {
  try {
    return await openDB(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(PROJECT_STORE_NAME)) {
          const store = database.createObjectStore(PROJECT_STORE_NAME, {
            keyPath: "localProjectId",
          });
          store.createIndex("openedAt", "openedAt");
          store.createIndex("locallySavedAt", "locallySavedAt");
          store.createIndex("projectId", "project.id");
        }
      },
      blocked() {
        throw new ProjectStorageError(
          "open-failed",
          "Browser storage upgrade is blocked by another open tab",
        );
      },
      blocking() {
        databasePromise = null;
      },
    });
  } catch (error) {
    if (error instanceof ProjectStorageError) {
      throw error;
    }
    throw new ProjectStorageError(
      "open-failed",
      "Browser storage could not open",
      error,
    );
  }
}
