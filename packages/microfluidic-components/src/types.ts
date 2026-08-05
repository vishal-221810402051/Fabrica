import type {
  Component,
  ComponentId,
  Connection,
  LayerId,
  Port,
  PortId,
} from "project-model";
import type { CanonicalUnit, Dimension, ProvenanceSource, Unit } from "units";

export const REGISTRY_VERSION = "1.0.0";
export const DEFINITION_IDENTITY_EXTENSION = "fabricgamma.component-definition";
export const DEFINITION_PARAMETERS_EXTENSION = "fabricgamma.definition-parameters";
export const PORT_TEMPLATE_METADATA = "fabricgamma.port-template";

export const componentCategories = [
  "flow",
  "routing",
  "sample-handling",
  "reagent-handling",
  "metering",
  "mixing",
  "reaction",
  "incubation",
  "detection",
  "sensing",
  "control",
  "filtration",
  "gas-management",
  "waste",
  "interface",
  "generic",
] as const;

export const portMedia = [
  "liquid",
  "gas",
  "pneumatic-control",
  "electrical",
  "optical",
  "generic",
] as const;

export const portRoles = [
  "sample",
  "reagent",
  "buffer",
  "waste",
  "vent",
  "control",
  "detection",
  "generic",
] as const;

export const layerPolicies = ["same-layer", "layer-agnostic"] as const;
export const lanePolicies = ["required", "optional", "forbidden", "shared"] as const;
export const parameterKinds = [
  "length",
  "area",
  "volume",
  "angle",
  "integer",
  "number",
  "boolean",
  "enum",
  "text",
  "material-reference",
  "fluid-reference",
] as const;

export type ComponentCategory = (typeof componentCategories)[number];
export type PortMedium = (typeof portMedia)[number];
export type PortRole = (typeof portRoles)[number];
export type LayerPolicy = (typeof layerPolicies)[number];
export type LanePolicy = (typeof lanePolicies)[number];
export type ParameterKind = (typeof parameterKinds)[number];
export type PersistedKind = Component["kind"];
export type PortDirection = Port["direction"];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface QuantityParameterValue {
  value: number;
  unit: Unit;
  provenance?: { source: ProvenanceSource; note?: string };
}

export type ParameterValue = QuantityParameterValue | string | number | boolean | null;

export interface ParameterDefinition {
  key: string;
  label: string;
  description: string;
  kind: ParameterKind;
  required: boolean;
  defaultValue?: ParameterValue;
  canonicalUnit?: CanonicalUnit;
  dimension?: Dimension;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  integerOnly?: boolean;
  allowedValues?: readonly string[];
  manufacturingRelevant?: boolean;
  provenanceSource?: ProvenanceSource;
  storage: "first-class" | "extension";
}

export interface PortAnchor {
  x: number;
  y: number;
}

export type PortOrientation = "north" | "east" | "south" | "west" | number;

export interface PortTemplate {
  key: string;
  name: string;
  direction: PortDirection;
  medium: PortMedium;
  role: PortRole;
  required: boolean;
  minConnections: number;
  maxConnections: number | null;
  anchor: PortAnchor;
  orientation: PortOrientation;
  sameComponentConnectionAllowed: boolean;
  metadata: JsonObject;
}

export interface IconDescriptor {
  key: string;
  viewBox: readonly [number, number, number, number];
  primitives: readonly IconPrimitive[];
}

export type IconPrimitive =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "polyline"; points: readonly PortAnchor[] }
  | { type: "rectangle"; x: number; y: number; width: number; height: number }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "path"; d: string };

export interface GeometryHints {
  schematicShapeKey: string;
  nominalFootprint?: { width: QuantityParameterValue; height: QuantityParameterValue };
  preferredAspectRatio?: number;
  rotationSymmetry?: number;
  minimumVisualSpacingHint?: QuantityParameterValue;
}

export interface ManufacturingMetadata {
  capabilityTags: readonly string[];
  allowedProcessCategories: readonly string[];
  allowedMaterialCategories: readonly string[];
  constraintReferences: readonly string[];
  requiresMembrane?: boolean;
  requiresElectrodeLayer?: boolean;
  requiresOpticalWindow?: boolean;
  requiresVent?: boolean;
  notes?: string;
}

export interface ComponentDefinition {
  key: string;
  definitionRevision: number;
  displayName: string;
  defaultInstanceName: string;
  description: string;
  persistedKind: PersistedKind;
  category: ComponentCategory;
  tags: readonly string[];
  parameters: readonly ParameterDefinition[];
  ports: readonly PortTemplate[];
  layerPolicy: LayerPolicy;
  lanePolicy: LanePolicy;
  geometryHints: GeometryHints;
  manufacturingMetadata: ManufacturingMetadata;
  icon: IconDescriptor;
  deprecated: boolean;
  replacementKey?: string;
  fixedProperties: JsonObject;
  allowsGenericCompatibility?: boolean;
  localRoleCompatibility?: readonly RoleCompatibilityException[];
}

export interface RoleCompatibilityException {
  sourceRole: PortRole;
  targetRole: PortRole;
}

export interface DefinitionIdentity {
  definitionKey: string;
  registryVersion: string;
  definitionRevision: number;
}

export interface PortTemplateMetadata {
  templateKey: string;
  medium: PortMedium;
  role: PortRole;
  minConnections: number;
  maxConnections: number | null;
}

export interface PositionInput {
  x: number;
  y: number;
}

export interface CreateComponentOptions {
  definitionKey: string;
  name?: string;
  layerId: LayerId;
  laneId?: string;
  position: PositionInput;
  rotation?: number;
  parameterOverrides?: Record<string, ParameterValue>;
  provenanceOverrides?: Record<string, ProvenanceSource>;
}

export interface CreateComponentResult {
  component: Component;
  ports: Port[];
  definitionKey: string;
  registryVersion: string;
  definitionRevision: number;
  appliedDefaults: JsonObject;
  warnings: string[];
}

export interface DuplicateComponentOptions {
  sourceComponent: Component;
  sourcePorts: Port[];
  positionOffset?: PositionInput;
  name?: string;
}

export interface DuplicateComponentResult {
  duplicatedComponent: Component;
  duplicatedPorts: Port[];
  componentIdMapping: Record<ComponentId, ComponentId>;
  portIdMapping: Record<PortId, PortId>;
}

export interface CompatibilityContext {
  components: readonly Component[];
  ports: readonly Port[];
  connections: readonly Connection[];
}

export type CompatibilitySeverity = "error" | "warning" | "information";

export interface CompatibilityIssue {
  code: string;
  severity: CompatibilitySeverity;
  message: string;
  sourcePortId: string;
  targetPortId: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  normalizedSourcePortId: string;
  normalizedTargetPortId: string;
  issues: CompatibilityIssue[];
}
