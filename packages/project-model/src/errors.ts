export interface IntegrityIssue {
  code: string;
  message: string;
  path: string;
  entityId?: string;
}

export class ProjectModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectModelError";
  }
}

export class ProjectModelValidationError extends ProjectModelError {
  constructor(message: string) {
    super(message);
    this.name = "ProjectModelValidationError";
  }
}

export class ProjectIntegrityError extends ProjectModelError {
  readonly issues: IntegrityIssue[];

  constructor(issues: IntegrityIssue[]) {
    super(`Project integrity validation failed with ${issues.length} issue(s)`);
    this.name = "ProjectIntegrityError";
    this.issues = issues;
  }
}

export class UnsupportedVersionError extends ProjectModelError {
  constructor(version: string) {
    super(`Unsupported project schema version: ${version}`);
    this.name = "UnsupportedVersionError";
  }
}

export class FutureVersionError extends ProjectModelError {
  constructor(version: string) {
    super(`Future project schema version is not supported: ${version}`);
    this.name = "FutureVersionError";
  }
}
