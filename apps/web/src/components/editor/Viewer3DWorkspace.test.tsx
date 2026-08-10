import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createComponentFromDefinition } from "microfluidic-components";
import { parseProject, stringifyProject, type Project } from "project-model";
import { projectToSceneGeometry, toCadPoint } from "geometry-core";

import {
  createProjectConnection,
  insertComponentFromDefinition,
} from "../../editor/editorActions";
import { updatePhysicalRouteProperties } from "../../editor/physicalRouteActions";
import { projectStore, resetProjectStoreForTests } from "../../state/projectStore";
import { EditorShell } from "./EditorShell";
import { RouteMesh, Viewer3DWorkspace } from "./Viewer3DWorkspace";
import {
  cameraPosition,
  cameraUp,
  sceneTarget,
  toThreePosition,
  topViewComparableScreenPoint,
} from "./viewer3dCamera";

describe("Viewer3DWorkspace", () => {
  afterEach(() => {
    resetProjectStoreForTests();
  });

  it("is reached through the lazy 3D workspace mode", async () => {
    act(() => {
      projectStore.getState().createNewProject();
    });
    render(<EditorShell />);

    expect(screen.queryByTestId("viewer3d-fallback")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "3D Preview" }));

    expect(await screen.findByTestId("viewer3d-fallback")).toBeInTheDocument();
  });

  it("maps 2D selected component IDs into the 3D projection", async () => {
    const componentId = createSupportedProject();
    act(() => {
      projectStore.getState().setSelectedComponents([componentId]);
    });

    render(<Viewer3DWorkspace />);

    expect(await screen.findByTestId(`viewer3d-component-${componentId}`)).toHaveClass(
      "active",
    );
  });

  it("maps 3D component and route clicks back to editor selection", async () => {
    const componentId = createSupportedProject();
    const connectionId = createIncompleteRoute();

    render(<Viewer3DWorkspace />);

    fireEvent.click(await screen.findByTestId(`viewer3d-component-${componentId}`));
    expect(projectStore.getState().selectedComponentIds).toEqual([componentId]);

    fireEvent.click(await screen.findByTestId(`viewer3d-route-${connectionId}`));
    expect(projectStore.getState().selectedConnectionIds).toEqual([connectionId]);
    expect(projectStore.getState().selectedComponentIds).toEqual([]);
    expect(projectStore.getState().inspectorScope).toBe("selection");
  });

  it("keeps view, material, port, and layer state outside the Project", async () => {
    createSupportedProject();
    render(<Viewer3DWorkspace />);
    const before = stringifyProject(projectStore.getState().project!);

    fireEvent.click(screen.getByRole("button", { name: "orthographic" }));
    fireEvent.click(screen.getByRole("button", { name: "wireframe" }));
    fireEvent.click(screen.getByLabelText("Ports"));
    fireEvent.click(screen.getByLabelText("Control layer"));

    expect(await screen.findByTestId("viewer3d-ui-state")).toHaveTextContent(
      "orthographic wireframe layers 0 ports true",
    );
    expect(stringifyProject(projectStore.getState().project!)).toBe(before);
  });

  it("updates scene projection after Project geometry changes", async () => {
    createSupportedProject();
    render(<Viewer3DWorkspace />);

    expect(await screen.findByTestId("viewer3d-chip")).toHaveTextContent(
      "Chip 25 x 10 x 1.5 mm",
    );
    act(() => {
      projectStore.getState().updateProject(
        (project) => ({
          ...project,
          chip: {
            ...project.chip,
            overallDimensions: {
              ...project.chip.overallDimensions,
              width: { ...project.chip.overallDimensions.width, value: 30 },
            },
          },
        }),
        "Resize chip",
      );
    });

    expect(await screen.findByTestId("viewer3d-chip")).toHaveTextContent(
      "Chip 30 x 10 x 1.5 mm",
    );
  });

  it("renders complete route projection without serializing Three state", async () => {
    const connectionId = createCompleteRoute();
    const before = stringifyProject(projectStore.getState().project!);

    render(<Viewer3DWorkspace />);

    expect(
      await screen.findByTestId(`viewer3d-route-${connectionId}`),
    ).toHaveTextContent("Route");
    fireEvent.click(screen.getByRole("button", { name: "side" }));
    expect(stringifyProject(projectStore.getState().project!)).toBe(before);
  });

  it("renders one continuous body mesh for a ready route and selects its connection", () => {
    projectStore.getState().createNewProject();
    const route = {
      id: "route_body",
      connectionId: "connection_body",
      layerId: "layer_flow",
      physicalReady: true,
      points: [],
      centerline: [],
      actualLength: 40,
      envelope: null,
      issues: [],
      segments: [],
      jointBoxes: [],
      body: {
        routeId: "route_body",
        connectionId: "connection_body",
        layerId: "layer_flow",
        boundary: [
          { x: 10, y: 9.75 },
          { x: 50, y: 9.75 },
          { x: 50, y: 10.25 },
          { x: 10, y: 10.25 },
        ],
        bounds: { minX: 10, minY: 9.75, maxX: 50, maxY: 10.25 },
        area: 20,
        width: 0.5,
        depth: 0.3,
        zTop: 1,
        zBottom: 0.7,
      },
      width: 0.5,
      depth: 0.3,
    };

    render(<RouteMesh route={route} selected={false} materialMode="solid" />);
    const body = screen.getByTestId("viewer3d-route-body-connection_body");
    fireEvent.click(body);

    expect(screen.queryByTestId("viewer3d-route-body-route_body:segment:0")).toBeNull();
    expect(projectStore.getState().selectedConnectionIds).toEqual(["connection_body"]);
    expect(projectStore.getState().selectedComponentIds).toEqual([]);
  });

  it("renders selected continuous route body with red material only", () => {
    const route = {
      id: "route_body",
      connectionId: "connection_body",
      layerId: "layer_flow",
      physicalReady: true,
      points: [],
      centerline: [],
      actualLength: 40,
      envelope: null,
      issues: [],
      segments: [],
      jointBoxes: [],
      body: {
        routeId: "route_body",
        connectionId: "connection_body",
        layerId: "layer_flow",
        boundary: [
          { x: 10, y: 9.75 },
          { x: 50, y: 9.75 },
          { x: 50, y: 10.25 },
          { x: 10, y: 10.25 },
        ],
        bounds: { minX: 10, minY: 9.75, maxX: 50, maxY: 10.25 },
        area: 20,
        width: 0.5,
        depth: 0.3,
        zTop: 1,
        zBottom: 0.7,
      },
      width: 0.5,
      depth: 0.3,
    };

    const { container } = render(
      <RouteMesh route={route} selected materialMode="transparent" />,
    );

    expect(container.querySelector("meshstandardmaterial")).toHaveAttribute(
      "color",
      "#dc2626",
    );
    expect(screen.getByTestId("viewer3d-route-body-connection_body")).toBeDefined();
  });

  it("maps project points through CAD and Three with one Y inversion", () => {
    const project = asymmetricFixtureProject();
    const layerId = project.layers[0]!.id;

    expect(toCadPoint(project, { x: 0, y: 0 }, layerId)).toEqual({
      x: 0,
      y: 60,
      z: 0,
    });
    expectThreePosition(
      toThreePosition(toCadPoint(project, { x: 0, y: 0 }, layerId)),
      [0, 0, -60],
    );
    expectThreePosition(
      toThreePosition(toCadPoint(project, { x: 0, y: 60 }, layerId)),
      [0, 0, 0],
    );
    expectThreePosition(
      toThreePosition(toCadPoint(project, { x: 100, y: 0 }, layerId)),
      [100, 0, -60],
    );
    expectThreePosition(
      toThreePosition(toCadPoint(project, { x: 100, y: 60 }, layerId)),
      [100, 0, 0],
    );
  });

  it("pins top camera orientation to match the 2D editor layout", () => {
    const scene = projectToSceneGeometry(asymmetricFixtureProject());
    const target = sceneTarget(scene);
    const top = cameraPosition(scene, "top");
    const up = cameraUp("top");
    const sampleA = scene.components.find((component) =>
      component.name.includes("Sample inlet"),
    )!;
    const sampleB = scene.components.find((component) =>
      component.name.includes("Reagent inlet"),
    )!;
    const merger = scene.components.find((component) =>
      component.name.includes("Merger"),
    )!;
    const reaction = scene.components.find((component) =>
      component.name.includes("Reaction chamber"),
    )!;

    expect(top.x).toBe(target.x);
    expect(top.y).toBeGreaterThan(target.y);
    expect(top.z).toBe(target.z);
    expect([up.x, up.y, up.z]).toEqual([0, 0, -1]);

    const sampleAScreen = topViewComparableScreenPoint(sampleA.center);
    const sampleBScreen = topViewComparableScreenPoint(sampleB.center);
    const mergerScreen = topViewComparableScreenPoint(merger.center);
    const reactionScreen = topViewComparableScreenPoint(reaction.center);

    expect(sampleAScreen.x).toBeLessThan(mergerScreen.x);
    expect(sampleBScreen.x).toBeLessThan(mergerScreen.x);
    expect(mergerScreen.x).toBeLessThan(reactionScreen.x);
    expect(sampleAScreen.y).toBeLessThan(sampleBScreen.y);
    expect(sampleAScreen.y).toBeLessThan(mergerScreen.y);
    expect(reactionScreen.y).toBeLessThan(mergerScreen.y);
  });
});

function createSupportedProject(): string {
  act(() => {
    projectStore.getState().createNewProject();
    projectStore.getState().updateProject(
      (project) =>
        insertComponentFromDefinition(project, {
          definitionKey: "reservoir.sample-inlet",
          layerId: project.layers[0]!.id,
          position: { x: 1, y: 1 },
        }).project,
      "Insert sample inlet",
    );
  });
  return projectStore.getState().project!.components[0]!.id;
}

function createIncompleteRoute(): string {
  act(() => {
    projectStore.getState().updateProject((project) => {
      let next = insertComponentFromDefinition(project, {
        definitionKey: "chamber.metering",
        layerId: project.layers[0]!.id,
        position: { x: 5, y: 1 },
      }).project;
      const source = next.ports.find((port) => port.direction === "output")!;
      const target = next.ports.find((port) => port.direction === "input")!;
      next = createProjectConnection(next, source.id, target.id).project;
      return next;
    }, "Create incomplete route");
  });
  return projectStore.getState().project!.connections[0]!.id;
}

function createCompleteRoute(): string {
  createSupportedProject();
  const connectionId = createIncompleteRoute();
  act(() => {
    projectStore.getState().updateProject(
      (project) =>
        updatePhysicalRouteProperties(project, connectionId as never, {
          width: { value: 0.2, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
        }),
      "Complete route",
    );
  });
  return connectionId;
}

function expectThreePosition(
  actual: [number, number, number],
  expected: [number, number, number],
) {
  expect(actual[0]).toBeCloseTo(expected[0]);
  expect(actual[1]).toBeCloseTo(expected[1]);
  expect(actual[2]).toBeCloseTo(expected[2]);
}

function asymmetricFixtureProject(): Project {
  let project = parseProject({
    schemaVersion: "0.4.0",
    id: "project_asymmetric_3d",
    name: "Asymmetric 3D fixture",
    createdAt: "2026-08-05T00:00:00Z",
    updatedAt: "2026-08-05T00:00:00Z",
    chip: {
      id: "chip_asymmetric",
      name: "Asymmetric chip",
      overallDimensions: {
        width: { value: 100, unit: "mm", provenance: { source: "user-entered" } },
        height: { value: 60, unit: "mm", provenance: { source: "user-entered" } },
        depth: { value: 1, unit: "mm", provenance: { source: "user-entered" } },
      },
      layerIds: ["layer_flow"],
      metadata: {},
    },
    layers: [
      {
        id: "layer_flow",
        name: "Flow",
        order: 0,
        thickness: { value: 1, unit: "mm", provenance: { source: "user-entered" } },
        metadata: {},
      },
    ],
    lanes: [],
    components: [],
    ports: [],
    connections: [],
    physicalRoutes: [],
    fluids: [],
    materials: [],
    manufacturingProcesses: [],
    validationResults: [],
    exportConfiguration: {
      requestedFormats: ["json"],
      includeValidationResults: true,
      metadata: {},
    },
    metadata: {},
    extensions: {},
  });
  for (const input of [
    { definitionKey: "reservoir.sample-inlet", position: { x: 10, y: 10 } },
    { definitionKey: "reservoir.reagent-inlet", position: { x: 10, y: 45 } },
    { definitionKey: "junction.merger", position: { x: 40, y: 30 } },
    { definitionKey: "chamber.reaction", position: { x: 75, y: 20 } },
  ]) {
    const created = createComponentFromDefinition({
      definitionKey: input.definitionKey,
      layerId: "layer_flow",
      position: input.position,
    });
    project = parseProject({
      ...project,
      components: [...project.components, created.component],
      ports: [...project.ports, ...created.ports],
    });
  }
  return project;
}
