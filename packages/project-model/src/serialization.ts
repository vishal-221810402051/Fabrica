import { ProjectIntegrityError, ProjectModelValidationError } from "./errors";
import { validateProjectIntegrity } from "./integrity";
import { migrateProjectDocument } from "./migrations";
import { ProjectSchema, type Project } from "./schema";
import { canonicalizeProject } from "./canonicalization";

export function parseProject(input: unknown): Project {
  const migrated = migrateProjectDocument(input);
  const parsed = ProjectSchema.safeParse(migrated);

  if (!parsed.success) {
    throw new ProjectModelValidationError(parsed.error.message);
  }

  const issues = validateProjectIntegrity(parsed.data);
  if (issues.length > 0) {
    throw new ProjectIntegrityError(issues);
  }

  return canonicalizeProject(parsed.data);
}

export function serializeProject(project: Project): Project {
  return canonicalizeProject(ProjectSchema.parse(project));
}

export function stringifyProject(project: Project, space = 2): string {
  return JSON.stringify(serializeProject(project), null, space);
}
