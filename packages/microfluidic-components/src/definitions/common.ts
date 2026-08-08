import { icons } from "../icons";
import { lengthParameter, quantity, volumeParameter } from "../parameters";
import type {
  ComponentCategory,
  ComponentDefinition,
  LanePolicy,
  LayerPolicy,
  ManufacturingMetadata,
  ParameterDefinition,
  PersistedKind,
  PortTemplate,
} from "../types";

const defaultManufacturingMetadata: ManufacturingMetadata = {
  capabilityTags: [],
  allowedProcessCategories: [],
  allowedMaterialCategories: [],
  constraintReferences: [],
  notes: "Informational metadata only; not a manufacturing validation result.",
};

export function defineComponent(input: {
  key: string;
  displayName: string;
  defaultInstanceName?: string;
  description: string;
  persistedKind: PersistedKind;
  category: ComponentCategory;
  tags?: readonly string[];
  parameters?: readonly ParameterDefinition[];
  ports: readonly PortTemplate[];
  layerPolicy?: LayerPolicy;
  lanePolicy?: LanePolicy;
  schematicShapeKey?: string;
  icon: keyof typeof icons;
  fixedProperties?: ComponentDefinition["fixedProperties"];
  manufacturingMetadata?: Partial<ManufacturingMetadata>;
  physicalGeometry?: ComponentDefinition["physicalGeometry"];
  allowsGenericCompatibility?: boolean;
}): ComponentDefinition {
  const definition: ComponentDefinition = {
    key: input.key,
    definitionRevision: 1,
    displayName: input.displayName,
    defaultInstanceName: input.defaultInstanceName ?? input.displayName,
    description: input.description,
    persistedKind: input.persistedKind,
    category: input.category,
    tags: input.tags ?? [],
    parameters: input.parameters ?? [],
    ports: input.ports,
    layerPolicy: input.layerPolicy ?? "same-layer",
    lanePolicy: input.lanePolicy ?? "optional",
    geometryHints: {
      schematicShapeKey: input.schematicShapeKey ?? input.icon,
      nominalFootprint: { width: quantity(2, "mm"), height: quantity(1, "mm") },
      preferredAspectRatio: 2,
      rotationSymmetry: 2,
      minimumVisualSpacingHint: quantity(0.5, "mm"),
    },
    ...(input.physicalGeometry ? { physicalGeometry: input.physicalGeometry } : {}),
    manufacturingMetadata: {
      ...defaultManufacturingMetadata,
      ...input.manufacturingMetadata,
      capabilityTags:
        input.manufacturingMetadata?.capabilityTags ??
        defaultManufacturingMetadata.capabilityTags,
      allowedProcessCategories:
        input.manufacturingMetadata?.allowedProcessCategories ??
        defaultManufacturingMetadata.allowedProcessCategories,
      allowedMaterialCategories:
        input.manufacturingMetadata?.allowedMaterialCategories ??
        defaultManufacturingMetadata.allowedMaterialCategories,
      constraintReferences:
        input.manufacturingMetadata?.constraintReferences ??
        defaultManufacturingMetadata.constraintReferences,
    },
    icon: icons[input.icon],
    deprecated: false,
    fixedProperties: input.fixedProperties ?? {},
  };
  if (input.allowsGenericCompatibility !== undefined) {
    definition.allowsGenericCompatibility = input.allowsGenericCompatibility;
  }
  return definition;
}

export const lengthWidthDepthParameters = [
  lengthParameter("width", "Width", 2),
  lengthParameter("height", "Height", 2),
  lengthParameter("depth", "Depth", 0.2),
] as const;

export const boxWithOptionalVolumeParameters = [
  ...lengthWidthDepthParameters,
  volumeParameter("declared-volume", "Declared volume", null, false),
] as const;
