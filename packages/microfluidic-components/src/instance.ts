import { ComponentSchema, PortSchema, type Component, type Port } from "project-model";
import type { ProvenanceSource } from "units";

import { ComponentFactoryError } from "./errors";
import { resolveParameterValues, validateParameterValue } from "./parameters";
import { getComponentDefinition } from "./registry";
import {
  DEFINITION_IDENTITY_EXTENSION,
  DEFINITION_PARAMETERS_EXTENSION,
  PORT_TEMPLATE_METADATA,
  REGISTRY_VERSION,
  type ComponentDefinition,
  type DefinitionIdentity,
  type JsonObject,
  type JsonValue,
  type ParameterDefinition,
  type ParameterValue,
  type PortTemplateMetadata,
} from "./types";

export interface UpdateComponentParametersOptions {
  component: Component;
  updates: Record<string, ParameterValue>;
  provenanceOverrides?: Record<string, ProvenanceSource>;
}

export interface UpdateComponentParametersResult {
  component: Component;
  values: Record<string, ParameterValue>;
  appliedUpdates: string[];
  warnings: string[];
}

export interface ComponentInstanceValidationResult {
  valid: boolean;
  issues: string[];
}

export function getComponentParameterValues(
  component: Component,
): Record<string, ParameterValue> {
  const parsed = ComponentSchema.parse(structuredClone(component)) as Component;
  const definition = resolveComponentDefinition(parsed);
  const extensionValues = readDefinitionParameterExtension(parsed, definition, {
    allowFirstClassDuplicates: true,
  });
  const values: Record<string, ParameterValue> = {};

  for (const parameter of definition.parameters) {
    const firstClass = readFirstClassValue(parsed, parameter.key);
    const value =
      firstClass !== undefined
        ? firstClass
        : parameter.storage === "extension"
          ? extensionValues[parameter.key]
          : undefined;
    if (value !== undefined) {
      values[parameter.key] = cloneJson(value) as ParameterValue;
    }
  }

  return values;
}

export function updateComponentParameters(
  options: UpdateComponentParametersOptions,
): UpdateComponentParametersResult {
  const component = ComponentSchema.parse(
    structuredClone(options.component),
  ) as Component;
  const definition = resolveComponentDefinition(component);
  validateParameterKeys(definition.parameters, options.updates);

  const existingValues = getComponentParameterValues(component);
  const mergedValues = { ...existingValues, ...options.updates };
  const provenanceOverrides = Object.fromEntries(
    Object.keys(options.updates).map((key) => [
      key,
      options.provenanceOverrides?.[key] ?? "user-entered",
    ]),
  ) as Record<string, ProvenanceSource>;
  const { values, extensionValues } = resolveParameterValues(
    definition.parameters,
    mergedValues,
    provenanceOverrides,
  );
  let nextComponent = structuredClone(component) as Component;

  for (const parameter of definition.parameters) {
    if (parameter.storage === "first-class") {
      nextComponent = writeFirstClassValue(
        nextComponent,
        parameter.key,
        values[parameter.key],
      );
    }
  }

  const extensions: Record<string, JsonValue> = {
    ...nextComponent.extensions,
    [DEFINITION_IDENTITY_EXTENSION]: cloneJson(
      nextComponent.extensions[DEFINITION_IDENTITY_EXTENSION],
    ),
  };
  if (Object.keys(extensionValues).length > 0) {
    extensions[DEFINITION_PARAMETERS_EXTENSION] = extensionValues;
  } else {
    delete extensions[DEFINITION_PARAMETERS_EXTENSION];
  }
  nextComponent = {
    ...nextComponent,
    extensions,
  };

  const parsed = ComponentSchema.parse(nextComponent) as Component;
  const validation = validateComponentInstance(parsed);
  if (!validation.valid) {
    throw new ComponentFactoryError(validation.issues.join("; "));
  }

  return {
    component: parsed,
    values,
    appliedUpdates: Object.keys(options.updates),
    warnings: [],
  };
}

export function validateComponentInstance(
  component: Component,
  ownedPorts: readonly Port[] = [],
): ComponentInstanceValidationResult {
  const issues: string[] = [];
  let parsedComponent: Component;
  let definition: ComponentDefinition;

  try {
    parsedComponent = ComponentSchema.parse(structuredClone(component)) as Component;
    definition = resolveComponentDefinition(parsedComponent);
  } catch (error) {
    return { valid: false, issues: [errorMessage(error)] };
  }

  if (parsedComponent.kind !== definition.persistedKind) {
    issues.push("Persisted kind does not match component definition");
  }
  if (!isJsonSafe(parsedComponent.extensions)) {
    issues.push("Component extensions are not JSON-safe");
  }
  if (definition.lanePolicy === "required" && !parsedComponent.laneId) {
    issues.push("Component definition requires laneId");
  }
  if (definition.lanePolicy === "forbidden" && parsedComponent.laneId) {
    issues.push("Component definition forbids laneId");
  }

  try {
    const values = getComponentParameterValues(parsedComponent);
    for (const parameter of definition.parameters) {
      if (values[parameter.key] !== undefined) {
        validateParameterValue(parameter, values[parameter.key]);
      } else if (parameter.required) {
        issues.push(`Missing required parameter ${parameter.key}`);
      }
    }
  } catch (error) {
    issues.push(errorMessage(error));
  }

  try {
    readDefinitionParameterExtension(parsedComponent, definition, {
      allowFirstClassDuplicates: false,
    });
  } catch (error) {
    issues.push(errorMessage(error));
  }

  if (ownedPorts.length > 0) {
    const parsedPorts = ownedPorts.map(
      (port) => PortSchema.parse(structuredClone(port)) as Port,
    );
    const portIds = new Set(parsedPorts.map((port) => port.id));
    for (const portId of parsedComponent.portIds) {
      if (!portIds.has(portId)) {
        issues.push(`Missing owned port ${portId}`);
      }
    }
    if (parsedPorts.length !== definition.ports.length) {
      issues.push("Owned port count does not match definition templates");
    }
    for (const port of parsedPorts) {
      if (port.componentId !== parsedComponent.id) {
        issues.push(`Port ${port.id} is not owned by component`);
        continue;
      }
      const metadata = port.metadata[PORT_TEMPLATE_METADATA] as unknown;
      if (!isPortTemplateMetadata(metadata)) {
        issues.push(`Port ${port.id} has invalid template metadata`);
        continue;
      }
      const template = definition.ports.find(
        (candidate) => candidate.key === metadata.templateKey,
      );
      if (!template) {
        issues.push(`Port ${port.id} references unknown template`);
        continue;
      }
      if (
        port.direction !== template.direction ||
        metadata.medium !== template.medium ||
        metadata.role !== template.role ||
        metadata.minConnections !== template.minConnections ||
        metadata.maxConnections !== template.maxConnections
      ) {
        issues.push(`Port ${port.id} does not match template metadata`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

function resolveComponentDefinition(component: Component): ComponentDefinition {
  const identity = component.extensions[DEFINITION_IDENTITY_EXTENSION] as unknown;
  if (!isDefinitionIdentity(identity)) {
    throw new ComponentFactoryError("Component definition identity is invalid");
  }
  if (identity.registryVersion !== REGISTRY_VERSION) {
    throw new ComponentFactoryError("Component registry version is unsupported");
  }
  let definition: ComponentDefinition;
  try {
    definition = getComponentDefinition(identity.definitionKey);
  } catch {
    throw new ComponentFactoryError("Component definition identity is invalid");
  }
  if (definition.definitionRevision !== identity.definitionRevision) {
    throw new ComponentFactoryError("Component definition revision is unsupported");
  }
  return definition;
}

function isDefinitionIdentity(value: unknown): value is DefinitionIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  return (
    keys.length === 3 &&
    keys[0] === "definitionKey" &&
    keys[1] === "definitionRevision" &&
    keys[2] === "registryVersion" &&
    typeof candidate.definitionKey === "string" &&
    typeof candidate.registryVersion === "string" &&
    Number.isInteger(candidate.definitionRevision)
  );
}

function readDefinitionParameterExtension(
  component: Component,
  definition: ComponentDefinition,
  options: { allowFirstClassDuplicates: boolean },
): JsonObject {
  const value = component.extensions[DEFINITION_PARAMETERS_EXTENSION];
  if (value === undefined) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ComponentFactoryError("Definition parameter extension is malformed");
  }
  if (!isJsonSafe(value)) {
    throw new ComponentFactoryError("Definition parameter extension is not JSON-safe");
  }
  validateDefinitionParameterExtension(value as JsonObject, definition, options);
  return cloneJson(value) as JsonObject;
}

function validateDefinitionParameterExtension(
  value: JsonObject,
  definition: ComponentDefinition,
  options: { allowFirstClassDuplicates: boolean },
): void {
  const parametersByKey = new Map(
    definition.parameters.map((parameter) => [parameter.key, parameter]),
  );
  for (const [key, parameterValue] of Object.entries(value)) {
    const parameter = parametersByKey.get(key);
    if (!parameter) {
      throw new ComponentFactoryError(
        `Unknown definition parameter extension key: ${key}`,
      );
    }
    if (parameter.storage === "first-class") {
      if (options.allowFirstClassDuplicates) {
        continue;
      }
      throw new ComponentFactoryError(
        `First-class parameter duplicated in extension: ${key}`,
      );
    }
    validateParameterValue(parameter, parameterValue as ParameterValue);
  }
}

function validateParameterKeys(
  definitions: readonly ParameterDefinition[],
  updates: Record<string, ParameterValue>,
): void {
  const known = new Set(definitions.map((definition) => definition.key));
  for (const key of Object.keys(updates)) {
    if (!known.has(key)) {
      throw new ComponentFactoryError(`Unknown parameter override: ${key}`);
    }
  }
}

function readFirstClassValue(
  component: Component,
  key: string,
): ParameterValue | undefined {
  switch (component.kind) {
    case "channel":
      return (component.channel as Record<string, ParameterValue>)[key];
    case "chamber":
      return (
        readDimensions(component.chamber.dimensions, key) ??
        (key === "declared-volume" ? component.chamber.declaredVolume : undefined)
      );
    case "reservoir":
      return (
        readDimensions(component.reservoir.dimensions, key) ??
        (key === "declared-volume" ? component.reservoir.declaredCapacity : undefined)
      );
    case "valve":
      return key === "normally-open" ? component.valve.normallyOpen : undefined;
    case "sensor-interface":
      return readInterfaceValue(component.sensorInterface, key);
    case "optical-interface":
      return readInterfaceValue(component.opticalInterface, key);
    case "generic":
      return component.dimensions
        ? readDimensions(component.dimensions, key)
        : undefined;
    case "junction":
      return undefined;
  }
}

function writeFirstClassValue(
  component: Component,
  key: string,
  value: ParameterValue | undefined,
): Component {
  switch (component.kind) {
    case "channel":
      if (value === undefined) {
        return component;
      }
      return {
        ...component,
        channel: { ...component.channel, [key]: value },
      } as Component;
    case "chamber":
      if (value === undefined && key === "declared-volume") {
        const chamber = { ...component.chamber };
        delete chamber.declaredVolume;
        return { ...component, chamber } as Component;
      }
      if (value === undefined) {
        return component;
      }
      return {
        ...component,
        chamber: {
          ...component.chamber,
          dimensions: writeDimensions(component.chamber.dimensions, key, value),
          ...(key === "declared-volume" ? { declaredVolume: value } : {}),
        },
      } as Component;
    case "reservoir":
      if (value === undefined && key === "declared-volume") {
        const reservoir = { ...component.reservoir };
        delete reservoir.declaredCapacity;
        return { ...component, reservoir } as Component;
      }
      if (value === undefined) {
        return component;
      }
      return {
        ...component,
        reservoir: {
          ...component.reservoir,
          dimensions: writeDimensions(component.reservoir.dimensions, key, value),
          ...(key === "declared-volume" ? { declaredCapacity: value } : {}),
        },
      } as Component;
    case "valve":
      if (value === undefined) {
        return component;
      }
      return key === "normally-open"
        ? ({
            ...component,
            valve: { ...component.valve, normallyOpen: value },
          } as Component)
        : component;
    case "sensor-interface":
      if (value === undefined) {
        return component;
      }
      return {
        ...component,
        sensorInterface: writeInterfaceValue(component.sensorInterface, key, value),
      } as Component;
    case "optical-interface":
      if (value === undefined) {
        return component;
      }
      return {
        ...component,
        opticalInterface: writeInterfaceValue(component.opticalInterface, key, value),
      } as Component;
    case "generic":
      if (value === undefined) {
        return component;
      }
      return {
        ...component,
        dimensions: writeDimensions(component.dimensions ?? {}, key, value),
      } as Component;
    case "junction":
      return component;
  }
}

function readDimensions(
  dimensions: Record<string, ParameterValue>,
  key: string,
): ParameterValue | undefined {
  return key === "width" || key === "height" || key === "depth"
    ? dimensions[key]
    : undefined;
}

function writeDimensions(
  dimensions: Record<string, ParameterValue>,
  key: string,
  value: ParameterValue,
) {
  return key === "width" || key === "height" || key === "depth"
    ? { ...dimensions, [key]: value }
    : dimensions;
}

function readInterfaceValue(
  value: {
    interfaceType: string;
    measurementCategory?: string;
    dimensions: Record<string, ParameterValue>;
  },
  key: string,
): ParameterValue | undefined {
  if (key === "interface-type") {
    return value.interfaceType;
  }
  if (key === "measurement-category") {
    return value.measurementCategory;
  }
  return readDimensions(value.dimensions, key);
}

function writeInterfaceValue<
  T extends {
    interfaceType: string;
    measurementCategory?: string;
    dimensions: Record<string, ParameterValue>;
  },
>(current: T, key: string, value: ParameterValue): T {
  if (key === "interface-type") {
    return { ...current, interfaceType: value as string };
  }
  if (key === "measurement-category") {
    return { ...current, measurementCategory: value as string };
  }
  return { ...current, dimensions: writeDimensions(current.dimensions, key, value) };
}

function isPortTemplateMetadata(value: unknown): value is PortTemplateMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  return (
    keys.length === 5 &&
    keys[0] === "maxConnections" &&
    keys[1] === "medium" &&
    keys[2] === "minConnections" &&
    keys[3] === "role" &&
    keys[4] === "templateKey" &&
    typeof candidate.templateKey === "string" &&
    typeof candidate.medium === "string" &&
    typeof candidate.role === "string" &&
    Number.isInteger(candidate.minConnections) &&
    (candidate.maxConnections === null || Number.isInteger(candidate.maxConnections))
  );
}

function cloneJson(value: unknown): JsonValue {
  return value === undefined ? null : (JSON.parse(JSON.stringify(value)) as JsonValue);
}

function isJsonSafe(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonSafe);
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonSafe);
  }
  return false;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
