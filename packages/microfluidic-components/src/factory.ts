import {
  ComponentSchema,
  PortSchema,
  createStableId,
  type Component,
  type Port,
} from "project-model";

import { ComponentFactoryError } from "./errors";
import { resolveParameterValues } from "./parameters";
import { getComponentDefinition } from "./registry";
import {
  DEFINITION_IDENTITY_EXTENSION,
  DEFINITION_PARAMETERS_EXTENSION,
  PORT_TEMPLATE_METADATA,
  REGISTRY_VERSION,
  type ComponentDefinition,
  type CreateComponentOptions,
  type CreateComponentResult,
  type JsonObject,
  type JsonValue,
  type ParameterValue,
  type PortTemplate,
  type QuantityParameterValue,
} from "./types";

export function createComponentFromDefinition(
  options: CreateComponentOptions,
): CreateComponentResult {
  const definition = getComponentDefinition(options.definitionKey);
  validateFactoryOptions(definition, options);
  const { values, extensionValues } = resolveParameterValues(
    definition.parameters,
    options.parameterOverrides,
    options.provenanceOverrides,
  );

  const componentId = createStableId("component");
  const ports = definition.ports.map((template) => createPort(template, componentId));
  const component = ComponentSchema.parse({
    id: componentId,
    kind: definition.persistedKind,
    name: options.name ?? definition.defaultInstanceName,
    ...(options.laneId ? { laneId: options.laneId } : {}),
    layerId: options.layerId,
    position: {
      x: quantity(options.position.x, "mm"),
      y: quantity(options.position.y, "mm"),
    },
    rotation: quantity(options.rotation ?? 0, "rad"),
    portIds: ports.map((port) => port.id),
    metadata: {},
    extensions: componentExtensions(definition, extensionValues),
    ...persistedPayload(definition, values),
  }) as Component;

  return {
    component,
    ports,
    definitionKey: definition.key,
    registryVersion: REGISTRY_VERSION,
    definitionRevision: definition.definitionRevision,
    appliedDefaults: serializeValues(values),
    warnings: [],
  };
}

function validateFactoryOptions(
  definition: ComponentDefinition,
  options: CreateComponentOptions,
): void {
  if (!Number.isFinite(options.position.x) || !Number.isFinite(options.position.y)) {
    throw new ComponentFactoryError("Position must contain finite numbers");
  }
  if (options.rotation !== undefined && !Number.isFinite(options.rotation)) {
    throw new ComponentFactoryError("Rotation must be finite");
  }
  if (definition.lanePolicy === "required" && !options.laneId) {
    throw new ComponentFactoryError(`${definition.key} requires laneId`);
  }
  if (definition.lanePolicy === "forbidden" && options.laneId) {
    throw new ComponentFactoryError(`${definition.key} forbids laneId`);
  }
}

function componentExtensions(
  definition: ComponentDefinition,
  extensionValues: JsonObject,
) {
  return {
    [DEFINITION_IDENTITY_EXTENSION]: {
      definitionKey: definition.key,
      registryVersion: REGISTRY_VERSION,
      definitionRevision: definition.definitionRevision,
    },
    ...(Object.keys(extensionValues).length > 0
      ? { [DEFINITION_PARAMETERS_EXTENSION]: extensionValues }
      : {}),
  };
}

function createPort(template: PortTemplate, componentId: string): Port {
  return PortSchema.parse({
    id: createStableId("port"),
    componentId,
    name: template.name,
    direction: template.direction,
    metadata: {
      [PORT_TEMPLATE_METADATA]: {
        templateKey: template.key,
        medium: template.medium,
        role: template.role,
        minConnections: template.minConnections,
        maxConnections: template.maxConnections,
      },
    },
  }) as Port;
}

function persistedPayload(
  definition: ComponentDefinition,
  values: Record<string, ParameterValue>,
): Record<string, unknown> {
  switch (definition.persistedKind) {
    case "channel":
      return channelPayload(definition, values);
    case "junction":
      return junctionPayload(definition, values);
    case "chamber":
      return chamberPayload(definition, values);
    case "reservoir":
      return reservoirPayload(definition, values);
    case "valve":
      return valvePayload(definition, values);
    case "sensor-interface":
      return sensorPayload(values);
    case "optical-interface":
      return opticalPayload(values);
    case "generic":
      return genericPayload(values);
  }
}

function junctionPayload(
  definition: ComponentDefinition,
  values: Record<string, ParameterValue>,
): Record<string, unknown> {
  return {
    junction: {
      category: definition.fixedProperties.category,
      ...(values.width && values.height && values.depth
        ? { dimensions: boxDimensions(values) }
        : {}),
    },
  };
}

function channelPayload(
  definition: ComponentDefinition,
  values: Record<string, ParameterValue>,
): Record<string, unknown> {
  const crossSection = definition.fixedProperties.crossSection;
  if (crossSection === "rectangular") {
    return {
      channel: {
        crossSection,
        length: requireQuantity(values.length),
        width: requireQuantity(values.width),
        depth: requireQuantity(values.depth),
      },
    };
  }
  return {
    channel: {
      crossSection,
      length: requireQuantity(values.length),
      diameter: requireQuantity(values.diameter),
    },
  };
}

function chamberPayload(
  definition: ComponentDefinition,
  values: Record<string, ParameterValue>,
): Record<string, unknown> {
  return {
    chamber: {
      category: definition.fixedProperties.category ?? "generic",
      dimensions: boxDimensions(values),
      ...(values["declared-volume"]
        ? { declaredVolume: requireQuantity(values["declared-volume"]) }
        : {}),
    },
  };
}

function reservoirPayload(
  definition: ComponentDefinition,
  values: Record<string, ParameterValue>,
): Record<string, unknown> {
  return {
    reservoir: {
      category: definition.fixedProperties.category ?? "generic",
      dimensions: boxDimensions(values),
      ...(values["declared-volume"]
        ? { declaredCapacity: requireQuantity(values["declared-volume"]) }
        : {}),
    },
  };
}

function valvePayload(
  definition: ComponentDefinition,
  values: Record<string, ParameterValue>,
): Record<string, unknown> {
  return {
    valve: {
      category: definition.fixedProperties.category ?? "generic",
      ...(definition.fixedProperties.normallyOpen !== undefined
        ? { normallyOpen: definition.fixedProperties.normallyOpen }
        : { normallyOpen: values["normally-open"] ?? false }),
    },
  };
}

function sensorPayload(
  values: Record<string, ParameterValue>,
): Record<string, unknown> {
  return {
    sensorInterface: {
      interfaceType: values["interface-type"] ?? "generic",
      measurementCategory: values["measurement-category"] ?? "generic",
      dimensions: planarDimensions(values),
    },
  };
}

function opticalPayload(
  values: Record<string, ParameterValue>,
): Record<string, unknown> {
  return {
    opticalInterface: {
      interfaceType: values["interface-type"] ?? "generic",
      measurementCategory: values["measurement-category"] ?? "generic",
      dimensions: planarDimensions(values),
    },
  };
}

function genericPayload(
  values: Record<string, ParameterValue>,
): Record<string, unknown> {
  if (values.width && values.height && values.depth) {
    return { dimensions: boxDimensions(values) };
  }
  return {};
}

function boxDimensions(values: Record<string, ParameterValue>) {
  return {
    width: requireQuantity(values.width),
    height: requireQuantity(values.height),
    depth: requireQuantity(values.depth),
  };
}

function planarDimensions(values: Record<string, ParameterValue>) {
  return {
    width: requireQuantity(values.width),
    height: requireQuantity(values.height),
  };
}

function quantity(value: number, unit: "mm" | "rad") {
  return { value, unit, provenance: { source: "system-default" } };
}

function requireQuantity(value: ParameterValue | undefined): QuantityParameterValue {
  if (!value || typeof value !== "object" || !("unit" in value)) {
    throw new ComponentFactoryError("Expected quantity value");
  }
  return value;
}

function serializeValues(values: Record<string, ParameterValue>): JsonObject {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, serializeValue(value)]),
  );
}

function serializeValue(value: ParameterValue): JsonValue {
  if (value && typeof value === "object" && "unit" in value) {
    return {
      value: value.value,
      unit: value.unit,
      provenance: value.provenance?.note
        ? { source: value.provenance.source, note: value.provenance.note }
        : { source: value.provenance?.source ?? "system-default" },
    };
  }
  return value;
}
