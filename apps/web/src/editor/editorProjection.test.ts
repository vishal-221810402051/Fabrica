import { describe, expect, it } from "vitest";

import { makeProject } from "../test/factories";
import {
  createProjectConnection,
  insertComponentFromDefinition,
} from "./editorActions";
import { deriveEditorProjection, indexConnectionCounts } from "./editorProjection";
import { createHandleId } from "./handleIds";

describe("editor projection", () => {
  it("derives nodes, ports, and edges from the authoritative project", () => {
    const base = makeProject();
    const first = insertComponentFromDefinition(base, {
      definitionKey: "channel.rectangular",
      layerId: base.layers[0]!.id,
      position: { x: 1, y: 2 },
    }).project;
    const second = insertComponentFromDefinition(first, {
      definitionKey: "filter.debris",
      layerId: base.layers[0]!.id,
      position: { x: 5, y: 2 },
    }).project;
    const source = second.ports.find(
      (port) =>
        port.componentId === second.components[0]!.id && port.direction === "output",
    )!;
    const target = second.ports.find(
      (port) =>
        port.componentId === second.components[1]!.id && port.direction === "input",
    )!;
    const connected = createProjectConnection(second, source.id, target.id).project;
    const before = JSON.stringify(connected);
    const projection = deriveEditorProjection(connected, {
      selectedComponentIds: [connected.components[0]!.id],
      selectedConnectionIds: [connected.connections[0]!.id],
    });

    expect(projection.nodes[0]!.id).toBe(connected.components[0]!.id);
    expect(projection.nodes[0]!.position).toEqual({ x: 24, y: 48 });
    expect(projection.edges[0]!.id).toBe(connected.connections[0]!.id);
    expect(projection.edges[0]!.type).toBe("physicalRoute");
    expect(projection.edges[0]!.sourceHandle).toBe(createHandleId(source.id, "source"));
    expect(projection.edges[0]!.targetHandle).toBe(createHandleId(target.id, "target"));
    expect(projection.nodes[0]!.data.ports.length).toBe(2);
    expect(projection.edges[0]!.data!.routePoints).toHaveLength(2);
    expect(JSON.stringify(connected)).toBe(before);
  });

  it("handles bidirectional ports with distinct visual handles", () => {
    const base = makeProject();
    const inserted = insertComponentFromDefinition(base, {
      definitionKey: "interface.sensor",
      layerId: base.layers[0]!.id,
      position: { x: 1, y: 1 },
    }).project;
    const projection = deriveEditorProjection(inserted, {
      selectedComponentIds: [],
      selectedConnectionIds: [],
    });
    const port = projection.nodes[0]!.data.ports[0]!;

    expect(port.sourceHandleId).not.toBe(port.targetHandleId);
    expect(port.sourceHandleId).toContain(port.portId);
    expect(port.targetHandleId).toContain(port.portId);
    expect(port.inputAnchor).toEqual({ x: 0, y: 0.5 });
    expect(port.outputAnchor).toEqual({ x: 1, y: 0.5 });
  });

  it("orders multiple inputs and outputs deterministically without overlap", () => {
    const base = makeProject();
    const withSplitter = insertComponentFromDefinition(base, {
      definitionKey: "junction.splitter",
      layerId: base.layers[0]!.id,
      position: { x: 1, y: 1 },
    }).project;
    const withMerger = insertComponentFromDefinition(withSplitter, {
      definitionKey: "junction.merger",
      layerId: base.layers[0]!.id,
      position: { x: 3, y: 1 },
    }).project;
    const projection = deriveEditorProjection(withMerger, {
      selectedComponentIds: [],
      selectedConnectionIds: [],
    });
    const splitter = projection.nodes.find(
      (node) => node.data.definitionKey === "junction.splitter",
    )!;
    const merger = projection.nodes.find(
      (node) => node.data.definitionKey === "junction.merger",
    )!;
    const splitterOutputs = splitter.data.ports.filter(
      (port) => port.direction === "output",
    );
    const mergerInputs = merger.data.ports.filter((port) => port.direction === "input");

    expect(splitterOutputs.map((port) => port.templateKey)).toEqual(["out-a", "out-b"]);
    expect(splitterOutputs.map((port) => port.outputAnchor)).toEqual([
      { x: 1, y: 0.25 },
      { x: 1, y: 0.75 },
    ]);
    expect(mergerInputs.map((port) => port.templateKey)).toEqual(["in-a", "in-b"]);
    expect(mergerInputs.map((port) => port.inputAnchor)).toEqual([
      { x: 0, y: 0.25 },
      { x: 0, y: 0.75 },
    ]);
  });

  it("projects target scale deterministically without mutation", () => {
    let project = makeProject();
    for (let index = 0; index < 100; index += 1) {
      project = insertComponentFromDefinition(project, {
        definitionKey: "channel.rectangular",
        layerId: project.layers[0]!.id,
        position: { x: index, y: index % 10 },
      }).project;
    }
    const before = JSON.stringify(project);
    const first = deriveEditorProjection(project, {
      selectedComponentIds: [],
      selectedConnectionIds: [],
    });
    const second = deriveEditorProjection(project, {
      selectedComponentIds: [],
      selectedConnectionIds: [],
    });

    expect(first.nodes).toHaveLength(100);
    expect(project.ports).toHaveLength(200);
    expect(indexConnectionCounts(project.connections)).toEqual(new Map());
    expect(first.nodes.map((node) => node.id)).toEqual(
      second.nodes.map((node) => node.id),
    );
    expect(JSON.stringify(project)).toBe(before);
  });

  it("fails safely for duplicate IDs and missing connection ownership", () => {
    const base = makeProject();
    const inserted = insertComponentFromDefinition(base, {
      definitionKey: "channel.rectangular",
      layerId: base.layers[0]!.id,
      position: { x: 1, y: 1 },
    }).project;

    expect(() =>
      deriveEditorProjection(
        {
          ...inserted,
          components: [inserted.components[0]!, inserted.components[0]!],
        },
        { selectedComponentIds: [], selectedConnectionIds: [] },
      ),
    ).toThrow();

    expect(() =>
      deriveEditorProjection(
        {
          ...inserted,
          connections: [
            {
              id: "connection_missing_owner",
              sourcePortId: inserted.ports[0]!.id,
              targetPortId: "port_missing",
              metadata: {},
            },
          ],
        },
        { selectedComponentIds: [], selectedConnectionIds: [] },
      ),
    ).toThrow();
  });
});
