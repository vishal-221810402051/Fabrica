export type StorageErrorCode =
  | "open-failed"
  | "transaction-failed"
  | "quota-exceeded"
  | "not-found"
  | "invalid-record"
  | "unsupported-version"
  | "revision-conflict";

export class ProjectStorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProjectStorageError";
  }
}

export function classifyStorageError(error: unknown): ProjectStorageError {
  if (error instanceof ProjectStorageError) {
    return error;
  }

  if (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  ) {
    return new ProjectStorageError(
      "quota-exceeded",
      "Browser local storage quota was exceeded",
      error,
    );
  }

  return new ProjectStorageError(
    "transaction-failed",
    error instanceof Error ? error.message : "Browser storage operation failed",
    error,
  );
}
