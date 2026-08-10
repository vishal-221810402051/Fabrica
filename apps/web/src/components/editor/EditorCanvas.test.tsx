import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EdgeProps } from "@xyflow/react";
import type { Project } from "project-model";

import {
  createProjectConnection,
  insertComponentFromDefinition,
} from "../../editor/editorActions";
import { projectStore, resetProjectStoreForTests } from "../../state/projectStore";
import { EditorCanvas, PhysicalRouteEdge } from "./EditorCanvas";
import { deriveEndpointSafeInteractionPath } from "../../editor/routeInteraction";
import { handleReactFlowEditorSelection } from "./editorSelection";
import { EditorErrorBoundary } from "./EditorShell";
import { PropertiesPanel } from "./PropertiesPanel";

interface ThreeConnectionFixture {
  project: Project;
  connectionIds: string[];
}

function mockReactFlowLayout() {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: {
                x: 0,
                y: 0,
                width: 640,
                height: 480,
                top: 0,
                left: 0,
                right: 640,
                bottom: 480,
                toJSON: () => ({}),
              },
              borderBoxSize: [{ inlineSize: 640, blockSize: 480 }],
              contentBoxSize: [{ inlineSize: 640, blockSize: 480 }],
              devicePixelContentBoxSize: [{ inlineSize: 640, blockSize: 480 }],
            } as ResizeObserverEntry,
          ],
          this,
        );
      }

      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 640,
    height: 480,
    top: 0,
    left: 0,
    right: 640,
    bottom: 480,
    toJSON: () => ({}),
  });
}

function createThreeConnectionFixture(): ThreeConnectionFixture {
  let connectionIds: string[] = [];
  let createdProject: Project | null = null;
  act(() => {
    projectStore.getState().createNewProject();
    projectStore.getState().updateProject((project) => {
      let next = insertComponentFromDefinition(project, {
        definitionKey: "reservoir.sample-inlet",
        layerId: project.layers[0]!.id,
        position: { x: 0, y: 0 },
      }).project;
      next = insertComponentFromDefinition(next, {
        definitionKey: "reservoir.reagent-inlet",
        layerId: project.layers[0]!.id,
        position: { x: 0, y: 4 },
      }).project;
      next = insertComponentFromDefinition(next, {
        definitionKey: "junction.merger",
        layerId: project.layers[0]!.id,
        position: { x: 5, y: 2 },
      }).project;
      next = insertComponentFromDefinition(next, {
        definitionKey: "chamber.reaction",
        layerId: project.layers[0]!.id,
        position: { x: 10, y: 2 },
      }).project;

      const sourceA = next.ports.find(
        (port) =>
          port.componentId === next.components[0]!.id && port.direction === "output",
      )!;
      const sourceB = next.ports.find(
        (port) =>
          port.componentId === next.components[1]!.id && port.direction === "output",
      )!;
      const mergerInputs = next.ports.filter(
        (port) =>
          port.componentId === next.components[2]!.id && port.direction === "input",
      );
      const mergerOutput = next.ports.find(
        (port) =>
          port.componentId === next.components[2]!.id && port.direction === "output",
      )!;
      const chamberInput = next.ports.find(
        (port) =>
          port.componentId === next.components[3]!.id && port.direction === "input",
      )!;

      const first = createProjectConnection(next, sourceA.id, mergerInputs[0]!.id);
      const second = createProjectConnection(
        first.project,
        sourceB.id,
        mergerInputs[1]!.id,
      );
      const third = createProjectConnection(
        second.project,
        mergerOutput.id,
        chamberInput.id,
      );
      connectionIds = [
        first.connection!.id,
        second.connection!.id,
        third.connection!.id,
      ];
      createdProject = third.project;
      return third.project;
    }, "Create three-connection fixture");
  });
  return { project: createdProject!, connectionIds };
}

function createThreeConnectionFixtureSequentially(): ThreeConnectionFixture {
  const connectionIds: string[] = [];
  act(() => {
    projectStore.getState().createNewProject();
    projectStore.getState().updateProject((project) => {
      let next = insertComponentFromDefinition(project, {
        definitionKey: "reservoir.sample-inlet",
        layerId: project.layers[0]!.id,
        position: { x: 0, y: 0 },
      }).project;
      next = insertComponentFromDefinition(next, {
        definitionKey: "reservoir.reagent-inlet",
        layerId: project.layers[0]!.id,
        position: { x: 0, y: 4 },
      }).project;
      next = insertComponentFromDefinition(next, {
        definitionKey: "junction.merger",
        layerId: project.layers[0]!.id,
        position: { x: 5, y: 2 },
      }).project;
      return insertComponentFromDefinition(next, {
        definitionKey: "chamber.reaction",
        layerId: project.layers[0]!.id,
        position: { x: 10, y: 2 },
      }).project;
    }, "Create components");

    const project = projectStore.getState().project!;
    const sourceA = project.ports.find(
      (port) =>
        port.componentId === project.components[0]!.id && port.direction === "output",
    )!;
    const sourceB = project.ports.find(
      (port) =>
        port.componentId === project.components[1]!.id && port.direction === "output",
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
    const pairs = [
      [sourceA.id, mergerInputs[0]!.id],
      [sourceB.id, mergerInputs[1]!.id],
      [mergerOutput.id, chamberInput.id],
    ] as const;

    for (const [sourcePortId, targetPortId] of pairs) {
      let createdConnectionId = "";
      projectStore.getState().updateProject((currentProject) => {
        const result = createProjectConnection(
          currentProject,
          sourcePortId,
          targetPortId,
        );
        createdConnectionId = result.connection!.id;
        return result.project;
      }, "Create connection");
      connectionIds.push(createdConnectionId);
      projectStore.getState().selectConnectionForInspection(createdConnectionId);
      expect(projectStore.getState().project!.connections).toHaveLength(
        connectionIds.length,
      );
      expect(projectStore.getState().project!.physicalRoutes).toHaveLength(
        connectionIds.length,
      );
      expect(projectStore.getState().selectedConnectionIds).toEqual([
        createdConnectionId,
      ]);
      expect(projectStore.getState().selectedComponentIds).toEqual([]);
      expect(projectStore.getState().inspectorScope).toBe("selection");
    }
  });
  return { project: projectStore.getState().project!, connectionIds };
}

describe("PhysicalRouteEdge", () => {
  afterEach(() => {
    resetProjectStoreForTests();
    vi.restoreAllMocks();
  });

  it("selects an already-selected channel through its direct SVG pointer path", () => {
    projectStore.getState().createNewProject();
    projectStore.setState({
      selectedComponentIds: ["component_stale"],
      selectedConnectionIds: ["connection_edge"],
      inspectorScope: "project",
    });

    const { container } = render(
      <svg>
        <PhysicalRouteEdge
          {...({
            id: "connection_edge",
            sourceX: 0,
            sourceY: 0,
            targetX: 100,
            targetY: 0,
            interactionWidth: 24,
            selected: true,
            data: {
              connectionId: "connection_edge",
              selected: true,
              routePath: "M 0 0 L 100 0",
              routePoints: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
              ],
              routeWidthPx: 2,
              physicalReady: true,
            },
          } as unknown as EdgeProps)}
        />
      </svg>,
    );

    expect(container.querySelector(".physical-route-edge-selected")).not.toBeNull();
    fireEvent.pointerDown(
      screen.getByTestId("physical-route-edge-interaction-connection_edge"),
      { button: 0, isPrimary: true },
    );

    expect(projectStore.getState().selectedConnectionIds).toEqual(["connection_edge"]);
    expect(projectStore.getState().selectedComponentIds).toEqual([]);
    expect(projectStore.getState().inspectorScope).toBe("selection");
  });

  it("keeps the visible route full-length and trims only the interaction path", () => {
    const { container } = render(
      <svg>
        <PhysicalRouteEdge
          {...({
            id: "connection_manual",
            sourceX: 0,
            sourceY: 0,
            targetX: 60,
            targetY: 20,
            interactionWidth: 10,
            selected: false,
            data: {
              connectionId: "connection_manual",
              selected: false,
              routePath: "M 0 0 L 100 0",
              routePoints: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
              ],
              routeWidthPx: 2,
              physicalReady: false,
            },
          } as unknown as EdgeProps)}
        />
      </svg>,
    );

    expect(container.querySelector(".physical-route-edge")).toHaveAttribute(
      "d",
      "M 0 0 L 100 0",
    );
    const interaction = screen.getByTestId(
      "physical-route-edge-interaction-connection_manual",
    );
    expect(interaction).toHaveAttribute("d", "M 28 0 L 72 0");
    expect(interaction).toHaveAttribute("stroke-width", "24");
    expect(interaction).toHaveAttribute("vector-effect", "non-scaling-stroke");
  });

  it("disables the interaction path while a connection gesture is active", () => {
    projectStore.getState().createNewProject();
    render(
      <svg>
        <PhysicalRouteEdge
          {...({
            id: "connection_disabled",
            sourceX: 0,
            sourceY: 0,
            targetX: 100,
            targetY: 0,
            interactionWidth: 24,
            selected: false,
            data: {
              connectionId: "connection_disabled",
              selected: false,
              interactionDisabled: true,
              routePath: "M 0 0 L 100 0",
              routePoints: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
              ],
              routeWidthPx: 2,
              physicalReady: true,
            },
          } as unknown as EdgeProps)}
        />
      </svg>,
    );

    const interaction = screen.getByTestId(
      "physical-route-edge-interaction-connection_disabled",
    );
    expect(interaction).toHaveClass("physical-route-edge-interaction-disabled");
    expect(interaction).toHaveAttribute("data-interaction-disabled", "true");

    fireEvent.pointerDown(interaction, { button: 0, isPrimary: true });

    expect(projectStore.getState().selectedConnectionIds).toEqual([]);
  });

  it("keeps a short route interactable with adaptive endpoint trimming", () => {
    expect(
      deriveEndpointSafeInteractionPath([
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ]),
    ).toBe("M 14 0 L 26 0");

    render(
      <svg>
        <PhysicalRouteEdge
          {...({
            id: "connection_short",
            sourceX: 0,
            sourceY: 0,
            targetX: 40,
            targetY: 0,
            interactionWidth: 24,
            selected: false,
            data: {
              connectionId: "connection_short",
              selected: false,
              routePath: "M 0 0 L 40 0",
              routePoints: [
                { x: 0, y: 0 },
                { x: 40, y: 0 },
              ],
              routeWidthPx: 2,
              physicalReady: true,
            },
          } as unknown as EdgeProps)}
        />
      </svg>,
    );

    const interaction = screen.getByTestId(
      "physical-route-edge-interaction-connection_short",
    );
    expect(interaction).toHaveAttribute("data-interaction-disabled", "false");
    fireEvent.pointerDown(interaction, { button: 0, isPrimary: true });
    expect(projectStore.getState().selectedConnectionIds).toEqual(["connection_short"]);
  });
});

describe("EditorCanvas React Flow integration", () => {
  afterEach(() => {
    resetProjectStoreForTests();
    vi.restoreAllMocks();
  });

  it("keeps physical route wrappers hit-testable without React Flow owning route selection", async () => {
    const { connectionIds } = createThreeConnectionFixture();
    mockReactFlowLayout();

    render(
      <>
        <EditorCanvas onFitReady={() => undefined} onResetReady={() => undefined} />
        <PropertiesPanel />
      </>,
    );

    const firstWrapper = await screen.findByTestId(`rf__edge-${connectionIds[0]}`);
    expect(firstWrapper).not.toHaveClass("inactive");
    expect(firstWrapper).not.toHaveClass("selectable");
    expect(
      screen.getByTestId(`physical-route-edge-interaction-${connectionIds[0]}`),
    ).toHaveAttribute("d", expect.stringMatching(/^M .+ L .+/));

    act(() => {
      fireEvent.click(firstWrapper);
    });

    await waitFor(() => {
      expect(projectStore.getState().selectedConnectionIds).toEqual([connectionIds[0]]);
    });
    expect(projectStore.getState().selectedComponentIds).toEqual([]);
    expect(projectStore.getState().inspectorScope).toBe("selection");
    expect(screen.getByText("Channel / Connection")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen
          .getByTestId(`rf__edge-${connectionIds[0]}`)
          .querySelector(".physical-route-edge-selected"),
      ).not.toBeNull();
    });

    const secondWrapper = screen.getByTestId(`rf__edge-${connectionIds[1]}`);
    expect(secondWrapper).not.toHaveClass("inactive");
    expect(secondWrapper).not.toHaveClass("selectable");
    act(() => {
      fireEvent.click(secondWrapper);
    });

    await waitFor(() => {
      expect(projectStore.getState().selectedConnectionIds).toEqual([connectionIds[1]]);
    });
    expect(projectStore.getState().selectedComponentIds).toEqual([]);
    expect(projectStore.getState().inspectorScope).toBe("selection");
    expect(
      screen
        .getByTestId(`rf__edge-${connectionIds[0]}`)
        .querySelector(".physical-route-edge-selected"),
    ).toBeNull();
    expect(
      screen
        .getByTestId(`rf__edge-${connectionIds[1]}`)
        .querySelector(".physical-route-edge-selected"),
    ).not.toBeNull();
  });

  it("renders dedicated channel edit points that independently open exact route properties", async () => {
    const { connectionIds } = createThreeConnectionFixture();
    mockReactFlowLayout();

    render(
      <>
        <EditorCanvas onFitReady={() => undefined} onResetReady={() => undefined} />
        <PropertiesPanel />
      </>,
    );

    await screen.findByTestId(`channel-edit-point-${connectionIds[0]}`);
    const editPoints = connectionIds.map((connectionId) =>
      screen.getByTestId(`channel-edit-point-${connectionId}`),
    );
    expect(editPoints).toHaveLength(3);
    expect(new Set(editPoints.map((point) => point.dataset.connectionId)).size).toBe(3);
    for (const editPoint of editPoints) {
      expect(editPoint.closest(".react-flow__edge")).toBeNull();
      expect(editPoint.querySelector(".channel-edit-point__visual")).not.toBeNull();
      expect(editPoint.querySelector(".channel-edit-point__hit")).toHaveAttribute(
        "title",
        "Edit channel",
      );
    }

    for (const connectionId of connectionIds) {
      act(() => {
        fireEvent.click(
          screen
            .getByTestId(`channel-edit-point-${connectionId}`)
            .querySelector(".channel-edit-point__hit")!,
        );
      });

      await waitFor(() => {
        expect(projectStore.getState().selectedConnectionIds).toEqual([connectionId]);
      });
      expect(projectStore.getState().selectedComponentIds).toEqual([]);
      expect(projectStore.getState().inspectorScope).toBe("selection");
      expect(screen.getByText("Channel / Connection")).toBeInTheDocument();
    }
  });

  it("keeps channel edit points derived across pattern changes without topology recreation", async () => {
    const { connectionIds } = createThreeConnectionFixture();
    mockReactFlowLayout();

    render(
      <>
        <EditorCanvas onFitReady={() => undefined} onResetReady={() => undefined} />
        <PropertiesPanel />
      </>,
    );

    const connectionId = connectionIds[0]!;
    await screen.findByTestId(`channel-edit-point-${connectionId}`);
    const initialTransform = screen.getByTestId(`channel-edit-point-${connectionId}`)
      .style.transform;
    act(() => {
      fireEvent.click(
        screen
          .getByTestId(`channel-edit-point-${connectionId}`)
          .querySelector(".channel-edit-point__hit")!,
      );
    });
    await screen.findByText("Channel / Connection");
    const initialProject = projectStore.getState().project!;
    const initialConnection = initialProject.connections.find(
      (connection) => connection.id === connectionId,
    )!;
    const initialRoute = initialProject.physicalRoutes.find(
      (route) => route.connectionId === connectionId,
    )!;

    fireEvent.change(screen.getByLabelText("Pattern"), {
      target: { value: "serpentine" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const route = projectStore
        .getState()
        .project!.physicalRoutes.find((item) => item.connectionId === connectionId)!;
      expect(route.pattern.kind).toBe("serpentine");
    });
    const serpentineTransform = screen.getByTestId(`channel-edit-point-${connectionId}`)
      .style.transform;
    expect(serpentineTransform).not.toBe(initialTransform);

    fireEvent.change(screen.getByLabelText("Pattern"), {
      target: { value: "straight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const route = projectStore
        .getState()
        .project!.physicalRoutes.find((item) => item.connectionId === connectionId)!;
      expect(route.pattern.kind).toBe("straight");
    });
    const finalProject = projectStore.getState().project!;
    const finalConnection = finalProject.connections.find(
      (connection) => connection.id === connectionId,
    )!;
    const finalRoute = finalProject.physicalRoutes.find(
      (route) => route.connectionId === connectionId,
    )!;
    expect(finalConnection).toMatchObject({
      id: initialConnection.id,
      sourcePortId: initialConnection.sourcePortId,
      targetPortId: initialConnection.targetPortId,
    });
    expect(finalRoute.id).toBe(initialRoute.id);
    expect(
      screen.getByTestId(`channel-edit-point-${connectionId}`).style.transform,
    ).toBe(initialTransform);
  });

  it("reopens the channel inspector from project and component scopes", async () => {
    const { project, connectionIds } = createThreeConnectionFixture();
    mockReactFlowLayout();

    render(
      <>
        <EditorCanvas onFitReady={() => undefined} onResetReady={() => undefined} />
        <PropertiesPanel />
      </>,
    );

    await screen.findByTestId(`rf__edge-${connectionIds[1]}`);
    act(() => {
      projectStore.getState().setInspectorScope("project");
    });

    act(() => {
      fireEvent.click(screen.getByTestId(`rf__edge-${connectionIds[1]}`));
    });

    await waitFor(() => {
      expect(projectStore.getState().selectedConnectionIds).toEqual([connectionIds[1]]);
    });
    expect(projectStore.getState().inspectorScope).toBe("selection");
    expect(screen.getByText("Channel / Connection")).toBeInTheDocument();

    act(() => {
      projectStore.getState().setSelectedComponents([project.components[2]!.id]);
    });
    expect(projectStore.getState().selectedConnectionIds).toEqual([]);

    act(() => {
      fireEvent.click(screen.getByTestId(`rf__edge-${connectionIds[1]}`));
    });

    await waitFor(() => {
      expect(projectStore.getState().selectedConnectionIds).toEqual([connectionIds[1]]);
    });
    expect(projectStore.getState().selectedComponentIds).toEqual([]);
    expect(projectStore.getState().inspectorScope).toBe("selection");
    expect(screen.getByText("Channel / Connection")).toBeInTheDocument();
  });

  it("reinspects an applied route and preserves topology across straight and serpentine edits", async () => {
    const { connectionIds } = createThreeConnectionFixture();
    mockReactFlowLayout();

    render(
      <>
        <EditorCanvas onFitReady={() => undefined} onResetReady={() => undefined} />
        <PropertiesPanel />
      </>,
    );

    const connectionId = connectionIds[0]!;
    await screen.findByTestId(`rf__edge-${connectionId}`);
    act(() => {
      fireEvent.click(screen.getByTestId(`rf__edge-${connectionId}`));
    });
    await screen.findByText("Channel / Connection");
    const initialProject = projectStore.getState().project!;
    const initialConnection = initialProject.connections.find(
      (connection) => connection.id === connectionId,
    )!;
    const initialRoute = initialProject.physicalRoutes.find(
      (route) => route.connectionId === connectionId,
    )!;

    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "0.5" } });
    fireEvent.change(screen.getByLabelText("Depth"), { target: { value: "0.2" } });
    fireEvent.change(screen.getByLabelText("Pattern"), {
      target: { value: "serpentine" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const route = projectStore
        .getState()
        .project!.physicalRoutes.find((item) => item.connectionId === connectionId)!;
      expect(route.pattern.kind).toBe("serpentine");
    });
    let currentProject = projectStore.getState().project!;
    let currentConnection = currentProject.connections.find(
      (connection) => connection.id === connectionId,
    )!;
    let currentRoute = currentProject.physicalRoutes.find(
      (route) => route.connectionId === connectionId,
    )!;
    expect(currentConnection).toMatchObject({
      id: initialConnection.id,
      sourcePortId: initialConnection.sourcePortId,
      targetPortId: initialConnection.targetPortId,
    });
    expect(currentRoute.id).toBe(initialRoute.id);

    act(() => {
      projectStore.getState().setInspectorScope("project");
    });
    fireEvent.click(screen.getByTestId(`rf__edge-${connectionId}`));

    await waitFor(() => {
      expect(projectStore.getState().selectedConnectionIds).toEqual([connectionId]);
    });
    expect(screen.getByLabelText("Width")).toHaveValue("0.5");
    expect(screen.getByLabelText("Depth")).toHaveValue("0.2");
    expect(screen.getByLabelText("Pattern")).toHaveValue("serpentine");

    fireEvent.change(screen.getByLabelText("Pattern"), {
      target: { value: "straight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const route = projectStore
        .getState()
        .project!.physicalRoutes.find((item) => item.connectionId === connectionId)!;
      expect(route.pattern.kind).toBe("straight");
    });
    currentProject = projectStore.getState().project!;
    currentConnection = currentProject.connections.find(
      (connection) => connection.id === connectionId,
    )!;
    currentRoute = currentProject.physicalRoutes.find(
      (route) => route.connectionId === connectionId,
    )!;
    expect(currentConnection).toMatchObject({
      id: initialConnection.id,
      sourcePortId: initialConnection.sourcePortId,
      targetPortId: initialConnection.targetPortId,
    });
    expect(currentRoute.id).toBe(initialRoute.id);
    expect(projectStore.getState().selectedConnectionIds).toEqual([connectionId]);
  });

  it("renders a valid three-connection fixture without the editor boundary fallback", async () => {
    const { connectionIds } = createThreeConnectionFixture();
    mockReactFlowLayout();

    render(
      <EditorErrorBoundary>
        <EditorCanvas onFitReady={() => undefined} onResetReady={() => undefined} />
      </EditorErrorBoundary>,
    );

    expect(screen.queryByText("Editor view could not render")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(`rf__edge-${connectionIds[0]}`)).toBeInTheDocument();
    });
    for (const connectionId of connectionIds) {
      expect(
        screen.getByTestId(`physical-route-edge-interaction-${connectionId}`),
      ).toBeInTheDocument();
    }
    expect(
      new Set(projectStore.getState().project!.connections.map((item) => item.id)).size,
    ).toBe(3);
    expect(
      new Set(projectStore.getState().project!.physicalRoutes.map((item) => item.id))
        .size,
    ).toBe(3);
  });

  it("keeps first, second, and third connection creation on canonical connection selection", async () => {
    const { connectionIds } = createThreeConnectionFixtureSequentially();
    mockReactFlowLayout();

    render(
      <EditorErrorBoundary>
        <EditorCanvas onFitReady={() => undefined} onResetReady={() => undefined} />
      </EditorErrorBoundary>,
    );

    expect(projectStore.getState().selectedConnectionIds).toEqual([connectionIds[2]]);
    expect(screen.queryByText("Editor view could not render")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(`rf__edge-${connectionIds[2]}`)).toBeInTheDocument();
    });
  });

  it("ignores stale React Flow edge selection after the app selects a newer connection", () => {
    const { connectionIds } = createThreeConnectionFixture();
    act(() => {
      projectStore.getState().selectConnectionForInspection(connectionIds[1]!);
      handleReactFlowEditorSelection({
        nodes: [],
        edges: [{ id: connectionIds[0] } as never],
      });
    });

    expect(projectStore.getState().selectedConnectionIds).toEqual([connectionIds[1]]);
    expect(projectStore.getState().selectedComponentIds).toEqual([]);
    expect(projectStore.getState().inspectorScope).toBe("selection");
  });

  it("maps React Flow node selection only to component selection", () => {
    const { project, connectionIds } = createThreeConnectionFixture();
    act(() => {
      projectStore.getState().selectConnectionForInspection(connectionIds[0]!);
      handleReactFlowEditorSelection({
        nodes: [
          {
            id: project.components[0]!.id,
            type: "microfluidic",
            data: {},
            position: { x: 0, y: 0 },
          } as never,
        ],
        edges: [{ id: connectionIds[1] } as never],
      });
    });

    expect(projectStore.getState().selectedComponentIds).toEqual([
      project.components[0]!.id,
    ]);
    expect(projectStore.getState().selectedConnectionIds).toEqual([]);
    expect(projectStore.getState().inspectorScope).toBe("selection");
  });

  it("keeps merger handles present and separate while existing route hit paths exist", async () => {
    const { connectionIds } = createThreeConnectionFixture();
    mockReactFlowLayout();

    render(
      <EditorCanvas onFitReady={() => undefined} onResetReady={() => undefined} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`rf__edge-${connectionIds[0]}`)).toBeInTheDocument();
    });

    const inputA = screen.getByLabelText(/^Input Input A:/);
    const inputB = screen.getByLabelText(/^Input Input B:/);
    const output = screen.getByLabelText(/^Output Output:/);
    expect(inputA).toHaveClass("port-input");
    expect(inputB).toHaveClass("port-input");
    expect(output).toHaveClass("port-output");
    expect(inputA).not.toBe(inputB);
    expect(
      screen.getByTestId(`physical-route-edge-interaction-${connectionIds[0]}`),
    ).toHaveAttribute("data-interaction-disabled", "false");
  });

  it("does not render a selected manual serpentine core overlay when route geometry fails", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { project, connectionIds } = createThreeConnectionFixture();
    const brokenProject = {
      ...project,
      physicalRoutes: project.physicalRoutes.map((route, index) =>
        index === 0
          ? {
              ...route,
              connectionId: "connection_missing",
              pattern: {
                kind: "serpentine",
                placement: { mode: "manual" },
              } as never,
            }
          : route,
      ),
    } as Project;

    act(() => {
      projectStore.setState({
        project: brokenProject,
        selectedConnectionIds: ["connection_missing" as never],
      });
    });
    render(
      <EditorErrorBoundary>
        <EditorCanvas onFitReady={() => undefined} onResetReady={() => undefined} />
      </EditorErrorBoundary>,
    );

    expect(screen.queryByText("Editor view could not render")).not.toBeInTheDocument();
    expect(screen.queryByText("Serpentine core")).not.toBeInTheDocument();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(connectionIds).toHaveLength(3);
  });
});

describe("EditorErrorBoundary", () => {
  afterEach(() => {
    resetProjectStoreForTests();
    vi.restoreAllMocks();
  });

  it("shows the caught error message and retries without mutating project state", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    projectStore.getState().createNewProject();
    const before = projectStore.getState().project;
    let shouldThrow = true;
    function MaybeThrowingChild() {
      if (shouldThrow) {
        throw new Error("diagnostic render failure");
      }
      return <div>Recovered editor</div>;
    }

    render(
      <EditorErrorBoundary>
        <MaybeThrowingChild />
      </EditorErrorBoundary>,
    );

    expect(screen.getByText("Editor view could not render")).toBeInTheDocument();
    expect(screen.getByText("diagnostic render failure")).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry editor" }));

    expect(screen.getByText("Recovered editor")).toBeInTheDocument();
    expect(projectStore.getState().project).toBe(before);
    expect(errorSpy).toHaveBeenCalled();
  });
});
