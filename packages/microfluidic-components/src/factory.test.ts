import { describe, expect, it } from "vitest";
import { ComponentSchema, PortSchema } from "project-model";

import {
  DEFINITION_IDENTITY_EXTENSION,
  DEFINITION_PARAMETERS_EXTENSION,
  PORT_TEMPLATE_METADATA,
} from "./types";
import { ComponentFactoryError } from "./errors";
import { createComponentFromDefinition } from "./factory";
import { listComponentDefinitions } from "./registry";

const layerId = "layer_flow";
const position = { x: 1, y: 2 };

describe("component factory", () => {
  it("creates every built-in definition as valid persisted component and ports", () => {
    for (const definition of listComponentDefinitions()) {
      const result = createComponentFromDefinition({
        definitionKey: definition.key,
        layerId,
        position,
      });

      expect(ComponentSchema.parse(result.component)).toEqual(result.component);
      result.ports.forEach((port) => {
        expect(PortSchema.parse(port)).toEqual(port);
        expect(port.componentId).toBe(result.component.id);
        expect(port.metadata[PORT_TEMPLATE_METADATA]).toMatchObject({
          templateKey: expect.any(String),
          medium: expect.any(String),
          role: expect.any(String),
        });
      });
      expect(result.component.kind).toBe(definition.persistedKind);
      expect(result.component.portIds).toEqual(result.ports.map((port) => port.id));
      expect(result.component.extensions[DEFINITION_IDENTITY_EXTENSION]).toEqual({
        definitionKey: definition.key,
        registryVersion: "1.0.0",
        definitionRevision: 1,
      });
    }
  });

  it("normalizes quantity overrides and stores only extension parameters", () => {
    const result = createComponentFromDefinition({
      definitionKey: "filter.debris",
      layerId,
      position,
      parameterOverrides: {
        width: { value: 1000, unit: "um", provenance: { source: "user-entered" } },
        "feature-spacing": {
          value: 100,
          unit: "um",
          provenance: { source: "user-entered" },
        },
      },
      provenanceOverrides: { width: "user-entered" },
    });

    expect(result.component.extensions[DEFINITION_PARAMETERS_EXTENSION]).toEqual({
      "feature-spacing": {
        value: 0.1,
        unit: "mm",
        provenance: { source: "user-entered" },
      },
    });
    expect(
      result.component.extensions[DEFINITION_PARAMETERS_EXTENSION],
    ).not.toHaveProperty("width");
  });

  it("materializes ordinary and specialized junction dimensions into project instances", () => {
    const chamber = createComponentFromDefinition({
      definitionKey: "chamber.reaction",
      layerId,
      position,
    }).component;
    const splitter = createComponentFromDefinition({
      definitionKey: "junction.splitter",
      layerId,
      position,
    }).component;
    const merger = createComponentFromDefinition({
      definitionKey: "junction.merger",
      layerId,
      position,
    }).component;

    expect(chamber.kind).toBe("chamber");
    if (chamber.kind === "chamber") {
      expect(chamber.chamber.dimensions).toMatchObject({
        width: { value: 2, unit: "mm" },
        height: { value: 2, unit: "mm" },
        depth: { value: 0.2, unit: "mm" },
      });
    }
    for (const component of [splitter, merger]) {
      expect(component.kind).toBe("junction");
      if (component.kind === "junction") {
        expect(component.junction.dimensions).toMatchObject({
          width: { value: 2, unit: "mm" },
          height: { value: 1, unit: "mm" },
          depth: { value: 0.2, unit: "mm" },
        });
      }
    }
  });

  it("rejects unknown overrides, invalid units, and lane policy violations", () => {
    expect(() =>
      createComponentFromDefinition({
        definitionKey: "channel.rectangular",
        layerId,
        position,
        parameterOverrides: { unknown: true },
      }),
    ).toThrow(ComponentFactoryError);

    expect(() =>
      createComponentFromDefinition({
        definitionKey: "channel.rectangular",
        layerId,
        position,
        parameterOverrides: {
          width: { value: 1, unit: "s", provenance: { source: "user-entered" } },
        },
      }),
    ).toThrow();

    expect(() =>
      createComponentFromDefinition({
        definitionKey: "interface.optical",
        layerId,
        laneId: "lane_forbidden",
        position,
      }),
    ).toThrow(ComponentFactoryError);
  });

  it("does not mutate source options and creates distinct IDs", () => {
    const options = {
      definitionKey: "channel.circular",
      layerId,
      position,
      parameterOverrides: {
        diameter: { value: 0.5, unit: "mm", provenance: { source: "user-entered" } },
      },
    };
    const first = createComponentFromDefinition(options);
    const second = createComponentFromDefinition(options);

    expect(first.component.id).not.toBe(second.component.id);
    expect(first.ports[0]?.id).not.toBe(second.ports[0]?.id);
    expect(options.parameterOverrides.diameter.value).toBe(0.5);
  });
});
