import { enumParameter, lengthParameter } from "../parameters";
import { interfacePort } from "../ports";
import type { ComponentDefinition } from "../types";
import { defineComponent, lengthWidthDepthParameters } from "./common";

export const interfaceDefinitions: readonly ComponentDefinition[] = [
  defineComponent({
    key: "interface.sensor",
    displayName: "Sensor interface",
    description: "Sensor interface metadata without measurement validation.",
    persistedKind: "sensor-interface",
    category: "sensing",
    tags: ["sensor", "interface"],
    parameters: [
      lengthParameter("width", "Width", 2),
      lengthParameter("height", "Height", 1),
      enumParameter(
        "interface-type",
        "Interface type",
        ["electrical", "electrochemical", "thermal", "pressure", "generic"],
        "generic",
        "first-class",
      ),
      enumParameter(
        "measurement-category",
        "Measurement category",
        ["temperature", "pressure", "flow", "conductivity", "optical", "generic"],
        "generic",
        "first-class",
      ),
    ],
    ports: [
      interfacePort(
        "signal",
        "Sensor signal",
        "bidirectional",
        "electrical",
        "detection",
      ),
    ],
    layerPolicy: "layer-agnostic",
    lanePolicy: "forbidden",
    icon: "interface",
  }),
  defineComponent({
    key: "interface.optical",
    displayName: "Optical interface",
    description: "Optical interface metadata without optical modeling.",
    persistedKind: "optical-interface",
    category: "detection",
    tags: ["optical", "interface"],
    parameters: [
      lengthParameter("width", "Width", 2),
      lengthParameter("height", "Height", 1),
      enumParameter(
        "interface-type",
        "Interface type",
        ["window", "waveguide", "fiber-coupling", "detection-zone", "generic"],
        "window",
        "first-class",
      ),
      enumParameter(
        "measurement-category",
        "Measurement category",
        ["absorbance", "fluorescence", "scattering", "imaging", "generic"],
        "generic",
        "first-class",
      ),
    ],
    ports: [
      interfacePort("optical", "Optical path", "bidirectional", "optical", "detection"),
    ],
    layerPolicy: "layer-agnostic",
    lanePolicy: "forbidden",
    icon: "interface",
    manufacturingMetadata: { requiresOpticalWindow: true },
  }),
  defineComponent({
    key: "interface.external.generic",
    displayName: "Generic external interface",
    description: "Generic external interface without executable behavior.",
    persistedKind: "generic",
    category: "interface",
    tags: ["external", "interface", "generic"],
    parameters: lengthWidthDepthParameters,
    ports: [
      interfacePort("external", "External port", "bidirectional", "generic", "generic"),
    ],
    layerPolicy: "layer-agnostic",
    lanePolicy: "forbidden",
    icon: "interface",
    allowsGenericCompatibility: true,
  }),
];
