import * as projectModel from "project-model";
import type { Project } from "project-model";

export const STORAGE_VERSION = 1;

export type ProjectRecordSource = "new" | "imported" | "duplicated" | "recovered";
export type AutosaveState = "clean" | "pending" | "saving" | "failed";
export type RecoveryState = "normal" | "recovered" | "corrupt";

export interface ProjectRecord {
  storageVersion: typeof STORAGE_VERSION;
  localProjectId: string;
  project: Project;
  revision: number;
  savedRevision: number;
  createdAt: string;
  openedAt: string;
  locallySavedAt: string | null;
  lastExportedAt: string | null;
  lastExportedRevision: number | null;
  source: ProjectRecordSource;
  importedFilename?: string;
  autosaveState: AutosaveState;
  recoveryState: RecoveryState;
  checksum?: string;
}

export type ProjectRecordMetadata = Omit<ProjectRecord, "project">;

export interface RecentProjectSummary extends ProjectRecordMetadata {
  projectId: string;
  projectName: string;
  schemaVersion: string;
}

const allowedRecordKeys = new Set([
  "storageVersion",
  "localProjectId",
  "project",
  "revision",
  "savedRevision",
  "createdAt",
  "openedAt",
  "locallySavedAt",
  "lastExportedAt",
  "lastExportedRevision",
  "source",
  "importedFilename",
  "autosaveState",
  "recoveryState",
  "checksum",
]);

const forbiddenJsonKeys = new Set(["__proto__", "constructor", "prototype"]);

export function createLocalProjectId(): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? fallbackRandomId();
  return `local_${randomId}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function sanitizeImportedFilename(filename: string): string {
  return sanitizeText(filename).replace(/\.+/g, ".").replace(/^\.+/, "").slice(0, 160);
}

export function recordMetadata(record: ProjectRecord): ProjectRecordMetadata {
  const metadata = { ...record };
  delete (metadata as Partial<ProjectRecord>).project;
  return metadata;
}

export function recentProjectSummary(record: ProjectRecord): RecentProjectSummary {
  return {
    ...recordMetadata(record),
    projectId: record.project.id,
    projectName: record.project.name,
    schemaVersion: record.project.schemaVersion,
  };
}

export function recordFromState(
  project: Project,
  metadata: ProjectRecordMetadata,
): ProjectRecord {
  return validateProjectRecord({ ...metadata, project });
}

export function maybeRecordFromState(state: {
  project: Project | null;
  metadata: ProjectRecordMetadata | null;
}): ProjectRecord | null {
  if (!state.project || !state.metadata) {
    return null;
  }
  return recordFromState(state.project, state.metadata);
}

export function createProjectRecord(
  project: Project,
  source: ProjectRecordSource,
  options: {
    localProjectId?: string;
    importedFilename?: string;
    now?: string;
  } = {},
): ProjectRecord {
  const timestamp = options.now ?? nowIso();
  const parsedProject = projectModel.parseProject(project);
  return {
    storageVersion: STORAGE_VERSION,
    localProjectId: options.localProjectId ?? createLocalProjectId(),
    project: parsedProject,
    revision: 0,
    savedRevision: 0,
    createdAt: timestamp,
    openedAt: timestamp,
    locallySavedAt: null,
    lastExportedAt: null,
    lastExportedRevision: null,
    source,
    ...(options.importedFilename
      ? { importedFilename: sanitizeImportedFilename(options.importedFilename) }
      : {}),
    autosaveState: "clean",
    recoveryState: source === "recovered" ? "recovered" : "normal",
  };
}

export function validateProjectRecord(input: unknown): ProjectRecord {
  assertPlainObject(input, "record");
  rejectUnknownKeys(input, allowedRecordKeys, "record");

  if (input.storageVersion !== STORAGE_VERSION) {
    throw new StorageVersionError(input.storageVersion);
  }

  const project = projectModel.parseProject(input.project);
  const record: ProjectRecord = {
    storageVersion: STORAGE_VERSION,
    localProjectId: requireString(input.localProjectId, "localProjectId"),
    project,
    revision: requireNonNegativeInteger(input.revision, "revision"),
    savedRevision: requireNonNegativeInteger(input.savedRevision, "savedRevision"),
    createdAt: requireIsoString(input.createdAt, "createdAt"),
    openedAt: requireIsoString(input.openedAt, "openedAt"),
    locallySavedAt: requireNullableIsoString(input.locallySavedAt, "locallySavedAt"),
    lastExportedAt: requireNullableIsoString(input.lastExportedAt, "lastExportedAt"),
    lastExportedRevision:
      input.lastExportedRevision === null
        ? null
        : requireNonNegativeInteger(input.lastExportedRevision, "lastExportedRevision"),
    source: requireEnum(
      input.source,
      ["new", "imported", "duplicated", "recovered"],
      "source",
    ),
    autosaveState: requireEnum(
      input.autosaveState,
      ["clean", "pending", "saving", "failed"],
      "autosaveState",
    ),
    recoveryState: requireEnum(
      input.recoveryState,
      ["normal", "recovered", "corrupt"],
      "recoveryState",
    ),
  };

  if ("importedFilename" in input) {
    record.importedFilename = sanitizeImportedFilename(
      requireString(input.importedFilename, "importedFilename"),
    );
  }
  if ("checksum" in input) {
    record.checksum = requireString(input.checksum, "checksum");
  }
  if (record.savedRevision > record.revision) {
    throw new Error("savedRevision cannot be greater than revision");
  }
  if (
    record.lastExportedRevision !== null &&
    record.lastExportedRevision > record.revision
  ) {
    throw new Error("lastExportedRevision cannot be greater than revision");
  }

  return record;
}

export function assertSafeJsonInput(
  input: unknown,
  maxDepth = 80,
  maxNodes = 10_000,
): void {
  let nodeCount = 0;

  const visit = (value: unknown, depth: number, path: string) => {
    if (depth > maxDepth) {
      throw new Error(`Imported JSON is too deeply nested at ${path}`);
    }
    nodeCount += 1;
    if (nodeCount > maxNodes) {
      throw new Error("Imported JSON contains too many values");
    }
    if (value === null || typeof value !== "object") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, depth + 1, `${path}.${index}`));
      return;
    }
    for (const key of Object.keys(value)) {
      if (forbiddenJsonKeys.has(key)) {
        throw new Error(`Imported JSON contains unsafe key ${key}`);
      }
      visit((value as Record<string, unknown>)[key], depth + 1, `${path}.${key}`);
    }
  };

  visit(input, 0, "$");
}

export function limitedRecordSummary(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  const record = input as Record<string, unknown>;
  return {
    localProjectId:
      typeof record.localProjectId === "string" ? record.localProjectId : "unknown",
    projectId:
      typeof (record.project as { id?: unknown } | undefined)?.id === "string"
        ? (record.project as { id: string }).id
        : "unknown",
    name:
      typeof (record.project as { name?: unknown } | undefined)?.name === "string"
        ? (record.project as { name: string }).name
        : "Corrupt project",
    openedAt: typeof record.openedAt === "string" ? record.openedAt : null,
    recoveryState: "corrupt" as const,
  };
}

function fallbackRandomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function sanitizeText(value: string): string {
  return value
    .replace(/[<>:"/\\|?*]/g, "-")
    .split("")
    .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+$/, "project");
}

function assertPlainObject(
  input: unknown,
  name: string,
): asserts input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${name} must be a plain object`);
  }
}

function rejectUnknownKeys(
  input: Record<string, unknown>,
  allowedKeys: Set<string>,
  name: string,
): void {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`${name} contains unknown field ${key}`);
    }
  }
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function requireIsoString(value: unknown, name: string): string {
  const text = requireString(value, name);
  if (Number.isNaN(Date.parse(text)) || new Date(text).toISOString() !== text) {
    throw new Error(`${name} must be an ISO 8601 UTC string`);
  }
  return text;
}

function requireNullableIsoString(value: unknown, name: string): string | null {
  if (value === null) {
    return null;
  }
  return requireIsoString(value, name);
}

function requireNonNegativeInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value as number;
}

function requireEnum<const T extends readonly string[]>(
  value: unknown,
  values: T,
  name: string,
): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`${name} must be one of ${values.join(", ")}`);
  }
  return value as T[number];
}

export class StorageVersionError extends Error {
  constructor(version: unknown) {
    super(`Unsupported browser storage version: ${String(version)}`);
    this.name = "StorageVersionError";
  }
}
