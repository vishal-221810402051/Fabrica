import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { stringifyProject } from "project-model";

import {
  createProjectConnection,
  insertComponentFromDefinition,
} from "../../editor/editorActions";
import { updatePhysicalRouteProperties } from "../../editor/physicalRouteActions";
import { projectStore, resetProjectStoreForTests } from "../../state/projectStore";
import { EditorShell } from "./EditorShell";
import { Viewer3DWorkspace } from "./Viewer3DWorkspace";

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
