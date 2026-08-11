import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { deriveRouteGeometry } from "geometry-core";
import { DEFINITION_IDENTITY_EXTENSION } from "microfluidic-components";
import { parseProject, stringifyProject, type ConnectionId } from "project-model";

import { createProjectExport } from "../../import-export/projectExport";
import {
  createProjectConnection,
  insertComponentFromDefinition,
  moveComponents,
  reassignSelectedComponentsLane,
  updateComponentParameterValues,
} from "../../editor/editorActions";
import { updatePhysicalRouteProperties } from "../../editor/physicalRouteActions";
import { createLane } from "../../editor/propertyActions";
import { projectStore, resetProjectStoreForTests } from "../../state/projectStore";
import { PropertiesPanel } from "./PropertiesPanel";

interface ConnectedProjectFixture {
  connectionId: string;
}

function createConnectedProject(): ConnectedProjectFixture {
  let connectionId = "";
  act(() => {
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
        position: { x: 100, y: 0 },
      }).project;
      const source = next.ports.find(
        (port) =>
          port.componentId === next.components[0]!.id && port.direction === "output",
      )!;
      const target = next.ports.find(
        (port) =>
          port.componentId === next.components[1]!.id && port.direction === "input",
      )!;
      const result = createProjectConnection(next, source.id, target.id);
      connectionId = result.connection!.id;
      return result.project;
    }, "Create test connection");
    projectStore.getState().setSelectedConnections([connectionId]);
  });
  return { connectionId };
}

function switchRoutePattern(pattern: "straight" | "manual" | "serpentine") {
  fireEvent.change(screen.getByLabelText("Pattern"), {
    target: { value: pattern },
  });
}

function changeField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), {
    target: { value },
  });
}

function createSelectedComponent(definitionKey: string): string {
  let componentId = "";
  act(() => {
    projectStore.getState().createNewProject();
    projectStore.getState().updateProject((project) => {
      const inserted = insertComponentFromDefinition(project, {
        definitionKey,
        layerId: project.layers[0]!.id,
        position: { x: 2, y: 2 },
      });
      componentId = inserted.insertedComponentId;
      return inserted.project;
    }, "Create selected component");
    projectStore.getState().setSelectedComponents([componentId]);
  });
  return componentId;
}

function expectSerpentineRoute(connectionId: string) {
  const project = projectStore.getState().project!;
  const route = project.physicalRoutes.find(
    (item) => item.connectionId === connectionId,
  )!;
  expect(route.pattern.kind).toBe("serpentine");
  if (route.pattern.kind !== "serpentine") {
    throw new Error("Expected serpentine route");
  }
  return { project, route, pattern: route.pattern };
}

describe("PropertiesPanel lane management", () => {
  afterEach(() => {
    resetProjectStoreForTests();
  });

  it("edits splitter dimensions through the explicit physical dimensions section", () => {
    const componentId = createSelectedComponent("junction.splitter");
    const originalProject = projectStore.getState().project!;
    const originalPortIds = [...originalProject.components[0]!.portIds];
    expect(
      originalProject.components[0]!.extensions[DEFINITION_IDENTITY_EXTENSION],
    ).toMatchObject({ definitionKey: "junction.splitter" });
    render(<PropertiesPanel />);

    const section = screen.getByText("Physical dimensions").closest("section")!;
    expect(within(section).getByLabelText("Width")).toHaveValue("2");
    expect(within(section).getByLabelText("Height")).toHaveValue("1");
    expect(within(section).getByLabelText("Depth")).toHaveValue("0.2");
    expect(
      within(section).getByRole("button", { name: "Reset dimensions" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Parameters" }),
    ).not.toBeInTheDocument();

    fireEvent.change(within(section).getByLabelText("Width"), {
      target: { value: "3.5" },
    });
    fireEvent.change(within(section).getByLabelText("Height"), {
      target: { value: "1.4" },
    });
    fireEvent.change(within(section).getByLabelText("Depth"), {
      target: { value: "0.35" },
    });
    fireEvent.click(within(section).getByRole("button", { name: "Apply" }));

    const component = projectStore
      .getState()
      .project!.components.find((item) => item.id === componentId)!;
    expect(component.kind).toBe("junction");
    if (component.kind !== "junction") {
      throw new Error("Expected junction component");
    }
    expect(component.junction.dimensions?.width.value).toBe(3.5);
    expect(component.junction.dimensions?.height.value).toBe(1.4);
    expect(component.junction.dimensions?.depth.value).toBe(0.35);
    expect(component.portIds).toEqual(originalPortIds);
  });

  it("resets merger dimensions from registry defaults", () => {
    const componentId = createSelectedComponent("junction.merger");
    expect(
      projectStore.getState().project!.components[0]!.extensions[
        DEFINITION_IDENTITY_EXTENSION
      ],
    ).toMatchObject({ definitionKey: "junction.merger" });
    act(() => {
      projectStore.getState().updateProject(
        (project) =>
          updateComponentParameterValues(project, {
            componentId,
            updates: {
              width: { value: 4, unit: "mm", provenance: { source: "user-entered" } },
              height: { value: 2, unit: "mm", provenance: { source: "user-entered" } },
              depth: {
                value: 0.5,
                unit: "mm",
                provenance: { source: "user-entered" },
              },
            },
          }),
        "Preset merger dimensions",
      );
    });
    render(<PropertiesPanel />);

    const section = screen.getByText("Physical dimensions").closest("section")!;
    expect(within(section).getByLabelText("Width")).toHaveValue("4");
    fireEvent.click(within(section).getByRole("button", { name: "Reset dimensions" }));

    const component = projectStore
      .getState()
      .project!.components.find((item) => item.id === componentId)!;
    expect(component.kind).toBe("junction");
    if (component.kind !== "junction") {
      throw new Error("Expected junction component");
    }
    expect(component.junction.dimensions?.width.value).toBe(2);
    expect(component.junction.dimensions?.height.value).toBe(1);
    expect(component.junction.dimensions?.depth.value).toBe(0.2);
    expect(component.junction.dimensions?.width.provenance.source).toBe(
      "system-default",
    );
  });

  it("creates the first lane and opens the lane inspector", () => {
    act(() => {
      projectStore.getState().createNewProject();
    });
    const before = stringifyProject(projectStore.getState().project!);
    render(<PropertiesPanel />);

    fireEvent.change(screen.getByLabelText("Inspector scope"), {
      target: { value: "lane" },
    });
    expect(screen.getByText("No lanes in this project.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Add Lane" }));

    const project = projectStore.getState().project!;
    expect(project.lanes).toHaveLength(1);
    expect(project.lanes[0]).toMatchObject({
      name: "Lane 1",
      componentIds: [],
    });
    expect(screen.getByText("Lane ID: " + project.lanes[0]!.id)).toBeInTheDocument();
    expect(screen.getByText("Components: 0")).toBeInTheDocument();
    expect(stringifyProject(project)).not.toBe(before);
    expect(stringifyProject(project)).not.toContain("selectedLaneId");
  });

  it("initializes a valid serpentine draft when changing from straight", () => {
    createConnectedProject();
    const before = stringifyProject(projectStore.getState().project!);
    render(<PropertiesPanel />);

    switchRoutePattern("serpentine");

    expect(screen.getByLabelText("Turn count")).toHaveValue("4");
    expect(screen.getByLabelText("Pitch")).toHaveValue("0.75");
    expect(screen.getByLabelText("Bend radius")).toHaveValue("0.3");
    expect(screen.getByLabelText("Amplitude")).toHaveValue("8");
    expect(screen.getByLabelText("Axis")).toHaveValue("auto");
    expect(screen.getByLabelText("Sizing")).toHaveValue("explicit");
    expect(stringifyProject(projectStore.getState().project!)).toBe(before);
  });

  it("uses existing bend radius when computing a new serpentine pitch default", () => {
    const { connectionId } = createConnectedProject();
    act(() => {
      projectStore.getState().updateProject(
        (project) =>
          updatePhysicalRouteProperties(project, connectionId as ConnectionId, {
            pattern: { kind: "straight" },
            bendRadius: {
              value: 1.2,
              unit: "mm",
              provenance: { source: "user-entered" },
            },
          }),
        "Set bend radius",
      );
    });
    render(<PropertiesPanel />);

    switchRoutePattern("serpentine");

    expect(screen.getByLabelText("Bend radius")).toHaveValue("1.2");
    expect(screen.getByLabelText("Pitch")).toHaveValue("2.4");
  });

  it("blocks invalid pitch and bend-radius drafts without mutating the project", () => {
    createConnectedProject();
    render(<PropertiesPanel />);
    switchRoutePattern("serpentine");
    const before = stringifyProject(projectStore.getState().project!);
    const historyLength = projectStore.getState().history.past.length;

    changeField("Pitch", "1");
    changeField("Bend radius", "0.75");

    expect(
      screen.getByText("Minimum pitch for a 0.75 mm bend radius is 1.5 mm."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(stringifyProject(projectStore.getState().project!)).toBe(before);
    expect(projectStore.getState().history.past).toHaveLength(historyLength);
  });

  it("persists pitch 2 exactly and resynchronizes the form after apply", () => {
    const { connectionId } = createConnectedProject();
    render(<PropertiesPanel />);
    switchRoutePattern("serpentine");
    changeField("Width", "0.5");
    changeField("Depth", "0.3");
    changeField("Turn count", "4");
    changeField("Pitch", "2");
    changeField("Bend radius", "0.75");
    changeField("Amplitude", "8");

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const { project, route, pattern } = expectSerpentineRoute(connectionId);
    expect(pattern.pitch.value).toBe(2);
    expect(route.bendRadius?.value).toBe(0.75);
    expect(pattern.turnCount).toBe(4);
    expect(pattern.sizing.mode).toBe("explicit");
    if (pattern.sizing.mode === "explicit") {
      expect(pattern.sizing.amplitude.value).toBe(8);
    }
    expect(screen.getByLabelText("Pitch")).toHaveValue("2");
    const geometry = deriveRouteGeometry(project, route);
    expect(geometry.issues.map((issue) => issue.message).join(" ")).not.toContain(
      "Pitch 1",
    );
  });

  it("switches straight to serpentine and back without replacing topology", () => {
    const { connectionId } = createConnectedProject();
    const initialProject = projectStore.getState().project!;
    const connection = initialProject.connections.find(
      (item) => item.id === connectionId,
    )!;
    const routeId = initialProject.physicalRoutes.find(
      (item) => item.connectionId === connectionId,
    )!.id;
    render(<PropertiesPanel />);

    switchRoutePattern("serpentine");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    let project = projectStore.getState().project!;
    let route = project.physicalRoutes.find(
      (item) => item.connectionId === connectionId,
    )!;
    expect(route.id).toBe(routeId);
    expect(route.pattern.kind).toBe("serpentine");
    expect(project.connections.find((item) => item.id === connectionId)).toMatchObject({
      sourcePortId: connection.sourcePortId,
      targetPortId: connection.targetPortId,
    });
    expect(projectStore.getState().selectedConnectionIds).toEqual([connectionId]);

    switchRoutePattern("straight");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    project = projectStore.getState().project!;
    route = project.physicalRoutes.find((item) => item.connectionId === connectionId)!;
    expect(route.id).toBe(routeId);
    expect(route.pattern.kind).toBe("straight");
    expect(project.connections.find((item) => item.id === connectionId)).toMatchObject({
      sourcePortId: connection.sourcePortId,
      targetPortId: connection.targetPortId,
    });
    expect(projectStore.getState().selectedConnectionIds).toEqual([connectionId]);

    act(() => {
      projectStore.getState().undo();
    });
    expect(
      projectStore
        .getState()
        .project!.physicalRoutes.find((item) => item.connectionId === connectionId)!
        .pattern.kind,
    ).toBe("serpentine");

    act(() => {
      projectStore.getState().redo();
    });
    expect(
      projectStore
        .getState()
        .project!.physicalRoutes.find((item) => item.connectionId === connectionId)!
        .pattern.kind,
    ).toBe("straight");
  });

  it("keeps persisted pitch after reselect, undo, redo, and export round trip", () => {
    const { connectionId } = createConnectedProject();
    render(<PropertiesPanel />);
    switchRoutePattern("serpentine");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    act(() => {
      projectStore.getState().setInspectorScope("project");
    });
    expect(screen.queryByLabelText("Pitch")).not.toBeInTheDocument();

    act(() => {
      projectStore.getState().setSelectedConnections([connectionId]);
    });
    expect(screen.getByLabelText("Pitch")).toHaveValue("0.75");

    act(() => {
      projectStore.getState().undo();
    });
    expect(screen.queryByLabelText("Pitch")).not.toBeInTheDocument();
    expect(projectStore.getState().project!.physicalRoutes[0]!.pattern.kind).toBe(
      "straight",
    );

    act(() => {
      projectStore.getState().redo();
    });
    expect(screen.getByLabelText("Pitch")).toHaveValue("0.75");
    const { project, pattern } = expectSerpentineRoute(connectionId);
    const reloaded = parseProject(JSON.parse(stringifyProject(project)));
    const exported = parseProject(JSON.parse(createProjectExport(project).content));
    expect(
      reloaded.physicalRoutes.find((route) => route.connectionId === connectionId)!
        .pattern,
    ).toMatchObject({ kind: "serpentine", pitch: { value: 0.75 } });
    expect(
      exported.physicalRoutes.find((route) => route.connectionId === connectionId)!
        .pattern,
    ).toMatchObject({ kind: "serpentine", pitch: { value: 0.75 } });
    expect(pattern.pitch.value).toBe(0.75);
  });

  it("reopens the route inspector through idempotent editor selection after apply, movement, and reload", () => {
    const { connectionId } = createConnectedProject();
    render(<PropertiesPanel />);

    expect(screen.getByLabelText("Pattern")).toHaveValue("straight");
    changeField("Width", "0.5");
    changeField("Depth", "0.2");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    act(() => {
      projectStore.getState().setInspectorScope("project");
      projectStore.getState().setEditorSelection({
        componentIds: [],
        connectionIds: [connectionId],
      });
    });
    expect(screen.getByLabelText("Width")).toHaveValue("0.5");
    expect(screen.getByLabelText("Depth")).toHaveValue("0.2");

    act(() => {
      projectStore.getState().updateProject((project) => {
        const moved = moveComponents(project, {
          [project.components[0]!.id]: { x: 2, y: 0 },
        });
        return moved.project;
      }, "Move endpoint");
      projectStore.getState().setInspectorScope("project");
      projectStore.getState().setEditorSelection({
        componentIds: [],
        connectionIds: [connectionId],
      });
    });
    expect(screen.getByLabelText("Width")).toHaveValue("0.5");

    act(() => {
      const state = projectStore.getState();
      const reloaded = parseProject(JSON.parse(stringifyProject(state.project!)));
      projectStore
        .getState()
        .replaceProject(reloaded, state.metadata!, { resetHistory: true });
      projectStore.getState().setEditorSelection({
        componentIds: [],
        connectionIds: [connectionId],
      });
    });
    expect(projectStore.getState().selectedConnectionIds).toEqual([connectionId]);
    expect(projectStore.getState().selectedComponentIds).toEqual([]);
    expect(projectStore.getState().inspectorScope).toBe("selection");
    expect(screen.getByLabelText("Width")).toHaveValue("0.5");
  });

  it("updates channel width with success feedback and keeps the channel selected", () => {
    const { connectionId } = createConnectedProject();
    render(<PropertiesPanel />);

    changeField("Width", "0.75");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const route = projectStore
      .getState()
      .project!.physicalRoutes.find((item) => item.connectionId === connectionId)!;
    expect(route.width?.value).toBe(0.75);
    expect(projectStore.getState().selectedConnectionIds).toEqual([connectionId]);
    expect(projectStore.getState().inspectorScope).toBe("selection");
    expect(screen.getByRole("status")).toHaveTextContent("Channel properties updated");
  });

  it("reports no-op channel apply without mutating history", () => {
    createConnectedProject();
    render(<PropertiesPanel />);
    const before = stringifyProject(projectStore.getState().project!);
    const historyLength = projectStore.getState().history.past.length;

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(stringifyProject(projectStore.getState().project!)).toBe(before);
    expect(projectStore.getState().history.past).toHaveLength(historyLength);
    expect(screen.getByRole("status")).toHaveTextContent("No channel changes to apply");
  });

  it("reports blocked channel apply with alert feedback and no mutation", () => {
    createConnectedProject();
    render(<PropertiesPanel />);
    const before = stringifyProject(projectStore.getState().project!);

    changeField("Width", "not-a-number");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(stringifyProject(projectStore.getState().project!)).toBe(before);
    expect(screen.getByRole("alert")).toHaveTextContent("Channel update blocked");
  });

  it("lets an incomplete channel become ready by filling width and depth", () => {
    const { connectionId } = createConnectedProject();
    act(() => {
      projectStore.getState().updateProject((project) => {
        const moved = moveComponents(project, {
          [project.components[1]!.id]: { x: 12, y: 0 },
        });
        return moved.project;
      }, "Move endpoint inside chip");
    });
    render(<PropertiesPanel />);

    expect(screen.getByLabelText("Width")).toHaveValue("");
    expect(screen.getByLabelText("Depth")).toHaveValue("");
    changeField("Width", "0.5");
    changeField("Depth", "0.3");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const project = projectStore.getState().project!;
    const route = project.physicalRoutes.find(
      (item) => item.connectionId === connectionId,
    )!;
    expect(deriveRouteGeometry(project, route).physicalReady).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Channel properties updated");
  });

  it("shows the same persisted pitch through the lane route inspector", () => {
    const { connectionId } = createConnectedProject();
    render(<PropertiesPanel />);
    switchRoutePattern("serpentine");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    act(() => {
      projectStore.getState().updateProject((project) => {
        const created = createLane(project);
        return reassignSelectedComponentsLane(
          created.project,
          created.project.components.map((component) => component.id),
          created.lane.id,
        );
      }, "Assign lane");
      projectStore.getState().setInspectorScope("lane");
    });

    fireEvent.click(screen.getByRole("button", { name: /Rectangular channel to/i }));

    expect(projectStore.getState().selectedConnectionIds).toEqual([connectionId]);
    expect(screen.getByLabelText("Pitch")).toHaveValue("0.75");
  });

  it("persists manual core placement through the route inspector", () => {
    const { connectionId } = createConnectedProject();
    render(<PropertiesPanel />);
    switchRoutePattern("serpentine");
    changeField("Width", "0.5");
    changeField("Depth", "0.2");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    fireEvent.change(screen.getByLabelText("Placement"), {
      target: { value: "manual" },
    });
    expect(screen.getByLabelText("Core X")).not.toHaveValue("");
    expect(screen.getByLabelText("Core Y")).not.toHaveValue("");
    changeField("Core X", "40");
    changeField("Core Y", "12");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const { pattern } = expectSerpentineRoute(connectionId);
    expect(pattern.placement).toMatchObject({
      mode: "manual",
      coreCenter: {
        x: { value: 40 },
        y: { value: 12 },
      },
    });
    expect(stringifyProject(projectStore.getState().project!)).not.toContain(
      "corePrimitives",
    );
  });

  it("compacts serpentine draft values without mutating the project", () => {
    createConnectedProject();
    render(<PropertiesPanel />);
    switchRoutePattern("serpentine");
    changeField("Width", "0.5");
    changeField("Depth", "0.2");
    changeField("Pitch", "4");
    changeField("Bend radius", "1.5");
    const before = stringifyProject(projectStore.getState().project!);

    fireEvent.click(screen.getByRole("button", { name: "Compact to fit" }));

    expect(Number(screen.getByLabelText("Pitch").getAttribute("value"))).toBeLessThan(
      4,
    );
    expect(
      Number(screen.getByLabelText("Bend radius").getAttribute("value")),
    ).toBeLessThan(1.5);
    expect(stringifyProject(projectStore.getState().project!)).toBe(before);
  });
});
