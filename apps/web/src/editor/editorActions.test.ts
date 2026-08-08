import { describe, expect, it } from "vitest";

import { parseProject, type LayerId } from "project-model";

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
  updateComponentParameterValues,
  updateComponentPositionAndRotation,
} from "./editorActions";
import { EditorActionError } from "./editorErrors";

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
      waypoints: [],
    });
    const duplicate = createProjectConnection(connected.project, source.id, target.id);
    expect(duplicate.project.connections).toHaveLength(1);
    expect(duplicate.issues.map((issue) => issue.code)).toContain(
      "DUPLICATE_CONNECTION",
    );
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
