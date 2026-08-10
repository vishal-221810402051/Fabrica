import { describe, expect, it } from "vitest";

import { parseProject, type FluidId } from "project-model";

import { createProjectExport } from "../import-export/projectExport";
import { projectStore, resetProjectStoreForTests } from "../state/projectStore";
import { makeProject } from "../test/factories";
import { resolveConnectionRouteContext } from "./connectionRouteSelectors";
import {
  createProjectConnection,
  insertComponentFromDefinition,
  reassignComponentLayerLane,
  updateComponentParameterValues,
} from "./editorActions";
import { inspectLane } from "./laneSelectors";
import { updatePhysicalRouteProperties } from "./physicalRouteActions";
import {
  createLane,
  deleteEmptyLane,
  updateChipProperties,
  updateLaneProperties,
  updateLayerProperties,
  updateManufacturingProcessProperties,
  updateMaterialProperties,
  updatePortProperties,
  updateProjectName,
} from "./propertyActions";
import { parseQuantityDraft } from "./unitDrafts";

describe("property edit actions", () => {
  it("edits the project name and rejects invalid or no-op edits", () => {
    const project = makeProject();
    const renamed = updateProjectName(
      project,
      " Renamed project ",
      "2026-08-06T00:00:00.000Z",
    );

    expect(renamed.name).toBe("Renamed project");
    expect(renamed.updatedAt).toBe("2026-08-06T00:00:00.000Z");
    expect(updateProjectName(renamed, "Renamed project")).toBe(renamed);
    expect(() => updateProjectName(project, " ")).toThrow("Project name is required");
  });

  it("edits chip quantities canonically with user-entered provenance", () => {
    const project = makeProject();
    const updated = updateChipProperties(
      project,
      {
        name: "Assay chip",
        width: parseQuantityDraft({ text: "25000", displayUnit: "um" }, "length", {
          required: true,
          positive: true,
        })!,
        height: { value: 12.5, unit: "mm", provenance: { source: "user-entered" } },
        depth: parseQuantityDraft({ text: "1000", displayUnit: "um" }, "length", {
          required: true,
          positive: true,
        })!,
        materialId: project.materials[0]!.id,
      },
      "2026-08-06T00:00:00.000Z",
    );

    expect(updated.chip.name).toBe("Assay chip");
    expect(updated.chip.overallDimensions.width).toEqual({
      value: 25,
      unit: "mm",
      provenance: { source: "user-entered" },
    });
    expect(updated.chip.materialId).toBe(project.materials[0]!.id);
  });

  it("edits layers and lanes while preserving atomic no-op behavior", () => {
    const project = makeProject();
    const layer = project.layers[0]!;
    const layerUpdated = updateLayerProperties(
      project,
      layer.id,
      {
        name: "Flow layer",
        order: 1,
        thickness: {
          value: 0.75,
          unit: "mm",
          provenance: { source: "user-entered" },
        },
        materialId: project.materials[0]!.id,
      },
      "2026-08-06T00:00:00.000Z",
    );
    const laneUpdated = updateLaneProperties(
      parseProject({
        ...layerUpdated,
        lanes: [{ id: "lane_sample", name: "Sample", componentIds: [], metadata: {} }],
      }),
      "lane_sample",
      { name: "Control lane" },
      "2026-08-06T00:00:01.000Z",
    );

    expect(layerUpdated.layers[0]!.name).toBe("Flow layer");
    expect(layerUpdated.layers[0]!.order).toBe(1);
    expect(laneUpdated.lanes[0]!.name).toBe("Control lane");
    expect(() =>
      updateLayerProperties(project, layer.id, {
        name: layer.name,
        order: -1,
        thickness: layer.thickness,
      }),
    ).toThrow("non-negative integer");
  });

  it("creates, assigns, moves, unassigns, and deletes empty lanes consistently", () => {
    const project = makeProject();
    const firstResult = createLane(project, "2026-08-06T00:00:00.000Z");
    const secondResult = createLane(firstResult.project, "2026-08-06T00:00:01.000Z");
    const inserted = insertComponentFromDefinition(secondResult.project, {
      definitionKey: "chamber.reaction",
      layerId: secondResult.project.layers[0]!.id,
      position: { x: 1, y: 1 },
    }).project;
    const componentId = inserted.components[0]!.id;
    const assigned = reassignComponentLayerLane(inserted, componentId, {
      laneId: firstResult.lane.id,
    });
    const moved = reassignComponentLayerLane(assigned, componentId, {
      laneId: secondResult.lane.id,
    });
    const unassigned = reassignComponentLayerLane(moved, componentId, {
      laneId: null,
    });
    const deleted = deleteEmptyLane(unassigned, firstResult.lane.id);

    expect(firstResult.lane.name).toBe("Lane 1");
    expect(secondResult.lane.name).toBe("Lane 2");
    expect(assigned.components[0]!.laneId).toBe(firstResult.lane.id);
    expect(assigned.lanes[0]!.componentIds).toEqual([componentId]);
    expect(moved.lanes[0]!.componentIds).toEqual([]);
    expect(moved.lanes[1]!.componentIds).toEqual([componentId]);
    expect(new Set(moved.lanes[1]!.componentIds).size).toBe(1);
    expect(unassigned.components[0]!.laneId).toBeUndefined();
    expect(unassigned.lanes.every((lane) => lane.componentIds.length === 0)).toBe(true);
    expect(deleted.lanes.map((lane) => lane.id)).not.toContain(firstResult.lane.id);
    expect(() => deleteEmptyLane(moved, secondResult.lane.id)).toThrow(
      "Unassign or reassign components",
    );
  });

  it("keeps lane creation undoable and persisted without UI selection state", () => {
    resetProjectStoreForTests();
    projectStore.getState().createNewProject();
    let createdLaneId = "";
    projectStore.getState().updateProject((project) => {
      const result = createLane(project, "2026-08-06T00:00:00.000Z");
      createdLaneId = result.lane.id;
      return result.project;
    }, "Add lane");
    projectStore.getState().setActiveLaneId(createdLaneId);

    const serialized = JSON.stringify(projectStore.getState().project);
    expect(projectStore.getState().project?.lanes).toHaveLength(1);
    expect(projectStore.getState().history.past).toHaveLength(1);
    expect(serialized).toContain(createdLaneId);
    expect(serialized).not.toContain("activeLaneId");

    projectStore.getState().undo();
    expect(projectStore.getState().project?.lanes).toHaveLength(0);
    projectStore.getState().redo();
    expect(projectStore.getState().project?.lanes[0]?.id).toBe(createdLaneId);
  });

  it("discovers associated lane routes and excludes cross-lane routes", () => {
    let project = makeProject();
    const firstLane = createLane(project).project;
    const secondLaneResult = createLane(firstLane);
    project = secondLaneResult.project;
    const laneA = project.lanes[0]!;
    const laneB = project.lanes[1]!;
    project = insertComponentFromDefinition(project, {
      definitionKey: "channel.rectangular",
      layerId: project.layers[0]!.id,
      laneId: laneA.id,
      position: { x: 0, y: 0 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "filter.debris",
      layerId: project.layers[0]!.id,
      laneId: laneA.id,
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

    const associated = inspectLane(project, laneA.id);
    const crossLaneProject = parseProject({
      ...project,
      components: project.components.map((component) =>
        component.id === project.components[1]!.id
          ? { ...component, laneId: laneB.id }
          : component,
      ),
      lanes: project.lanes.map((lane) => {
        if (lane.id === laneA.id) {
          return {
            ...lane,
            componentIds: lane.componentIds.filter(
              (id) => id !== project.components[1]!.id,
            ),
          };
        }
        if (lane.id === laneB.id) {
          return {
            ...lane,
            componentIds: [project.components[1]!.id],
          };
        }
        return lane;
      }),
    });
    const crossLane = inspectLane(crossLaneProject, laneA.id);

    expect(associated.routes).toHaveLength(1);
    expect(associated.crossLaneRoutes).toHaveLength(0);
    expect(crossLane.routes).toHaveLength(0);
    expect(crossLane.crossLaneRoutes).toHaveLength(1);
  });

  it("resolves connection route context and route cardinality safely", () => {
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
    const connectionId = project.connections[0]!.id;
    const unique = resolveConnectionRouteContext(project, connectionId);
    const missing = resolveConnectionRouteContext(
      parseProject({ ...project, physicalRoutes: [] }),
      connectionId,
    );
    const duplicate = resolveConnectionRouteContext(
      parseProject({
        ...project,
        physicalRoutes: [
          ...project.physicalRoutes,
          { ...project.physicalRoutes[0]!, id: "route_duplicate" },
        ],
      }),
      connectionId,
    );

    expect(unique.physicalRoute.status).toBe("unique");
    expect(unique.laneContext.status).toBe("unassigned");
    expect(missing.physicalRoute.status).toBe("missing");
    expect(duplicate.physicalRoute.status).toBe("duplicate");
    expect(duplicate.issues).toContain(
      "Multiple physical routes reference this connection",
    );
  });

  it("keeps route selectors safe when endpoint geometry is unsupported", () => {
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
    const lane = createLane(project);
    project = parseProject({
      ...lane.project,
      components: lane.project.components.map((component) => ({
        ...component,
        laneId: lane.lane.id,
      })),
      lanes: lane.project.lanes.map((item) =>
        item.id === lane.lane.id
          ? {
              ...item,
              componentIds: lane.project.components.map((component) => component.id),
            }
          : item,
      ),
    });
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

    const context = resolveConnectionRouteContext(project, connection.id);
    const summary = inspectLane(project, lane.lane.id);

    expect(context.physicalRoute.status).toBe("unique");
    expect(context.geometry?.issues.map((issue) => issue.code)).toContain(
      "route-endpoint-geometry-unavailable",
    );
    expect(summary.routes).toHaveLength(1);
    expect(summary.routes[0]!.physicalReady).toBe(false);
    expect(summary.routes[0]!.issueCount).toBeGreaterThan(0);
  });

  it("normalizes serpentine auto axis and target-length sizing on apply", () => {
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
      position: { x: 0, y: 0 },
    }).project;
    project = insertComponentFromDefinition(project, {
      definitionKey: "filter.debris",
      layerId: project.layers[0]!.id,
      position: { x: 100, y: 16 },
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

    const updated = updatePhysicalRouteProperties(project, project.connections[0]!.id, {
      pattern: {
        kind: "serpentine",
        turnCount: 1,
        pitch: { value: 2, unit: "mm", provenance: { source: "user-entered" } },
        axis: "auto",
        sizing: {
          mode: "target-length",
          targetLength: {
            value: 120,
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
    });
    const pattern = updated.physicalRoutes[0]!.pattern;

    expect(pattern.kind).toBe("serpentine");
    if (pattern.kind !== "serpentine") {
      return;
    }
    expect(pattern.axis).toBe("horizontal");
    expect(pattern.pitch.value).toBe(2);
    expect(pattern.turnCount).toBe(1);
    expect(pattern.sizing.mode).toBe("explicit");
    if (pattern.sizing.mode !== "explicit") {
      return;
    }
    expect(pattern.sizing.amplitude.value).toBeGreaterThan(0);
    expect(updated.physicalRoutes[0]!.bendRadius?.value).toBe(0.75);
  });

  it("keeps no-op route applies out of history", () => {
    resetProjectStoreForTests();
    projectStore.getState().createNewProject();
    projectStore.getState().updateProject((project) => {
      let next = insertComponentFromDefinition(project, {
        definitionKey: "channel.rectangular",
        layerId: project.layers[0]!.id,
        position: { x: 0, y: 0 },
      }).project;
      next = insertComponentFromDefinition(next, {
        definitionKey: "filter.debris",
        layerId: project.layers[0]!.id,
        position: { x: 4, y: 0 },
      }).project;
      const source = next.ports.find(
        (port) =>
          port.componentId === next.components[0]!.id && port.direction === "output",
      )!;
      const target = next.ports.find(
        (port) =>
          port.componentId === next.components[1]!.id && port.direction === "input",
      )!;
      return createProjectConnection(next, source.id, target.id).project;
    }, "Create connection");
    const connectionId = projectStore.getState().project!.connections[0]!.id;
    const route = projectStore.getState().project!.physicalRoutes[0]!;
    const historyLength = projectStore.getState().history.past.length;

    projectStore.getState().updateProject(
      (project) =>
        updatePhysicalRouteProperties(project, connectionId, {
          pattern: route.pattern,
          width: route.width ?? null,
          depth: route.depth ?? null,
          bendRadius: route.bendRadius ?? null,
        }),
      "No-op route apply",
    );

    expect(projectStore.getState().history.past).toHaveLength(historyLength);
  });

  it("edits ports, materials, and injected manufacturing processes", () => {
    const base = makeProject();
    const inserted = insertComponentFromDefinition(base, {
      definitionKey: "channel.rectangular",
      layerId: base.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    const project = parseProject({
      ...inserted,
      fluids: [
        {
          id: "fluid_sample",
          name: "Sample",
          category: "sample",
          metadata: {},
        },
      ],
      manufacturingProcesses: [
        {
          id: "process_soft_lithography",
          name: "Soft lithography",
          processType: "soft-lithography",
          metadata: {},
        },
      ],
    });
    const portUpdated = updatePortProperties(
      project,
      project.ports[0]!.id,
      { name: "Sample inlet", fluidId: "fluid_sample" as FluidId },
      "2026-08-06T00:00:00.000Z",
    );
    const materialUpdated = updateMaterialProperties(
      portUpdated,
      portUpdated.materials[0]!.id,
      {
        name: "Glass substrate",
        category: "glass",
        manufacturer: " ",
        reference: "GL-01",
      },
      "2026-08-06T00:00:01.000Z",
    );
    const processUpdated = updateManufacturingProcessProperties(
      materialUpdated,
      "process_soft_lithography",
      {
        name: "SU-8 lithography",
        processType: "soft-lithography",
        profileReference: "profile.su8",
      },
      "2026-08-06T00:00:02.000Z",
    );

    expect(processUpdated.ports[0]!.name).toBe("Sample inlet");
    expect(processUpdated.ports[0]!.fluidId).toBe("fluid_sample");
    expect(processUpdated.materials[0]!.name).toBe("Glass substrate");
    expect(processUpdated.materials[0]!.manufacturer).toBeUndefined();
    expect(processUpdated.manufacturingProcesses[0]!.profileReference).toBe(
      "profile.su8",
    );
  });

  it("keeps invalid/no-op applies out of history, persistence drafts, and exports", () => {
    resetProjectStoreForTests();
    projectStore.getState().createNewProject();
    const project = projectStore.getState().project!;
    const revision = projectStore.getState().metadata!.revision;

    expect(() => updateProjectName(project, "")).toThrow();
    expect(projectStore.getState().metadata!.revision).toBe(revision);

    projectStore
      .getState()
      .updateProject(
        (current) => updateProjectName(current, current.name),
        "No-op project edit",
      );
    expect(projectStore.getState().history.past).toHaveLength(0);
    expect(projectStore.getState().metadata!.revision).toBe(revision);

    projectStore
      .getState()
      .updateProject(
        (current) =>
          updateProjectName(current, "Exported project", "2026-08-06T00:00:00.000Z"),
        "Update project",
      );
    expect(projectStore.getState().history.past).toHaveLength(1);

    const exported = JSON.parse(
      createProjectExport(projectStore.getState().project!).content,
    );
    expect(exported.name).toBe("Exported project");
    expect(JSON.stringify(exported)).not.toContain("displayUnit");
    expect(JSON.stringify(exported)).not.toContain("draft");
  });

  it("edits, rejects, resets, and clears registry parameters", () => {
    const base = makeProject();
    const inserted = insertComponentFromDefinition(base, {
      definitionKey: "chamber.reaction",
      layerId: base.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    const componentId = inserted.components[0]!.id;
    const edited = updateComponentParameterValues(inserted, {
      componentId,
      updates: {
        width: { value: 1000, unit: "um", provenance: { source: "imported" } },
        "declared-volume": {
          value: 5,
          unit: "mm3",
          provenance: { source: "user-entered" },
        },
      },
    });
    const reset = updateComponentParameterValues(edited, {
      componentId,
      updates: {
        width: { value: 2, unit: "mm", provenance: { source: "system-default" } },
      },
      provenanceOverrides: { width: "system-default" },
    });
    const cleared = updateComponentParameterValues(reset, {
      componentId,
      updates: { "declared-volume": null },
    });

    expect(edited.components[0]!.kind).toBe("chamber");
    if (edited.components[0]!.kind === "chamber") {
      expect(edited.components[0]!.chamber.dimensions.width).toEqual({
        value: 1,
        unit: "mm",
        provenance: { source: "user-entered" },
      });
    }
    if (reset.components[0]!.kind === "chamber") {
      expect(reset.components[0]!.chamber.dimensions.width.provenance.source).toBe(
        "system-default",
      );
    }
    if (cleared.components[0]!.kind === "chamber") {
      expect(cleared.components[0]!.chamber.declaredVolume).toBeUndefined();
    }
    expect(() =>
      updateComponentParameterValues(inserted, {
        componentId,
        updates: { width: { value: -1, unit: "mm" } },
      }),
    ).toThrow();
  });
});
