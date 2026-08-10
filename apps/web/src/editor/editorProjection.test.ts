import { describe, expect, it } from "vitest";

import { deriveRouteGeometry, mmToDisplay } from "geometry-core";
import { parseProject } from "project-model";

import { makeProject } from "../test/factories";
import {
  createProjectConnection,
  insertComponentFromDefinition,
} from "./editorActions";
import { deriveEditorProjection, indexConnectionCounts } from "./editorProjection";
import { createHandleId } from "./handleIds";
import { updatePhysicalRouteProperties } from "./physicalRouteActions";

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
    expect(projection.edges[0]!.selected).toBe(true);
    expect(projection.edges[0]!.interactionWidth).toBe(24);
    expect(projection.nodes[0]!.data.ports.length).toBe(2);
    expect(projection.edges[0]!.data!.routePoints).toHaveLength(2);
    expect(projection.edges[0]!.data!.routeWidthPx).toBe(2);
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

  it("does not silently render one route when a connection has duplicate physical routes", () => {
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
    const duplicated = {
      ...connected,
      physicalRoutes: [
        ...connected.physicalRoutes,
        { ...connected.physicalRoutes[0]!, id: "route_duplicate" },
      ],
    };

    const projection = deriveEditorProjection(duplicated, {
      selectedComponentIds: [],
      selectedConnectionIds: [],
    });

    expect(projection.edges[0]!.id).toBe(connected.connections[0]!.id);
    expect(projection.edges[0]!.data!.routePath).toBe("");
    expect(projection.edges[0]!.data!.routePoints).toEqual([]);
    expect(projection.edges[0]!.data!.physicalReady).toBe(false);
  });

  it("projects multiple incomplete routes as selectable physical route edges", () => {
    let project = makeProject();
    project = insertComponentFromDefinition(project, {
      definitionKey: "reservoir.sample-inlet",
      layerId: project.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "reservoir.reagent-inlet",
      layerId: project.layers[0]!.id,
      position: { x: 0, y: 3 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "junction.merger",
      layerId: project.layers[0]!.id,
      position: { x: 4, y: 1 },
    }).project;
    const outputs = project.ports.filter((port) => port.direction === "output");
    const mergerInputs = project.ports.filter(
      (port) =>
        port.componentId === project.components[2]!.id && port.direction === "input",
    );

    project = createProjectConnection(
      project,
      outputs[0]!.id,
      mergerInputs[0]!.id,
    ).project;
    project = createProjectConnection(
      project,
      outputs[1]!.id,
      mergerInputs[1]!.id,
    ).project;

    const projection = deriveEditorProjection(project, {
      selectedComponentIds: [],
      selectedConnectionIds: [project.connections[1]!.id],
    });

    expect(projection.edges).toHaveLength(2);
    expect(projection.edges.map((edge) => edge.type)).toEqual([
      "physicalRoute",
      "physicalRoute",
    ]);
    expect(projection.edges.every((edge) => (edge.interactionWidth ?? 0) >= 24)).toBe(
      true,
    );
    expect(projection.edges.map((edge) => edge.id)).toEqual(
      project.connections.map((connection) => connection.id),
    );
    expect(projection.edges[1]!.selected).toBe(true);
  });

  it("keeps unsupported endpoint routes as clickable fallback edges", () => {
    let project = makeProject();
    project = insertComponentFromDefinition(project, {
      definitionKey: "reservoir.sample-inlet",
      layerId: project.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "valve.normally-open",
      layerId: project.layers[0]!.id,
      position: { x: 4, y: 0 },
    }).project;
    const connection = {
      id: "connection_unsupported_endpoint",
      sourcePortId: project.ports.find((port) => port.direction === "output")!.id,
      targetPortId: project.ports.find(
        (port) =>
          port.componentId === project.components[1]!.id && port.name === "Flow input",
      )!.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [
        {
          id: "route_unsupported_endpoint",
          connectionId: connection.id,
          layerId: project.layers[0]!.id,
          pattern: { kind: "straight" },
          metadata: {},
        },
      ],
    });

    const projection = deriveEditorProjection(project, {
      selectedComponentIds: [],
      selectedConnectionIds: [connection.id],
    });

    expect(projection.edges[0]!.id).toBe(connection.id);
    expect(projection.edges[0]!.type).toBe("physicalRoute");
    expect(projection.edges[0]!.interactionWidth).toBe(24);
    expect(projection.edges[0]!.data!.routePath).toBe("");
    expect(projection.edges[0]!.selected).toBe(true);
  });

  it("projects a serpentine route alongside a newly incomplete route", () => {
    let project = makeProject();
    project = insertComponentFromDefinition(project, {
      definitionKey: "junction.splitter",
      layerId: project.layers[0]!.id,
      position: { x: 1, y: 1 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "junction.merger",
      layerId: project.layers[0]!.id,
      position: { x: 8, y: 1.5 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "channel.rectangular",
      layerId: project.layers[0]!.id,
      position: { x: 1, y: 4 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "filter.debris",
      layerId: project.layers[0]!.id,
      position: { x: 8, y: 4 },
    }).project;
    const serpentine = createProjectConnection(
      project,
      project.ports.find(
        (port) =>
          port.componentId === project.components[0]!.id && port.name === "Output A",
      )!.id,
      project.ports.find(
        (port) =>
          port.componentId === project.components[1]!.id && port.name === "Input A",
      )!.id,
    );
    project = updatePhysicalRouteProperties(
      serpentine.project,
      serpentine.connection!.id,
      {
        pattern: {
          kind: "serpentine",
          turnCount: 1,
          pitch: { value: 0.5, unit: "mm", provenance: { source: "user-entered" } },
          axis: "horizontal",
          sizing: {
            mode: "explicit",
            amplitude: {
              value: 2,
              unit: "mm",
              provenance: { source: "user-entered" },
            },
          },
          placement: { mode: "auto" },
        },
        width: { value: 0.2, unit: "mm", provenance: { source: "user-entered" } },
        depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
        bendRadius: {
          value: 0.25,
          unit: "mm",
          provenance: { source: "user-entered" },
        },
      },
    );
    project = createProjectConnection(
      project,
      project.ports.find(
        (port) =>
          port.componentId === project.components[2]!.id && port.direction === "output",
      )!.id,
      project.ports.find(
        (port) =>
          port.componentId === project.components[3]!.id && port.direction === "input",
      )!.id,
    ).project;

    const projection = deriveEditorProjection(project, {
      selectedComponentIds: [],
      selectedConnectionIds: [project.connections[1]!.id],
    });

    expect(projection.edges).toHaveLength(2);
    expect(projection.edges[0]!.id).toBe(project.connections[0]!.id);
    expect(projection.edges[0]!.type).toBe("physicalRoute");
    expect(projection.edges[1]!.data!.physicalReady).toBe(false);
    expect(projection.edges[1]!.selected).toBe(true);
  });

  it("projects exact-radius serpentine tail arcs from geometry-core primitives", () => {
    const base = makeProject();
    let project = parseProject({
      ...base,
      chip: {
        ...base.chip,
        overallDimensions: {
          width: { value: 120, unit: "mm", provenance: { source: "user-entered" } },
          height: { value: 60, unit: "mm", provenance: { source: "user-entered" } },
          depth: base.chip.overallDimensions.depth,
        },
      },
    });
    project = insertComponentFromDefinition(project, {
      definitionKey: "channel.rectangular",
      layerId: project.layers[0]!.id,
      position: { x: 10, y: 10 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "filter.debris",
      layerId: project.layers[0]!.id,
      position: { x: 70, y: 16 },
    }).project;
    const source = project.ports.find(
      (port) =>
        port.componentId === project.components[0]!.id && port.direction === "output",
    )!;
    const target = project.ports.find(
      (port) =>
        port.componentId === project.components[1]!.id && port.direction === "input",
    )!;
    const connected = createProjectConnection(project, source.id, target.id);
    project = updatePhysicalRouteProperties(
      connected.project,
      connected.connection!.id,
      {
        pattern: {
          kind: "serpentine",
          turnCount: 1,
          pitch: { value: 2, unit: "mm", provenance: { source: "user-entered" } },
          axis: "horizontal",
          sizing: {
            mode: "explicit",
            amplitude: {
              value: 8,
              unit: "mm",
              provenance: { source: "user-entered" },
            },
          },
          placement: { mode: "auto" },
        },
        width: { value: 0.2, unit: "mm", provenance: { source: "user-entered" } },
        depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
        bendRadius: {
          value: 0.75,
          unit: "mm",
          provenance: { source: "user-entered" },
        },
      },
    );
    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const projection = deriveEditorProjection(project, {
      selectedComponentIds: [],
      selectedConnectionIds: [project.connections[0]!.id],
    });

    expect(generated.issues).toEqual([]);
    expect(projection.edges[0]!.data!.routePath).toContain(
      `A ${mmToDisplay(0.75)} ${mmToDisplay(0.75)}`,
    );
  });
});
