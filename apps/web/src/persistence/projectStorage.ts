import * as projectModel from "project-model";

import { initializeStorage, PROJECT_STORE_NAME } from "./database";
import type {
  CorruptProjectRecordSummary,
  FabricgammaDatabaseConnection,
} from "./projectStorage.types";
import { classifyStorageError, ProjectStorageError } from "./storageErrors";
import { migrateProjectRecord } from "./storageMigrations";
import {
  createProjectRecord,
  limitedRecordSummary,
  nowIso,
  validateProjectRecord,
  type ProjectRecord,
} from "../projects/projectRecord";
import { duplicateProject } from "../projects/duplicateProject";

export async function saveProjectRecord(record: ProjectRecord): Promise<ProjectRecord> {
  const database = await initializeStorage();
  const validated = validateProjectRecord(record);

  try {
    const transaction = database.transaction(PROJECT_STORE_NAME, "readwrite");
    const existing = await transaction.store.get(validated.localProjectId);
    if (existing) {
      const existingRecord = validateProjectRecord(existing);
      const existingProject = projectModel.stringifyProject(existingRecord.project);
      const nextProject = projectModel.stringifyProject(validated.project);
      if (
        existingRecord.revision > validated.revision ||
        (existingRecord.revision === validated.revision &&
          existingProject !== nextProject)
      ) {
        throw new ProjectStorageError(
          "revision-conflict",
          `Local project ${validated.localProjectId} has a newer stored revision`,
        );
      }
    }
    await transaction.store.put(validated);
    await transaction.done;
    return validated;
  } catch (error) {
    throw classifyStorageError(error);
  }
}

export async function loadProjectRecord(
  localProjectId: string,
): Promise<ProjectRecord> {
  const database = await initializeStorage();
  const raw = await database.get(PROJECT_STORE_NAME, localProjectId);
  if (!raw) {
    throw new ProjectStorageError(
      "not-found",
      `Local project ${localProjectId} was not found`,
    );
  }

  try {
    return migrateProjectRecord(raw);
  } catch (error) {
    throw new ProjectStorageError(
      "invalid-record",
      error instanceof Error ? error.message : "Stored project record is invalid",
      error,
    );
  }
}

export async function listProjectRecords(): Promise<ProjectRecord[]> {
  const database = await initializeStorage();
  const records = await database.getAll(PROJECT_STORE_NAME);
  return records
    .map((record) => {
      try {
        return migrateProjectRecord(record);
      } catch {
        return null;
      }
    })
    .filter((record): record is ProjectRecord => record !== null)
    .sort(
      (left, right) =>
        right.openedAt.localeCompare(left.openedAt) ||
        left.localProjectId.localeCompare(right.localProjectId),
    );
}

export async function listCorruptProjectRecords(): Promise<
  CorruptProjectRecordSummary[]
> {
  const database = await initializeStorage();
  const records = await database.getAll(PROJECT_STORE_NAME);
  const corrupt: CorruptProjectRecordSummary[] = [];

  for (const record of records) {
    try {
      migrateProjectRecord(record);
    } catch (error) {
      const summary = limitedRecordSummary(record);
      if (summary) {
        corrupt.push({
          ...summary,
          error: error instanceof Error ? error.message : "Stored record is invalid",
        });
      }
    }
  }

  return corrupt.sort(
    (left, right) =>
      (right.openedAt ?? "").localeCompare(left.openedAt ?? "") ||
      left.localProjectId.localeCompare(right.localProjectId),
  );
}

export async function deleteProjectRecord(localProjectId: string): Promise<void> {
  const database = await initializeStorage();
  try {
    const transaction = database.transaction(PROJECT_STORE_NAME, "readwrite");
    await transaction.store.delete(localProjectId);
    await transaction.done;
  } catch (error) {
    throw classifyStorageError(error);
  }
}

export async function markProjectOpened(
  localProjectId: string,
  openedAt = nowIso(),
): Promise<ProjectRecord> {
  const record = await loadProjectRecord(localProjectId);
  const opened = validateProjectRecord({ ...record, openedAt });
  return saveProjectRecord(opened);
}

export async function duplicateProjectRecord(
  localProjectId: string,
): Promise<ProjectRecord> {
  const source = await loadProjectRecord(localProjectId);
  const project = duplicateProject(source.project);
  const record = createProjectRecord(project, "duplicated");
  return saveProjectRecord(record);
}

export async function loadMostRecentValidProject(): Promise<ProjectRecord | null> {
  const records = await listProjectRecords();
  for (const record of records) {
    try {
      return validateProjectRecord({
        ...record,
        project: projectModel.parseProject(record.project),
        recoveryState:
          record.autosaveState === "failed" || record.autosaveState === "saving"
            ? "recovered"
            : record.recoveryState,
      });
    } catch {
      continue;
    }
  }
  return null;
}

export async function detectCorruptRecord(localProjectId: string): Promise<boolean> {
  const database = await initializeStorage();
  const raw = await database.get(PROJECT_STORE_NAME, localProjectId);
  if (!raw) {
    return false;
  }
  try {
    migrateProjectRecord(raw);
    return false;
  } catch {
    return true;
  }
}

export async function replaceRawProjectRecordForTests(
  localProjectId: string,
  rawRecord: unknown,
  database?: FabricgammaDatabaseConnection,
): Promise<void> {
  const connection = database ?? (await initializeStorage());
  const transaction = connection.transaction(PROJECT_STORE_NAME, "readwrite");
  await transaction.store.put({
    ...(rawRecord as object),
    localProjectId,
  } as ProjectRecord);
  await transaction.done;
}
