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

  it("rejects repeated ordinary fan-out and fan-in through the same physical port", () => {
    const source = created("reservoir.sample-inlet");
    const firstTarget = created("chamber.reaction");
    const secondTarget = created("chamber.metering");
    const output = source.ports[0]!;
    const firstInput = firstTarget.ports.find(
      (candidate) => candidate.direction === "input",
    )!;
    const secondInput = secondTarget.ports.find(
      (candidate) => candidate.direction === "input",
    )!;

    expect(
      checkPortCompatibility({
        sourcePortId: output.id,
        targetPortId: secondInput.id,
        context: context(
          [source, firstTarget, secondTarget],
          [
            {
              id: "connection_existing",
              sourcePortId: output.id,
              targetPortId: firstInput.id,
              metadata: {},
            } as Connection,
          ],
        ),
      }).issues.map((issue) => issue.code),
    ).toContain("SOURCE_CAPACITY_EXCEEDED");

    const secondSource = created("reservoir.reagent-inlet");
    expect(
      checkPortCompatibility({
        sourcePortId: secondSource.ports[0]!.id,
        targetPortId: firstInput.id,
        context: context(
          [source, secondSource, firstTarget],
          [
            {
              id: "connection_existing",
              sourcePortId: output.id,
              targetPortId: firstInput.id,
              metadata: {},
            } as Connection,
          ],
        ),
      }).issues.map((issue) => issue.code),
    ).toContain("TARGET_CAPACITY_EXCEEDED");
  });

  it("allows splitter and merger topology only through separate persisted ports", () => {
    const reservoir = created("reservoir.sample-inlet");
    const splitter = created("junction.splitter");
    const chamberA = created("chamber.reaction");
    const chamberB = created("chamber.metering");
    const splitterInput = splitter.ports.find(
      (candidate) => candidate.name === "Input",
    )!;
    const splitterOutputs = splitter.ports.filter(
      (candidate) => candidate.direction === "output",
    );
    const chamberInputs = [chamberA, chamberB].map((item) =>
      item.ports.find((candidate) => candidate.direction === "input")!,
    );
    const splitContext = context(
      [reservoir, splitter, chamberA, chamberB],
      [
        {
          id: "connection_to_splitter",
          sourcePortId: reservoir.ports[0]!.id,
          targetPortId: splitterInput.id,
          metadata: {},
        } as Connection,
        {
          id: "connection_branch_a",
          sourcePortId: splitterOutputs[0]!.id,
          targetPortId: chamberInputs[0]!.id,
          metadata: {},
        } as Connection,
      ],
    );

    expect(
      checkPortCompatibility({
        sourcePortId: splitterOutputs[1]!.id,
        targetPortId: chamberInputs[1]!.id,
        context: splitContext,
      }).compatible,
    ).toBe(true);

    const sourceA = created("reservoir.sample-inlet");
    const sourceB = created("reservoir.reagent-inlet");
    const merger = created("junction.merger");
    const outlet = created("reservoir.outlet");
    const mergerInputs = merger.ports.filter(
      (candidate) => candidate.direction === "input",
    );
    const mergerOutput = merger.ports.find(
      (candidate) => candidate.direction === "output",
    )!;
    const mergeContext = context(
      [sourceA, sourceB, merger, outlet],
      [
        {
          id: "connection_input_a",
          sourcePortId: sourceA.ports[0]!.id,
          targetPortId: mergerInputs[0]!.id,
          metadata: {},
        } as Connection,
        {
          id: "connection_to_outlet",
          sourcePortId: mergerOutput.id,
          targetPortId: outlet.ports[0]!.id,
          metadata: {},
        } as Connection,
      ],
    );

    expect(
      checkPortCompatibility({
        sourcePortId: sourceB.ports[0]!.id,
        targetPortId: mergerInputs[1]!.id,
        context: mergeContext,
      }).compatible,
    ).toBe(true);
  });

  it("rejects output-to-output, input-to-input, and new legacy manifold branching", () => {
    const channel = created("channel.rectangular");
    const filter = created("filter.debris");
    const manifold = created("junction.manifold");
    const targetA = created("channel.circular");
    const targetB = created("channel.rectangular");

    expect(
      checkPortCompatibility({
        sourcePortId: port(channel, "outlet").id,
        targetPortId: port(filter, "output").id,
        context: context([channel, filter]),
      }).issues.map((issue) => issue.code),
    ).toContain("DIRECTION_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: port(channel, "inlet").id,
        targetPortId: port(filter, "input").id,
        context: context([channel, filter]),
      }).issues.map((issue) => issue.code),
    ).toContain("DIRECTION_INCOMPATIBLE");
    expect(
      checkPortCompatibility({
        sourcePortId: manifold.ports[0]!.id,
        targetPortId: targetB.ports[0]!.id,
        context: context(
          [manifold, targetA, targetB],
          [
            {
              id: "connection_existing",
              sourcePortId: manifold.ports[0]!.id,
              targetPortId: targetA.ports[0]!.id,
              metadata: {},
            } as Connection,
          ],
        ),
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "LEGACY_MANIFOLD_CAPACITY_EXCEEDED",
          message: expect.stringContaining("use splitter or merger"),
        }),
      ]),
    );
  });
});
