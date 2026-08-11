import { describe, expect, it } from "vitest";
import { ComponentSchema, PortSchema } from "project-model";

import { duplicateComponentInstance } from "./duplication";
import { ComponentDuplicationError } from "./errors";
import { createComponentFromDefinition } from "./factory";

describe("component duplication", () => {
  it("duplicates component and owned ports with mappings and source immutability", () => {
    const source = createComponentFromDefinition({
      definitionKey: "channel.rectangular",
      layerId: "layer_flow",
      laneId: "lane_sample",
      position: { x: 1, y: 2 },
      parameterOverrides: {
        width: { value: 0.7, unit: "mm", provenance: { source: "user-entered" } },
      },
    });
    const before = structuredClone(source);
    const duplicate = duplicateComponentInstance({
      sourceComponent: source.component,
      sourcePorts: source.ports,
      positionOffset: { x: 3, y: 4 },
    });

    expect(ComponentSchema.parse(duplicate.duplicatedComponent)).toEqual(
      duplicate.duplicatedComponent,
    );
    duplicate.duplicatedPorts.forEach((port) =>
      expect(PortSchema.parse(port)).toEqual(port),
    );
    expect(duplicate.duplicatedComponent.id).not.toBe(source.component.id);
    expect(duplicate.duplicatedPorts.map((port) => port.id)).not.toEqual(
      source.ports.map((port) => port.id),
    );
    expect(duplicate.duplicatedComponent.layerId).toBe(source.component.layerId);
    expect(duplicate.duplicatedComponent.laneId).toBe(source.component.laneId);
    expect(duplicate.duplicatedComponent.position.x.value).toBe(4);
    expect(duplicate.duplicatedComponent.position.y.value).toBe(6);
    expect(source).toEqual(before);
  });

  it("rejects invalid source port ownership", () => {
    const source = createComponentFromDefinition({
      definitionKey: "channel.circular",
      layerId: "layer_flow",
      position: { x: 0, y: 0 },
    });
    const wrongPort = { ...source.ports[0]!, componentId: "component_other" };

    expect(() =>
      duplicateComponentInstance({
        sourceComponent: source.component,
        sourcePorts: [wrongPort, source.ports[1]!],
      }),
    ).toThrow(ComponentDuplicationError);
  });

  it("duplicates custom merger instance dimensions without reading registry defaults", () => {
    const source = createComponentFromDefinition({
      definitionKey: "junction.merger",
      layerId: "layer_flow",
      position: { x: 1, y: 2 },
      parameterOverrides: {
        width: { value: 3, unit: "mm", provenance: { source: "user-entered" } },
        height: { value: 1.5, unit: "mm", provenance: { source: "user-entered" } },
        depth: { value: 0.25, unit: "mm", provenance: { source: "user-entered" } },
      },
    });

    const duplicate = duplicateComponentInstance({
      sourceComponent: source.component,
      sourcePorts: source.ports,
    });

    expect(duplicate.duplicatedComponent.kind).toBe("junction");
    if (duplicate.duplicatedComponent.kind === "junction") {
      expect(duplicate.duplicatedComponent.junction.dimensions).toMatchObject({
        width: { value: 3, unit: "mm" },
        height: { value: 1.5, unit: "mm" },
        depth: { value: 0.25, unit: "mm" },
      });
    }
  });
});
