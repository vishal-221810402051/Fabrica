import * as projectModel from "project-model";

import {
  assertSafeJsonInput,
  createProjectRecord,
  sanitizeImportedFilename,
  type ProjectRecord,
} from "../projects/projectRecord";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const acceptedProjectExtensions = [".fabricgamma.json", ".json"] as const;

export type ProjectImportErrorCode =
  | "unsupported-extension"
  | "file-too-large"
  | "read-failed"
  | "invalid-json"
  | "unsafe-json"
  | "invalid-project";

export class ProjectImportError extends Error {
  constructor(
    readonly code: ProjectImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectImportError";
  }
}

export async function importProjectFile(file: File): Promise<ProjectRecord> {
  validateImportFilename(file.name);
  if (file.size > MAX_IMPORT_BYTES) {
    throw new ProjectImportError("file-too-large", "Project file is larger than 5 MiB");
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new ProjectImportError("read-failed", "Project file could not be read");
  }

  return importProjectText(text, file.name);
}

export function importProjectText(
  text: string,
  filename = "import.json",
): ProjectRecord {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ProjectImportError("invalid-json", "Project file is not valid JSON");
  }

  try {
    assertSafeJsonInput(payload);
  } catch (error) {
    throw new ProjectImportError(
      "unsafe-json",
      error instanceof Error ? error.message : "Project JSON is unsafe",
    );
  }

  try {
    const project = projectModel.parseProject(payload);
    return createProjectRecord(project, "imported", {
      importedFilename: sanitizeImportedFilename(filename),
    });
  } catch (error) {
    throw new ProjectImportError(
      "invalid-project",
      error instanceof Error ? error.message : "Project document is invalid",
    );
  }
}

function validateImportFilename(filename: string): void {
  const lower = filename.toLowerCase();
  if (!acceptedProjectExtensions.some((extension) => lower.endsWith(extension))) {
    throw new ProjectImportError(
      "unsupported-extension",
      "Project import must be a .fabricgamma.json or .json file",
    );
  }
}
