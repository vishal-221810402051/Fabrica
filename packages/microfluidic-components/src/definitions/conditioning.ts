import { lengthParameter } from "../parameters";
import { fluidPort, interfacePort } from "../ports";
import type { ComponentDefinition } from "../types";
import {
  boxWithOptionalVolumeParameters,
  defineComponent,
  lengthWidthDepthParameters,
} from "./common";

export const conditioningDefinitions: readonly ComponentDefinition[] = [
  defineComponent({
    key: "filter.debris",
    displayName: "Debris filter",
    description: "Generic debris-filter placeholder without clogging calculations.",
    persistedKind: "generic",
    category: "filtration",
    tags: ["filter", "debris"],
    parameters: [
      ...lengthWidthDepthParameters,
      lengthParameter("feature-spacing", "Feature spacing", 0.05, "extension"),
    ],
    ports: [fluidPort("in", "Input", "input"), fluidPort("out", "Output", "output")],
    icon: "generic",
    manufacturingMetadata: {
      constraintReferences: ["profile.minimum-filter-feature-spacing"],
    },
  }),
  defineComponent({
    key: "trap.bubble",
    displayName: "Bubble trap",
    description: "Bubble trap with liquid path and gas vent metadata.",
    persistedKind: "generic",
    category: "gas-management",
    tags: ["trap", "bubble", "vent"],
    parameters: lengthWidthDepthParameters,
    ports: [
      fluidPort("in", "Liquid input", "input"),
      fluidPort("out", "Liquid output", "output"),
      interfacePort("vent", "Gas vent", "output", "gas", "vent"),
    ],
    icon: "generic",
    manufacturingMetadata: { requiresVent: true },
  }),
  defineComponent({
    key: "mixer.passive",
    displayName: "Passive mixer",
    description: "Passive mixer template without mixing-performance calculations.",
    persistedKind: "chamber",
    category: "mixing",
    tags: ["mixer", "passive"],
    parameters: boxWithOptionalVolumeParameters,
    ports: [
      fluidPort("in-a", "Input A", "input", "generic", { x: 0, y: 0.3 }),
      fluidPort("in-b", "Input B", "input", "generic", { x: 0, y: 0.7 }),
      fluidPort("out", "Output", "output", "generic", { x: 1, y: 0.5 }),
    ],
    icon: "chamber",
    fixedProperties: { category: "mixing" },
  }),
];
