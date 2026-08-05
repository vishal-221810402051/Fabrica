import { fluidPort } from "../ports";
import type { ComponentDefinition } from "../types";
import { boxWithOptionalVolumeParameters, defineComponent } from "./common";

function chamber(key: string, name: string, category: string): ComponentDefinition {
  return defineComponent({
    key,
    displayName: name,
    description: `${name} template without deferred calculations.`,
    persistedKind: "chamber",
    category:
      category === "metering" ||
      category === "mixing" ||
      category === "reaction" ||
      category === "incubation" ||
      category === "detection"
        ? category
        : "reaction",
    tags: ["chamber", category],
    parameters: boxWithOptionalVolumeParameters,
    ports: [
      fluidPort("in", "Inlet", "input", "generic", { x: 0, y: 0.5 }),
      fluidPort("out", "Outlet", "output", "generic", { x: 1, y: 0.5 }),
    ],
    icon: "chamber",
    fixedProperties: { category },
  });
}

export const chamberDefinitions: readonly ComponentDefinition[] = [
  chamber("chamber.generic", "Generic chamber", "generic"),
  chamber("chamber.metering", "Metering chamber", "metering"),
  chamber("chamber.reaction", "Reaction chamber", "reaction"),
  chamber("chamber.incubation", "Incubation chamber", "incubation"),
  defineComponent({
    key: "chamber.mixing",
    displayName: "Mixing chamber",
    description: "Mixing chamber template without mixing efficiency calculations.",
    persistedKind: "chamber",
    category: "mixing",
    tags: ["chamber", "mixing"],
    parameters: boxWithOptionalVolumeParameters,
    ports: [
      fluidPort("in-a", "Input A", "input", "generic", { x: 0, y: 0.3 }),
      fluidPort("in-b", "Input B", "input", "generic", { x: 0, y: 0.7 }),
      fluidPort("out", "Output", "output", "generic", { x: 1, y: 0.5 }),
    ],
    icon: "chamber",
    fixedProperties: { category: "mixing" },
  }),
  chamber("chamber.detection", "Detection chamber", "detection"),
  chamber("chamber.neutralization", "Neutralization chamber", "neutralization"),
];
