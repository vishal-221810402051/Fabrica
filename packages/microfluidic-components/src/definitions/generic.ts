import { textParameter } from "../parameters";
import { interfacePort } from "../ports";
import type { ComponentDefinition } from "../types";
import { defineComponent, lengthWidthDepthParameters } from "./common";

export const genericDefinitions: readonly ComponentDefinition[] = [
  defineComponent({
    key: "generic.custom",
    displayName: "Generic custom component",
    description: "Constrained custom component placeholder without plugins.",
    persistedKind: "generic",
    category: "generic",
    tags: ["custom", "generic"],
    parameters: [
      ...lengthWidthDepthParameters,
      textParameter("custom-note", "Custom note", ""),
    ],
    ports: [
      interfacePort("generic", "Generic port", "bidirectional", "generic", "generic"),
    ],
    layerPolicy: "layer-agnostic",
    lanePolicy: "optional",
    icon: "generic",
    allowsGenericCompatibility: true,
  }),
];
