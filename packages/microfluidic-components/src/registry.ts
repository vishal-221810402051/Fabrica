import { ComponentRegistryError, UnknownComponentDefinitionError } from "./errors";
import { validateParameterDefinition } from "./parameters";
import { validatePortTemplate } from "./ports";
import {
  componentCategories,
  lanePolicies,
  layerPolicies,
  REGISTRY_VERSION,
  type ComponentCategory,
  type ComponentDefinition,
} from "./types";
import { builtInDefinitions } from "./definitions";

const definitionKeyPattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const persistedKinds = new Set([
  "channel",
  "junction",
  "chamber",
  "reservoir",
  "valve",
  "sensor-interface",
  "optical-interface",
  "generic",
]);

const registry = buildRegistry(builtInDefinitions);

export { REGISTRY_VERSION };

export function listComponentDefinitions(): readonly ComponentDefinition[] {
  return registry.definitions.map((definition) =>
    deepFreeze(structuredClone(definition)),
  );
}

export function listDefinitionKeys(): readonly string[] {
  return registry.definitions.map((definition) => definition.key);
}

export function listComponentDefinitionsByCategory(
  category: ComponentCategory,
): readonly ComponentDefinition[] {
  return listComponentDefinitions().filter(
    (definition) => definition.category === category,
  );
}

export function getComponentDefinition(key: string): ComponentDefinition {
  const definition = registry.byKey.get(key);
  if (!definition) {
    throw new UnknownComponentDefinitionError(key);
  }
  return deepFreeze(structuredClone(definition));
}

export function hasComponentDefinition(key: string): boolean {
  return registry.byKey.has(key);
}

export function validateRegistry(): readonly string[] {
  return validateDefinitions(registry.definitions);
}

function buildRegistry(definitions: readonly ComponentDefinition[]) {
  const sorted = [...definitions].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
  const issues = validateDefinitions(sorted);
  if (issues.length > 0) {
    throw new ComponentRegistryError(issues.join("; "));
  }
  const frozen = deepFreeze(sorted);
  return {
    definitions: frozen,
    byKey: new Map(frozen.map((definition) => [definition.key, definition])),
  };
}

function validateDefinitions(definitions: readonly ComponentDefinition[]): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();

  for (const definition of definitions) {
    if (!definitionKeyPattern.test(definition.key)) {
      issues.push(`Invalid definition key ${definition.key}`);
    }
    if (keys.has(definition.key)) {
      issues.push(`Duplicate definition key ${definition.key}`);
    }
    keys.add(definition.key);
    if (
      !Number.isInteger(definition.definitionRevision) ||
      definition.definitionRevision <= 0
    ) {
      issues.push(`Invalid definition revision for ${definition.key}`);
    }
    if (!componentCategories.includes(definition.category)) {
      issues.push(`Invalid category for ${definition.key}`);
    }
    if (!persistedKinds.has(definition.persistedKind)) {
      issues.push(`Invalid persisted kind for ${definition.key}`);
    }
    if (!layerPolicies.includes(definition.layerPolicy)) {
      issues.push(`Invalid layer policy for ${definition.key}`);
    }
    if (!lanePolicies.includes(definition.lanePolicy)) {
      issues.push(`Invalid lane policy for ${definition.key}`);
    }
    if (!isJsonSafe(definition)) {
      issues.push(`Definition ${definition.key} is not JSON-safe`);
    }
    issues.push(
      ...validateUniqueKeys(definition.key, "parameter", definition.parameters),
    );
    issues.push(...validateUniqueKeys(definition.key, "port", definition.ports));
    for (const parameter of definition.parameters) {
      issues.push(...validateParameterDefinition(parameter));
    }
    for (const port of definition.ports) {
      issues.push(...validatePortTemplate(port));
    }
  }

  return issues;
}

function validateUniqueKeys(
  definitionKey: string,
  label: string,
  items: readonly { key: string }[],
): string[] {
  const keys = new Set<string>();
  const issues: string[] = [];
  for (const item of items) {
    if (keys.has(item.key)) {
      issues.push(`Duplicate ${label} key ${item.key} in ${definitionKey}`);
    }
    keys.add(item.key);
  }
  return issues;
}

function isJsonSafe(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonSafe);
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every(isJsonSafe);
  }
  return false;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}
