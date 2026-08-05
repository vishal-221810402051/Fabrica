import { fluidPort } from "../ports";
import type { ComponentDefinition, PortRole } from "../types";
import { boxWithOptionalVolumeParameters, defineComponent } from "./common";

function reservoir(
  key: string,
  name: string,
  category: string,
  direction: "input" | "output" | "bidirectional",
  role: PortRole,
  lanePolicy: ComponentDefinition["lanePolicy"] = "optional",
): ComponentDefinition {
  return defineComponent({
    key,
    displayName: name,
    description: `${name} reservoir interface.`,
    persistedKind: "reservoir",
    category:
      role === "waste"
        ? "waste"
        : role === "sample"
          ? "sample-handling"
          : "reagent-handling",
    tags: ["reservoir", category],
    parameters: boxWithOptionalVolumeParameters,
    ports: [
      fluidPort(direction === "input" ? "in" : "out", "Fluid port", direction, role),
    ],
    lanePolicy,
    icon: "reservoir",
    fixedProperties: { category },
  });
}

export const reservoirDefinitions: readonly ComponentDefinition[] = [
  reservoir(
    "reservoir.generic",
    "Generic reservoir",
    "generic",
    "bidirectional",
    "generic",
  ),
  reservoir("reservoir.sample-inlet", "Sample inlet", "inlet", "output", "sample"),
  reservoir("reservoir.reagent-inlet", "Reagent inlet", "reagent", "output", "reagent"),
  reservoir("reservoir.outlet", "Outlet", "outlet", "input", "generic"),
  reservoir("reservoir.waste", "Waste reservoir", "waste", "input", "waste", "shared"),
];
