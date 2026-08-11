import { fluidPort } from "../ports";
import { lengthParameter, quantity } from "../parameters";
import type { ComponentDefinition } from "../types";
import { defineComponent } from "./common";

const junctionPhysicalGeometry = {
  version: 1,
  footprint: {
    width: quantity(2, "mm"),
    height: quantity(1, "mm"),
    depth: quantity(0.2, "mm"),
  },
} as const;

const splitterMergerDimensionParameters = [
  lengthParameter("width", "Width", 2),
  lengthParameter("height", "Height", 1),
  lengthParameter("depth", "Depth", 0.2),
] as const;

function physicalPort(
  key: string,
  name: string,
  direction: "input" | "output",
  anchor: { x: number; y: number },
) {
  return {
    ...fluidPort(key, name, direction, "generic", anchor),
    metadata: {
      physicalAnchor: anchor,
    },
  };
}

const threePort = [
  fluidPort("in-a", "Input A", "input", "generic", { x: 0, y: 0.25 }),
  fluidPort("in-b", "Input B", "input", "generic", { x: 0, y: 0.75 }),
  fluidPort("out", "Output", "output", "generic", { x: 1, y: 0.5 }),
] as const;

export const junctionDefinitions: readonly ComponentDefinition[] = [
  defineComponent({
    key: "junction.y",
    displayName: "Y-junction",
    description: "Three-port Y-shaped junction.",
    persistedKind: "junction",
    category: "routing",
    tags: ["junction", "y"],
    ports: threePort,
    icon: "junction",
    fixedProperties: { category: "y" },
  }),
  defineComponent({
    key: "junction.t",
    displayName: "T-junction",
    description: "Three-port T-shaped junction.",
    persistedKind: "junction",
    category: "routing",
    tags: ["junction", "t"],
    ports: threePort,
    icon: "junction",
    fixedProperties: { category: "t" },
  }),
  defineComponent({
    key: "junction.splitter",
    displayName: "Splitter",
    description: "Local splitter template without flow-ratio balancing.",
    persistedKind: "junction",
    category: "routing",
    tags: ["junction", "splitter"],
    ports: [
      physicalPort("in", "Input", "input", { x: 0, y: 0.5 }),
      physicalPort("out-a", "Output A", "output", { x: 1, y: 0.25 }),
      physicalPort("out-b", "Output B", "output", { x: 1, y: 0.75 }),
    ],
    parameters: splitterMergerDimensionParameters,
    physicalGeometry: junctionPhysicalGeometry,
    icon: "junction",
    fixedProperties: { category: "splitter" },
  }),
  defineComponent({
    key: "junction.merger",
    displayName: "Merger",
    description: "Local merger template without mixing calculations.",
    persistedKind: "junction",
    category: "routing",
    tags: ["junction", "merger"],
    ports: [
      physicalPort("in-a", "Input A", "input", { x: 0, y: 0.25 }),
      physicalPort("in-b", "Input B", "input", { x: 0, y: 0.75 }),
      physicalPort("out", "Output", "output", { x: 1, y: 0.5 }),
    ],
    parameters: splitterMergerDimensionParameters,
    physicalGeometry: junctionPhysicalGeometry,
    icon: "junction",
    fixedProperties: { category: "merger" },
  }),
  {
    ...defineComponent({
      key: "junction.manifold",
      displayName: "Manifold",
      description:
        "Legacy shared multi-connect manifold template. Prefer splitter or merger for new branching.",
      persistedKind: "junction",
      category: "routing",
      tags: ["junction", "manifold", "shared", "legacy"],
      ports: [
        {
          ...fluidPort("shared", "Shared manifold port", "bidirectional"),
          maxConnections: null,
        },
      ],
      lanePolicy: "shared",
      icon: "junction",
      fixedProperties: { category: "manifold" },
    }),
    deprecated: true,
    replacementKey: "junction.splitter",
  },
  defineComponent({
    key: "junction.generic",
    displayName: "Generic junction",
    description: "Generic bidirectional junction.",
    persistedKind: "junction",
    category: "routing",
    tags: ["junction", "generic"],
    ports: [
      fluidPort("a", "Port A", "bidirectional", "generic", { x: 0, y: 0.5 }),
      fluidPort("b", "Port B", "bidirectional", "generic", { x: 1, y: 0.5 }),
    ],
    icon: "junction",
    fixedProperties: { category: "generic" },
  }),
];
