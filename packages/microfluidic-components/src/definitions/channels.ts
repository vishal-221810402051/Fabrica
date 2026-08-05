import { lengthParameter } from "../parameters";
import { fluidPort } from "../ports";
import type { ComponentDefinition } from "../types";
import { defineComponent } from "./common";

export const channelDefinitions: readonly ComponentDefinition[] = [
  defineComponent({
    key: "channel.rectangular",
    displayName: "Rectangular channel",
    description: "Straight fluidic channel with rectangular cross-section.",
    persistedKind: "channel",
    category: "flow",
    tags: ["channel", "rectangular"],
    parameters: [
      lengthParameter("length", "Length", 10),
      lengthParameter("width", "Width", 0.5),
      lengthParameter("depth", "Depth", 0.2),
    ],
    ports: [fluidPort("in", "Inlet", "input"), fluidPort("out", "Outlet", "output")],
    icon: "channel",
    fixedProperties: { crossSection: "rectangular" },
    manufacturingMetadata: {
      constraintReferences: ["profile.minimum-channel-width"],
    },
  }),
  defineComponent({
    key: "channel.circular",
    displayName: "Circular channel",
    description: "Straight fluidic channel with circular cross-section.",
    persistedKind: "channel",
    category: "flow",
    tags: ["channel", "circular"],
    parameters: [
      lengthParameter("length", "Length", 10),
      lengthParameter("diameter", "Diameter", 0.4),
    ],
    ports: [fluidPort("in", "Inlet", "input"), fluidPort("out", "Outlet", "output")],
    icon: "channel",
    fixedProperties: { crossSection: "circular" },
    manufacturingMetadata: {
      constraintReferences: ["profile.minimum-channel-diameter"],
    },
  }),
];
