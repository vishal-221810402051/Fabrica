import { describe, expect, it } from "vitest";
import type { Connection } from "project-model";

import { checkPortCompatibility } from "./compatibility";
import { createComponentFromDefinition } from "./factory";
import { PORT_TEMPLATE_METADATA } from "./types";

function created(definitionKey: string, layerId = "layer_flow", laneId?: string) {
  return createComponentFromDefinition({
    definitionKey,
    layerId,
    ...(laneId ? { laneId } : {}),
    position: { x: 0, y: 0 },
  });
}

function context(items: ReturnType<typeof created>[], connections: Connection[] = []) {
  return {
    components: items.map((item) => item.component),
    ports: items.flatMap((item) => item.ports),
    connections,
  };
}

function port(item: ReturnType<typeof created>, key: string) {
  return item.ports.find((candidate) => candidate.name.toLowerCase().includes(key))!;
}

describe("port compatibility", () => {
  it("accepts legal direction combinations", () => {
    const channel = created("channel.rectangular");
    const filter = created("filter.debris");
    const target = created("junction.generic");
    const splitter = created("junction.generic");

    expect(
      checkPortCompatibility({
        sourcePortId: port(channel, "outlet").id,
        targetPortId: port(filter, "input").id,
        context: context([channel, filter]),
      }).compatible,
    ).toBe(true);
    expect(
      checkPortCompatibility({
        sourcePortId: port(channel, "outlet").id,
        targetPortId: port(target, "port a").id,
        context: context([channel, target]),
      }).compatible,
    ).toBe(true);
    expect(
      checkPortCompatibility({
        sourcePortId: port(target, "port a").id,
        targetPortId: port(splitter, "port b").id,
        context: context([target, splitter]),
      }).compatible,
    ).toBe(true);
    expect(
      checkPortCompatibility({
        sourcePortId: port(target, "port a").id,
        targetPortId: port(filter, "input").id,
        context: context([target, filter]),
      }).compatible,
    ).toBe(true);
  });

  it("reports direction, medium, role, same-port, and same-component errors", () => {
    const channel = created("channel.rectangular");
    const filter = created("filter.debris");
    const trap = created("trap.bubble");
    const valve = created("valve.generic");
    const sensor = created("interface.sensor");
    const optical = created("interface.optical");
    const waste = created("reservoir.waste");
    const sample = created("reservoir.sample-inlet");

    expect(
      checkPortCompatibility({
        sourcePortId: port(channel, "inlet").id,
        targetPortId: port(channel, "outlet").id,
        context: context([channel]),
      }).issues.map((issue) => issue.code),
    ).toEqual(
      expect.arrayContaining([
        "SAME_COMPONENT_FORBIDDEN",
        "REVERSE_DIRECTION_REQUIRED",
      ]),
    );
    expect(
      checkPortCompatibility({
        sourcePortId: port(channel, "inlet").id,
        targetPortId: port(filter, "input").id,
        context: context([channel, filter]),
      }).issues.map((issue) => issue.code),
    ).toContain("DIRECTION_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: port(channel, "outlet").id,
        targetPortId: port(filter, "output").id,
        context: context([channel, filter]),
      }).issues.map((issue) => issue.code),
    ).toContain("DIRECTION_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: port(channel, "outlet").id,
        targetPortId: valve.ports.find(
          (candidate) => candidate.name === "Pneumatic control",
        )!.id,
        context: context([channel, valve]),
      }).issues.map((issue) => issue.code),
    ).toContain("MEDIUM_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: trap.ports.find((candidate) => candidate.name === "Gas vent")!.id,
        targetPortId: port(channel, "inlet").id,
        context: context([trap, channel]),
      }).issues.map((issue) => issue.code),
    ).toContain("MEDIUM_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: sensor.ports[0]!.id,
        targetPortId: port(channel, "inlet").id,
        context: context([sensor, channel]),
      }).issues.map((issue) => issue.code),
    ).toContain("MEDIUM_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: optical.ports[0]!.id,
        targetPortId: port(channel, "inlet").id,
        context: context([optical, channel]),
      }).issues.map((issue) => issue.code),
    ).toContain("MEDIUM_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: waste.ports[0]!.id,
        targetPortId: sample.ports[0]!.id,
        context: context([waste, sample]),
      }).issues.map((issue) => issue.code),
    ).toContain("ROLE_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: channel.ports[0]!.id,
        targetPortId: channel.ports[0]!.id,
        context: context([channel]),
      }).issues.map((issue) => issue.code),
    ).toContain("SAME_PORT");
  });

  it("enforces layer, lane, capacity, duplicates, and unknown metadata", () => {
    const source = created("channel.rectangular", "layer_a", "lane_a");
    const target = created("channel.rectangular", "layer_b", "lane_b");
    const opticalA = created("interface.optical", "layer_a");
    const opticalB = created("interface.optical", "layer_b");
    const manifold = created("junction.manifold", "layer_a");
    const sharedTarget = created("channel.rectangular", "layer_a", "lane_b");
    const unlabeledTarget = created("channel.rectangular", "layer_a");
    const connection = {
      id: "connection_existing",
      sourcePortId: source.ports[1]!.id,
      targetPortId: target.ports[0]!.id,
      metadata: {},
    } as Connection;

    expect(
      checkPortCompatibility({
        sourcePortId: source.ports[1]!.id,
        targetPortId: target.ports[0]!.id,
        context: context([source, target]),
      }).issues.map((issue) => issue.code),
    ).toEqual(expect.arrayContaining(["LAYER_INCOMPATIBLE", "LANE_INCOMPATIBLE"]));
    expect(
      checkPortCompatibility({
        sourcePortId: source.ports[1]!.id,
        targetPortId: unlabeledTarget.ports[0]!.id,
        context: context([source, unlabeledTarget]),
      }).issues.map((issue) => issue.code),
    ).toContain("LANE_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: opticalA.ports[0]!.id,
        targetPortId: opticalB.ports[0]!.id,
        context: context([opticalA, opticalB]),
      }).issues.map((issue) => issue.code),
    ).not.toContain("LAYER_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: manifold.ports[0]!.id,
        targetPortId: sharedTarget.ports[0]!.id,
        context: context([manifold, sharedTarget]),
      }).issues.map((issue) => issue.code),
    ).not.toContain("LANE_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: source.ports[1]!.id,
        targetPortId: target.ports[0]!.id,
        context: context([source, target], [connection]),
      }).issues.map((issue) => issue.code),
    ).toEqual(
      expect.arrayContaining([
        "DUPLICATE_CONNECTION",
        "SOURCE_CAPACITY_EXCEEDED",
        "TARGET_CAPACITY_EXCEEDED",
      ]),
    );

    const unknown = structuredClone(source.component);
    unknown.extensions = {};
    expect(
      checkPortCompatibility({
        sourcePortId: source.ports[1]!.id,
        targetPortId: target.ports[0]!.id,
        context: {
          components: [unknown, target.component],
          ports: [...source.ports, ...target.ports],
          connections: [],
        },
      }).issues.map((issue) => issue.code),
    ).toContain("UNKNOWN_DEFINITION");

    const unknownTemplatePort = structuredClone(source.ports[1]!);
    unknownTemplatePort.metadata = {};
    expect(
      checkPortCompatibility({
        sourcePortId: unknownTemplatePort.id,
        targetPortId: target.ports[0]!.id,
        context: {
          components: [source.component, target.component],
          ports: [source.ports[0]!, unknownTemplatePort, ...target.ports],
          connections: [],
        },
      }).issues.map((issue) => issue.code),
    ).toContain("UNKNOWN_PORT_TEMPLATE");

    const mismatchedTemplatePort = structuredClone(source.ports[1]!);
    mismatchedTemplatePort.metadata = {
      ...mismatchedTemplatePort.metadata,
      [PORT_TEMPLATE_METADATA]: {
        ...mismatchedTemplatePort.metadata[PORT_TEMPLATE_METADATA],
        medium: "gas",
      },
    };
    expect(
      checkPortCompatibility({
        sourcePortId: mismatchedTemplatePort.id,
        targetPortId: target.ports[0]!.id,
        context: {
          components: [source.component, target.component],
          ports: [source.ports[0]!, mismatchedTemplatePort, ...target.ports],
          connections: [],
        },
      }).issues.map((issue) => issue.code),
    ).toContain("PORT_TEMPLATE_MISMATCH");
  });
});
