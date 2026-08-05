import { fluidPort } from "../ports";
import type { ComponentDefinition } from "../types";
import { defineComponent } from "./common";

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
      fluidPort("in", "Input", "input", "generic", { x: 0, y: 0.5 }),
      fluidPort("out-a", "Output A", "output", "generic", { x: 1, y: 0.25 }),
      fluidPort("out-b", "Output B", "output", "generic", { x: 1, y: 0.75 }),
    ],
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
    ports: threePort,
    icon: "junction",
    fixedProperties: { category: "merger" },
  }),
  defineComponent({
    key: "junction.manifold",
    displayName: "Manifold",
    description: "Shared multi-connect manifold template.",
    persistedKind: "junction",
    category: "routing",
    tags: ["junction", "manifold", "shared"],
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
