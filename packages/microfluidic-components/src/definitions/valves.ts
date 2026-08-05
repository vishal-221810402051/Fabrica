import { booleanParameter } from "../parameters";
import { fluidPort, interfacePort } from "../ports";
import type { ComponentDefinition } from "../types";
import { defineComponent } from "./common";

function valve(
  key: string,
  name: string,
  normallyOpen: boolean | null,
): ComponentDefinition {
  return defineComponent({
    key,
    displayName: name,
    description: `${name} with local liquid path and optional control metadata.`,
    persistedKind: "valve",
    category: "control",
    tags: ["valve", "control"],
    parameters:
      normallyOpen === null
        ? [booleanParameter("normally-open", "Normally open", false)]
        : [],
    ports: [
      fluidPort("in", "Flow input", "input", "generic", { x: 0, y: 0.5 }),
      fluidPort("out", "Flow output", "output", "generic", { x: 1, y: 0.5 }),
      interfacePort(
        "control",
        "Pneumatic control",
        "input",
        "pneumatic-control",
        "control",
      ),
    ],
    icon: "valve",
    fixedProperties: {
      category: "pneumatic",
      ...(normallyOpen === null ? {} : { normallyOpen }),
    },
    manufacturingMetadata: {
      requiresMembrane: true,
      constraintReferences: ["profile.valve-membrane-compatibility"],
    },
  });
}

export const valveDefinitions: readonly ComponentDefinition[] = [
  valve("valve.generic", "Generic valve", null),
  valve("valve.normally-closed", "Normally closed valve", false),
  valve("valve.normally-open", "Normally open valve", true),
];
