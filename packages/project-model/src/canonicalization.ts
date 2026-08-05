import type { JsonValue } from "./metadata";
import type { Project } from "./schema";

export function canonicalizeProject(project: Project): Project {
  return removeUndefined(project) as Project;
}

export function removeUndefined(value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => removeUndefined(entry))
      .filter((entry): entry is JsonValue => entry !== undefined);
  }

  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, entry]) => [key, removeUndefined(entry)] as const)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return Object.fromEntries(entries) as { [key: string]: JsonValue };
  }

  throw new TypeError("Project data contains a non-JSON-safe value");
}
