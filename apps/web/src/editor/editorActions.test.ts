import { describe, expect, it } from "vitest";

import { parseProject, type LayerId } from "project-model";
import { deriveRouteGeometry } from "geometry-core";

import { projectStore, resetProjectStoreForTests } from "../state/projectStore";
import { makeProject } from "../test/factories";
import {
  createProjectConnection,
  deleteSelection,
  duplicateSelectedComponent,
  insertComponentFromDefinition,
  moveComponents,
  renameComponent,
  reassignComponentLayerLane,
  reassignSelectedComponentsLane,
  updateComponentParameterValues,
  updateComponentPositionAndRotation,
} from "./editorActions";
import { EditorActionError } from "./editorErrors";
import { updatePhysicalRouteProperties } from "./physicalRouteActions";
import { deriveEditorProjection } from "./editorProjection";

describe("editor project actions", () => {
  it("inserts a component and owned ports atomically", () => {
    const project = makeProject();
    const result = insertComponentFromDefinition(project, {
      definitionKey: "channel.rectangular",
      layerId: project.layers[0]!.id,
      position: { x: 1.2, y: 2.6 },
    });

    expect(result.project.components).toHaveLength(1);
    expect(result.project.ports).toHaveLength(2);
    expect(result.project.components[0]!.position.x.value).toBe(1.2);
    expect(result.project.components[0]!.position.y.value).toBe(2.6);
    expect(project.components).toHaveLength(0);
  });

  it("rejects invalid layer and missing required lane without mutation", () => {
    const project = makeProject();
    expect(() =>
      insertComponentFromDefinition(project, {
        definitionKey: "channel.rectangular",
        layerId: "layer_missing" as never,
        position: { x: 1, y: 1 },
      }),
    ).toThrow(EditorActionError);
  });

  it("moves selected components once on drag stop and rejects outside-chip positions", () => {
    const base = makeProject();
    const inserted = insertComponentFromDefinition(base, {
      definitionKey: "channel.rectangular",
      layerId: base.layers[0]!.id,
      position: { x: 1, y: 1 },
    }).project;
    const componentId = inserted.components[0]!.id;
    const moved = moveComponents(inserted, {
      [componentId]: { x: 2.4, y: 2.2 },
    });

    expect(moved.changed).toBe(true);
    expect(moved.project.components[0]!.position.x.value).toBe(2.4);
    expect(moved.project.components[0]!.position.y.value).toBe(2.2);
    expect(
      moveComponents(moved.project, { [componentId]: { x: 2.4, y: 2.2 } }).changed,
    ).toBe(false);
    expect(() =>
      moveComponents(moved.project, { [componentId]: { x: -0.1, y: 2 } }),
    ).toThrow(EditorActionError);
  });

  it("creates compatible connections and rejects incompatible duplicates", () => {
    const base = makeProject();
    const first = insertComponentFromDefinition(base, {
      definitionKey: "channel.rectangular",
      layerId: base.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    const second = insertComponentFromDefinition(first, {
      definitionKey: "filter.debris",
      layerId: base.layers[0]!.id,
      position: { x: 4, y: 0 },
    }).project;
    const source = second.ports.find(
      (port) =>
        port.componentId === second.components[0]!.id && port.direction === "output",
    )!;
    const target = second.ports.find(
      (port) =>
        port.componentId === second.components[1]!.id && port.direction === "input",
    )!;
    const connected = createProjectConnection(second, source.id, target.id);

    expect(connected.connection?.id).toMatch(/^connection_/);
    expect(connected.project.connections).toHaveLength(1);
    expect(connected.project.physicalRoutes).toHaveLength(1);
    expect(connected.project.physicalRoutes[0]).toMatchObject({
      connectionId: connected.connection?.id,
      layerId: base.layers[0]!.id,
      pattern: { kind: "straight" },
    });
    const duplicate = createProjectConnection(connected.project, source.id, target.id);
    expect(duplicate.project.connections).toHaveLength(1);
    expect(duplicate.issues.map((issue) => issue.code)).toContain(
      "DUPLICATE_CONNECTION",
    );
  });

  it("creates multiple independent routes through merger and splitter ports", () => {
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
    const sourceA = project.ports.find(
      (port) => port.name === "Fluid port" && port.direction === "output",
    )!;
    const sourceB = project.ports.find(
      (port) => port.componentId === project.components[1]!.id,
    )!;
    const mergerInputs = project.ports.filter(
      (port) =>
        port.componentId === project.components[2]!.id && port.direction === "input",
    );

    const first = createProjectConnection(project, sourceA.id, mergerInputs[0]!.id);
    const second = createProjectConnection(
      first.project,
      sourceB.id,
      mergerInputs[1]!.id,
    );
    const rejected = createProjectConnection(
      second.project,
      sourceB.id,
      mergerInputs[0]!.id,
    );

    expect(second.project.connections).toHaveLength(2);
    expect(
      new Set(second.project.connections.map((connection) => connection.id)).size,
    ).toBe(2);
    expect(second.project.physicalRoutes).toHaveLength(2);
    expect(
      second.project.connections.every(
        (connection) =>
          second.project.physicalRoutes.filter(
            (route) => route.connectionId === connection.id,
          ).length === 1,
      ),
    ).toBe(true);
    expect(rejected.project).toBe(second.project);
    expect(rejected.issues.map((issue) => issue.code)).toContain(
      "TARGET_CAPACITY_EXCEEDED",
    );

    let splitProject = makeProject();
    splitProject = insertComponentFromDefinition(splitProject, {
      definitionKey: "reservoir.sample-inlet",
      layerId: splitProject.layers[0]!.id,
      position: { x: 0, y: 1 },
    }).project;
    splitProject = insertComponentFromDefinition(splitProject, {
      definitionKey: "junction.splitter",
      layerId: splitProject.layers[0]!.id,
      position: { x: 4, y: 1 },
    }).project;
    splitProject = insertComponentFromDefinition(splitProject, {
      definitionKey: "chamber.reaction",
      layerId: splitProject.layers[0]!.id,
      position: { x: 8, y: 0 },
    }).project;
    splitProject = insertComponentFromDefinition(splitProject, {
      definitionKey: "chamber.metering",
      layerId: splitProject.layers[0]!.id,
      position: { x: 8, y: 3 },
    }).project;
    const splitterInput = splitProject.ports.find(
      (port) =>
        port.componentId === splitProject.components[1]!.id && port.name === "Input",
    )!;
    const splitterOutputs = splitProject.ports.filter(
      (port) =>
        port.componentId === splitProject.components[1]!.id &&
        port.direction === "output",
    );
    const chamberInputs = splitProject.ports.filter(
      (port) =>
        (port.componentId === splitProject.components[2]!.id ||
          port.componentId === splitProject.components[3]!.id) &&
        port.direction === "input",
    );

    splitProject = createProjectConnection(
      splitProject,
      splitProject.ports.find(
        (port) => port.componentId === splitProject.components[0]!.id,
      )!.id,
      splitterInput.id,
    ).project;
    splitProject = createProjectConnection(
      splitProject,
      splitterOutputs[0]!.id,
      chamberInputs[0]!.id,
    ).project;
    splitProject = createProjectConnection(
      splitProject,
      splitterOutputs[1]!.id,
      chamberInputs[1]!.id,
    ).project;

    expect(splitProject.connections).toHaveLength(3);
    expect(splitProject.physicalRoutes).toHaveLength(3);
  });

  it("updates an existing route on apply without duplicating cardinality", () => {
    let project = makeProject();
    project = insertComponentFromDefinition(project, {
      definitionKey: "channel.rectangular",
      layerId: project.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "filter.debris",
      layerId: project.layers[0]!.id,
      position: { x: 4, y: 0 },
    }).project;
    const first = createProjectConnection(
      project,
      project.ports.find((port) => port.direction === "output")!.id,
      project.ports.find(
        (port) =>
          port.componentId === project.components[1]!.id && port.direction === "input",
      )!.id,
    );
    const connectionId = first.connection!.id;
    const applied = updatePhysicalRouteProperties(first.project, connectionId, {
      width: { value: 0.2, unit: "mm", provenance: { source: "user-entered" } },
      depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
    });

    expect(
      applied.physicalRoutes.filter((route) => route.connectionId === connectionId),
    ).toHaveLength(1);
  });

  it("renames, edits parameters, duplicates, deletes, and protects assignments", () => {
    const base = makeProject();
    const inserted = insertComponentFromDefinition(base, {
      definitionKey: "filter.debris",
      layerId: base.layers[0]!.id,
      position: { x: 1, y: 1 },
    }).project;
    const componentId = inserted.components[0]!.id;
    const renamed = renameComponent(inserted, componentId, " Filter A ");
    const parameterized = updateComponentParameterValues(renamed, {
      componentId,
      updates: { width: { value: 2, unit: "mm" } },
    });
    const duplicated = duplicateSelectedComponent(parameterized, componentId);
    const deleted = deleteSelection(duplicated.project, {
      componentIds: [componentId],
      connectionIds: [],
    });

    expect(parameterized.components[0]!.name).toBe("Filter A");
    expect(parameterized.components[0]!.kind).toBe("generic");
    if (parameterized.components[0]!.kind === "generic") {
      expect(parameterized.components[0]!.dimensions?.width.value).toBe(2);
    }
    expect(duplicated.project.components).toHaveLength(2);
    expect(duplicated.project.ports).toHaveLength(4);
    expect(deleted.components).toHaveLength(1);
    expect(deleted.ports).toHaveLength(2);
    expect(() =>
      reassignComponentLayerLane(parameterized, componentId, {
        layerId: "layer_missing" as never,
      }),
    ).toThrow(EditorActionError);
  });

  it("resizes a connected merger without recreating topology and moves route-derived edit points", () => {
    let project = makeProject();
    project = insertComponentFromDefinition(project, {
      definitionKey: "reservoir.sample-inlet",
      layerId: project.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "reservoir.reagent-inlet",
      layerId: project.layers[0]!.id,
      position: { x: 0, y: 4 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "junction.merger",
      layerId: project.layers[0]!.id,
      position: { x: 5, y: 2 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "chamber.reaction",
      layerId: project.layers[0]!.id,
      position: { x: 10, y: 2 },
    }).project;

    const sampleAOutput = project.ports.find(
      (port) => port.componentId === project.components[0]!.id,
    )!;
    const sampleBOutput = project.ports.find(
      (port) => port.componentId === project.components[1]!.id,
    )!;
    const mergerInputs = project.ports.filter(
      (port) =>
        port.componentId === project.components[2]!.id && port.direction === "input",
    );
    const mergerOutput = project.ports.find(
      (port) =>
        port.componentId === project.components[2]!.id && port.direction === "output",
    )!;
    const chamberInput = project.ports.find(
      (port) =>
        port.componentId === project.components[3]!.id && port.direction === "input",
    )!;

    project = createProjectConnection(
      project,
      sampleAOutput.id,
      mergerInputs[0]!.id,
    ).project;
    project = createProjectConnection(
      project,
      sampleBOutput.id,
      mergerInputs[1]!.id,
    ).project;
    project = createProjectConnection(
      project,
      mergerOutput.id,
      chamberInput.id,
    ).project;
    for (const connection of project.connections) {
      project = updatePhysicalRouteProperties(project, connection.id, {
        width: { value: 0.2, unit: "mm", provenance: { source: "user-entered" } },
        depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
      });
    }

    const mergerId = project.components[2]!.id;
    const connectionIds = project.connections.map((connection) => connection.id);
    const routeIds = project.physicalRoutes.map((route) => route.id);
    const trackedRoute = project.physicalRoutes[1]!;
    const beforeLength = deriveRouteGeometry(project, trackedRoute).actualLength;
    const beforeEditPoint = deriveEditorProjection(project, {
      selectedComponentIds: [],
      selectedConnectionIds: [],
    }).channelEditPoints.find(
      (point) => point.connectionId === trackedRoute.connectionId,
    )!.position;

    const resized = updateComponentParameterValues(project, {
      componentId: mergerId,
      updates: {
        width: { value: 4, unit: "mm", provenance: { source: "user-entered" } },
        height: { value: 2, unit: "mm", provenance: { source: "user-entered" } },
      },
    });

    expect(resized.components[2]!.id).toBe(mergerId);
    expect(resized.connections.map((connection) => connection.id)).toEqual(
      connectionIds,
    );
    expect(resized.physicalRoutes.map((route) => route.id)).toEqual(routeIds);
    expect(resized.connections.map((connection) => connection.sourcePortId)).toEqual(
      project.connections.map((connection) => connection.sourcePortId),
    );
    expect(resized.connections.map((connection) => connection.targetPortId)).toEqual(
      project.connections.map((connection) => connection.targetPortId),
    );
    expect(
      deriveRouteGeometry(resized, resized.physicalRoutes[1]!).actualLength,
    ).not.toBe(beforeLength);
    const afterEditPoint = deriveEditorProjection(resized, {
      selectedComponentIds: [],
      selectedConnectionIds: [],
    }).channelEditPoints.find(
      (point) => point.connectionId === trackedRoute.connectionId,
    )!.position;
    expect(afterEditPoint).not.toEqual(beforeEditPoint);
  });

  it("returns the original project for no-op property and assignment updates", () => {
    const base = makeProject();
    const inserted = insertComponentFromDefinition(base, {
      definitionKey: "channel.rectangular",
      layerId: base.layers[0]!.id,
      position: { x: 1, y: 1 },
    }).project;
    const component = inserted.components[0]!;

    expect(renameComponent(inserted, component.id, component.name)).toBe(inserted);
    expect(
      updateComponentPositionAndRotation(inserted, component.id, {
        x: component.position.x.value,
        y: component.position.y.value,
        rotation: component.rotation.value,
      }),
    ).toBe(inserted);
    expect(
      reassignComponentLayerLane(inserted, component.id, {
        layerId: component.layerId,
        laneId: component.laneId ?? null,
      }),
    ).toBe(inserted);
  });

  it("reassigns lane membership and rejects moves that break existing connections", () => {
    const original = makeProject();
    const base = parseProject({
      ...original,
      layers: [
        ...original.layers,
        {
          id: "layer_control",
          name: "Control",
          order: 1,
          thickness: {
            value: 1,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          materialId: original.materials[0]!.id,
          metadata: {},
        },
      ],
      lanes: [
        {
          id: "lane_sample",
          name: "Sample",
          componentIds: [],
          metadata: {},
        },
        {
          id: "lane_control",
          name: "Control",
          componentIds: [],
          metadata: {},
        },
      ],
    });
    const withSource = insertComponentFromDefinition(base, {
      definitionKey: "channel.rectangular",
      layerId: base.layers[0]!.id,
      laneId: "lane_sample",
      position: { x: 0, y: 0 },
    }).project;
    const withTarget = insertComponentFromDefinition(withSource, {
      definitionKey: "filter.debris",
      layerId: base.layers[0]!.id,
      laneId: "lane_sample",
      position: { x: 4, y: 0 },
    }).project;
    const sourceComponent = withTarget.components[0]!;
    const sourcePort = withTarget.ports.find(
      (port) => port.componentId === sourceComponent.id && port.direction === "output",
    )!;
    const targetPort = withTarget.ports.find(
      (port) =>
        port.componentId === withTarget.components[1]!.id && port.direction === "input",
    )!;
    const removedFromLane = reassignComponentLayerLane(withTarget, sourceComponent.id, {
      laneId: null,
    });
    const connectedResult = createProjectConnection(
      withTarget,
      sourcePort.id,
      targetPort.id,
    );
    const connected = connectedResult.project;

    expect(removedFromLane.components[0]!.laneId).toBeUndefined();
    expect(removedFromLane.lanes[0]!.componentIds).not.toContain(sourceComponent.id);
    expect(connectedResult.connection).toBeDefined();
    expect(() =>
      reassignComponentLayerLane(connected, sourceComponent.id, {
        layerId: "layer_control" as LayerId,
        laneId: "lane_control",
      }),
    ).toThrow(EditorActionError);
  });

  it("assigns connected selected components to lanes atomically", () => {
    const original = makeProject();
    let project = parseProject({
      ...original,
      lanes: [
        { id: "lane_one", name: "Lane 1", componentIds: [], metadata: {} },
        { id: "lane_two", name: "Lane 2", componentIds: [], metadata: {} },
      ],
    });
    project = insertComponentFromDefinition(project, {
      definitionKey: "channel.rectangular",
      layerId: project.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "filter.debris",
      layerId: project.layers[0]!.id,
      position: { x: 4, y: 0 },
    }).project;
    const source = project.ports.find(
      (port) =>
        port.componentId === project.components[0]!.id && port.direction === "output",
    )!;
    const target = project.ports.find(
      (port) =>
        port.componentId === project.components[1]!.id && port.direction === "input",
    )!;
    project = createProjectConnection(project, source.id, target.id).project;
    const componentIds = project.components.map((component) => component.id);

    expect(() =>
      reassignComponentLayerLane(project, project.components[0]!.id, {
        laneId: "lane_one",
      }),
    ).toThrow(EditorActionError);

    const assigned = reassignSelectedComponentsLane(
      project,
      componentIds,
      "lane_one",
      "2026-08-06T00:00:00.000Z",
    );
    const moved = reassignSelectedComponentsLane(
      assigned,
      componentIds,
      "lane_two",
      "2026-08-06T00:00:01.000Z",
    );

    expect(assigned.components.map((component) => component.laneId)).toEqual([
      "lane_one",
      "lane_one",
    ]);
    expect(assigned.lanes[0]!.componentIds).toEqual(componentIds);
    expect(new Set(assigned.lanes[0]!.componentIds).size).toBe(2);
    expect(moved.lanes[0]!.componentIds).toEqual([]);
    expect(moved.lanes[1]!.componentIds).toEqual(componentIds);
  });

  it("rejects invalid atomic lane assignment without partial mutation", () => {
    const original = makeProject();
    const project = parseProject({
      ...original,
      lanes: [{ id: "lane_one", name: "Lane 1", componentIds: [], metadata: {} }],
    });
    const inserted = insertComponentFromDefinition(project, {
      definitionKey: "interface.sensor",
      layerId: project.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;

    expect(() =>
      reassignSelectedComponentsLane(
        inserted,
        [inserted.components[0]!.id],
        "lane_one",
      ),
    ).toThrow(EditorActionError);
    expect(inserted.components[0]!.laneId).toBeUndefined();
    expect(inserted.lanes[0]!.componentIds).toEqual([]);
  });

  it("deletes selected connections and routes without deleting endpoint components", () => {
    let project = makeProject();
    project = insertComponentFromDefinition(project, {
      definitionKey: "channel.rectangular",
      layerId: project.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "filter.debris",
      layerId: project.layers[0]!.id,
      position: { x: 4, y: 0 },
    }).project;
    const source = project.ports.find(
      (port) =>
        port.componentId === project.components[0]!.id && port.direction === "output",
    )!;
    const target = project.ports.find(
      (port) =>
        port.componentId === project.components[1]!.id && port.direction === "input",
    )!;
    project = createProjectConnection(project, source.id, target.id).project;

    const deleted = deleteSelection(project, {
      componentIds: [],
      connectionIds: [project.connections[0]!.id],
    });

    expect(deleted.components).toHaveLength(2);
    expect(deleted.connections).toHaveLength(0);
    expect(deleted.physicalRoutes).toHaveLength(0);
  });

  it("selection and previews remain transient in the store", () => {
    resetProjectStoreForTests();
    projectStore.getState().createNewProject();
    const revision = projectStore.getState().metadata?.revision;
    projectStore.getState().setSelectedComponents(["component_a"]);
    projectStore.getState().setDragPreviewPositions({ component_a: { x: 1, y: 2 } });
    projectStore.getState().setConnectionPreview({ compatible: false });

    expect(projectStore.getState().metadata?.revision).toBe(revision);
    expect(projectStore.getState().history.past).toHaveLength(0);
  });
});
