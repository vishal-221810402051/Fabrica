import {
  canonicalUnitsByDimension,
  createProvenance,
  normalizeQuantity,
  type Dimension,
  type ProvenanceSource,
} from "units";

import { ComponentFactoryError } from "./errors";
import {
  parameterKinds,
  type JsonObject,
  type JsonValue,
  type ParameterDefinition,
  type ParameterValue,
  type QuantityParameterValue,
} from "./types";

const quantityDimensions = new Map<string, Dimension>([
  ["length", "length"],
  ["area", "area"],
  ["volume", "volume"],
  ["angle", "angle"],
]);

export function lengthParameter(
  key: string,
  label: string,
  defaultValue: number,
  storage: ParameterDefinition["storage"] = "first-class",
): ParameterDefinition {
  return {
    key,
    label,
    description: `${label} in canonical millimetres`,
    kind: "length",
    required: true,
    defaultValue: quantity(defaultValue, "mm"),
    canonicalUnit: "mm",
    dimension: "length",
    minimum: 0,
    exclusiveMinimum: true,
    manufacturingRelevant: true,
    provenanceSource: "system-default",
    storage,
  };
}

export function volumeParameter(
  key: string,
  label: string,
  defaultValue: number | null,
  required = false,
): ParameterDefinition {
  return {
    key,
    label,
    description: `${label} in canonical cubic millimetres`,
    kind: "volume",
    required,
    ...(defaultValue === null ? {} : { defaultValue: quantity(defaultValue, "mm3") }),
    canonicalUnit: "mm3",
    dimension: "volume",
    minimum: 0,
    exclusiveMinimum: true,
    manufacturingRelevant: true,
    provenanceSource: "system-default",
    storage: "first-class",
  };
}

export function booleanParameter(
  key: string,
  label: string,
  defaultValue: boolean,
): ParameterDefinition {
  return {
    key,
    label,
    description: label,
    kind: "boolean",
    required: true,
    defaultValue,
    provenanceSource: "system-default",
    storage: "first-class",
  };
}

export function enumParameter(
  key: string,
  label: string,
  allowedValues: readonly string[],
  defaultValue: string,
  storage: ParameterDefinition["storage"] = "extension",
): ParameterDefinition {
  return {
    key,
    label,
    description: label,
    kind: "enum",
    required: true,
    defaultValue,
    allowedValues,
    provenanceSource: "system-default",
    storage,
  };
}

export function textParameter(
  key: string,
  label: string,
  defaultValue: string,
  storage: ParameterDefinition["storage"] = "extension",
): ParameterDefinition {
  return {
    key,
    label,
    description: label,
    kind: "text",
    required: true,
    defaultValue,
    maximum: 120,
    provenanceSource: "system-default",
    storage,
  };
}

export function quantity(value: number, unit: QuantityParameterValue["unit"]) {
  return { value, unit, provenance: createProvenance("system-default") };
}

export function validateParameterDefinition(definition: ParameterDefinition): string[] {
  const issues: string[] = [];
  if (!/^[a-z][a-z0-9-]*$/.test(definition.key)) {
    issues.push(`Invalid parameter key ${definition.key}`);
  }
  if (!parameterKinds.includes(definition.kind)) {
    issues.push(`Invalid parameter kind ${definition.kind}`);
  }
  if (definition.kind === "enum" && !definition.allowedValues?.length) {
    issues.push(`Enum parameter ${definition.key} requires allowedValues`);
  }
  if (definition.defaultValue !== undefined) {
    try {
      validateParameterValue(definition, definition.defaultValue);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }
  return issues;
}

export function resolveParameterValues(
  definitions: readonly ParameterDefinition[],
  overrides: Record<string, ParameterValue> = {},
  provenanceOverrides: Record<string, ProvenanceSource> = {},
): { values: Record<string, ParameterValue>; extensionValues: JsonObject } {
  const knownKeys = new Set(definitions.map((definition) => definition.key));
  for (const key of Object.keys(overrides)) {
    if (!knownKeys.has(key)) {
      throw new ComponentFactoryError(`Unknown parameter override: ${key}`);
    }
  }

  const values: Record<string, ParameterValue> = {};
  const extensionValues: JsonObject = {};

  for (const definition of definitions) {
    const value = overrides[definition.key] ?? definition.defaultValue;
    if (value === undefined) {
      if (definition.required) {
        throw new ComponentFactoryError(
          `Missing required parameter: ${definition.key}`,
        );
      }
      continue;
    }
    const provenance = provenanceOverrides[definition.key];
    const normalized = validateParameterValue(definition, value, provenance);
    values[definition.key] = normalized;
    if (definition.storage === "extension") {
      extensionValues[definition.key] = toJsonValue(normalized);
    }
  }

  return { values, extensionValues };
}

export function validateParameterValue(
  definition: ParameterDefinition,
  value: ParameterValue,
  provenanceOverride?: ProvenanceSource,
): ParameterValue {
  if (quantityDimensions.has(definition.kind)) {
    if (!isQuantity(value)) {
      throw new ComponentFactoryError(`Parameter ${definition.key} must be a quantity`);
    }
    const dimension = quantityDimensions.get(definition.kind);
    if (!dimension) {
      throw new ComponentFactoryError(`Unsupported quantity kind ${definition.kind}`);
    }
    const normalized = normalizeQuantity(
      {
        value: value.value,
        unit: value.unit,
        provenance: cleanProvenance(
          provenanceOverride ?? value.provenance?.source ?? "system-default",
          value.provenance?.note,
        ),
      },
      dimension,
    );
    checkNumberConstraints(definition, normalized.value);
    return {
      value: normalized.value,
      unit: canonicalUnitsByDimension[dimension],
      provenance: normalized.provenance,
    } satisfies QuantityParameterValue;
  }

  if (definition.kind === "integer" || definition.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ComponentFactoryError(`Parameter ${definition.key} must be finite`);
    }
    if (definition.kind === "integer" && !Number.isInteger(value)) {
      throw new ComponentFactoryError(`Parameter ${definition.key} must be integer`);
    }
    checkNumberConstraints(definition, value);
    return value;
  }

  if (definition.kind === "boolean") {
    if (typeof value !== "boolean") {
      throw new ComponentFactoryError(`Parameter ${definition.key} must be boolean`);
    }
    return value;
  }

  if (definition.kind === "enum") {
    if (typeof value !== "string" || !definition.allowedValues?.includes(value)) {
      throw new ComponentFactoryError(`Invalid enum value for ${definition.key}`);
    }
    return value;
  }

  if (
    definition.kind === "text" ||
    definition.kind === "material-reference" ||
    definition.kind === "fluid-reference"
  ) {
    if (value !== null && typeof value !== "string") {
      throw new ComponentFactoryError(`Parameter ${definition.key} must be text`);
    }
    if (typeof value === "string" && value.length > (definition.maximum ?? 160)) {
      throw new ComponentFactoryError(`Parameter ${definition.key} is too long`);
    }
    return value;
  }

  throw new ComponentFactoryError(`Unsupported parameter kind ${definition.kind}`);
}

function checkNumberConstraints(definition: ParameterDefinition, value: number): void {
  if (definition.minimum !== undefined) {
    const valid = definition.exclusiveMinimum
      ? value > definition.minimum
      : value >= definition.minimum;
    if (!valid) {
      throw new ComponentFactoryError(`Parameter ${definition.key} is below minimum`);
    }
  }
  if (definition.maximum !== undefined) {
    const valid = definition.exclusiveMaximum
      ? value < definition.maximum
      : value <= definition.maximum;
    if (!valid) {
      throw new ComponentFactoryError(`Parameter ${definition.key} is above maximum`);
    }
  }
}

function isQuantity(value: ParameterValue): value is QuantityParameterValue {
  return (
    value !== null &&
    typeof value === "object" &&
    "value" in value &&
    "unit" in value &&
    typeof value.value === "number"
  );
}

function toJsonValue(value: ParameterValue): JsonValue {
  if (isQuantity(value)) {
    return {
      value: value.value,
      unit: value.unit,
      provenance: cleanProvenance(
        value.provenance?.source ?? "system-default",
        value.provenance?.note,
      ),
    };
  }
  return value;
}

function cleanProvenance(
  source: ProvenanceSource,
  note?: string,
): { source: ProvenanceSource; note?: string } {
  return note ? { source, note } : { source };
}
