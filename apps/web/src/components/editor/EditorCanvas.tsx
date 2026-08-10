import { useMemo, useRef } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  type Connection as ReactFlowConnection,
  type EdgeProps,
  type Node,
  type OnSelectionChangeParams,
  type NodeProps,
} from "@xyflow/react";
import {
  MAJOR_GRID_MM,
  PHYSICAL_SNAP_MM,
  deriveRouteGeometry,
  displayToMm,
  mmToDisplay,
} from "geometry-core";
import { checkPortCompatibility } from "microfluidic-components";

import { createProjectConnection, moveComponents } from "../../editor/editorActions";
import { updateSerpentineCoreCenter } from "../../editor/physicalRouteActions";
import { decodeReactFlowConnection } from "../../editor/connectionAdapter";
import { deriveEditorProjection } from "../../editor/editorProjection";
import { parseHandleId } from "../../editor/handleIds";
import { projectStore } from "../../state/projectStore";
import { useProjectStore } from "../../state/projectStore.react";
import { MicrofluidicNode } from "./MicrofluidicNode";
import type { EditorEdgeData } from "../../editor/editor.types";

const nodeTypes = {
  microfluidic: MicrofluidicNode,
  chipBoundary: ChipBoundaryNode,
  serpentineCore: SerpentineCoreNode,
};
const edgeTypes = { physicalRoute: PhysicalRouteEdge };

export function EditorCanvas(props: {
  onFitReady: (fit: () => void) => void;
  onResetReady: (reset: () => void) => void;
}) {
  return (
    <ReactFlowProvider>
      <EditorCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function EditorCanvasInner(props: {
  onFitReady: (fit: () => void) => void;
  onResetReady: (reset: () => void) => void;
}) {
  const project = useProjectStore((state) => state.project);
  const selectedComponentIds = useProjectStore((state) => state.selectedComponentIds);
  const selectedConnectionIds = useProjectStore((state) => state.selectedConnectionIds);
  const dragPreviewPositions = useProjectStore((state) => state.dragPreviewPositions);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const transient = useMemo(
    () => ({ selectedComponentIds, selectedConnectionIds }),
    [selectedComponentIds, selectedConnectionIds],
  );
  const projection = useMemo(
    () => (project ? deriveEditorProjection(project, transient) : null),
    [project, transient],
  );
  const nodes = useMemo(
    () =>
      projection
        ? [
            ...(project ? [chipBoundaryNode(project)] : []),
            ...projection.nodes.map((node) => ({
              ...node,
              position: dragPreviewPositions[node.id] ?? node.position,
            })),
            ...(project
              ? selectedSerpentineCoreNodes(project, selectedConnectionIds).map(
                  (node) => ({
                    ...node,
                    position: dragPreviewPositions[node.id] ?? node.position,
                  }),
                )
              : []),
          ]
        : [],
    [projection, project, dragPreviewPositions, selectedConnectionIds],
  );
  const edges = projection?.edges ?? [];

  if (!project) {
    return <div className="editor-canvas-empty">Open a project to edit.</div>;
  }

  return (
    <div className="editor-canvas" ref={flowRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.25}
        maxZoom={2}
        snapToGrid
        snapGrid={[mmToDisplay(PHYSICAL_SNAP_MM), mmToDisplay(PHYSICAL_SNAP_MM)]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        nodesDraggable
        onInit={(instance) => {
          props.onFitReady(() => instance.fitView());
          props.onResetReady(() => instance.setViewport({ x: 0, y: 0, zoom: 1 }));
        }}
        onNodeDrag={(_, node) => {
          projectStore.getState().setDragPreviewPositions({ [node.id]: node.position });
        }}
        onNodeDragStop={(_, node, selectedNodes) => {
          if (node.type === "serpentineCore") {
            try {
              const data = node.data as {
                connectionId: string;
                widthPx: number;
                heightPx: number;
              };
              const center = {
                x: displayToMm(node.position.x + data.widthPx / 2),
                y: displayToMm(node.position.y + data.heightPx / 2),
              };
              projectStore.getState().clearDragPreviewPositions();
              projectStore
                .getState()
                .updateProject(
                  (currentProject) =>
                    updateSerpentineCoreCenter(
                      currentProject,
                      data.connectionId as never,
                      center,
                    ),
                  "Move serpentine core",
                );
            } catch (error) {
              projectStore.getState().clearDragPreviewPositions();
              projectStore.getState().setEditorError({
                code:
                  error instanceof Error && "code" in error
                    ? String(error.code)
                    : "EDITOR_CORE_MOVE_FAILED",
                message:
                  error instanceof Error
                    ? error.message
                    : "Serpentine core could not move",
              });
            }
            return;
          }
          const movedNodes = selectedNodes.length > 0 ? selectedNodes : [node];
          const positions = Object.fromEntries(
            movedNodes
              .filter((candidate) => candidate.type === "microfluidic")
              .map((candidate) => [
                candidate.id,
                {
                  x: displayToMm(candidate.position.x),
                  y: displayToMm(candidate.position.y),
                },
              ]),
          );
          try {
            const result = moveComponents(project, positions);
            projectStore.getState().clearDragPreviewPositions();
            if (result.changed) {
              projectStore
                .getState()
                .updateProject(() => result.project, "Move components");
            }
          } catch (error) {
            projectStore.getState().clearDragPreviewPositions();
            projectStore.getState().setEditorError({
              code:
                error instanceof Error && "code" in error
                  ? String(error.code)
                  : "EDITOR_NONFINITE_POSITION",
              message:
                error instanceof Error ? error.message : "Components could not move",
            });
          }
        }}
        onConnect={(connection) => connect(connection)}
        isValidConnection={(connection) => previewConnection(project, connection)}
        onSelectionChange={(selection) => handleSelection(selection)}
        onNodeClick={(_, node) => {
          if (node.type === "chipBoundary") {
            return;
          }
          if (node.type === "serpentineCore") {
            const data = node.data as { connectionId: string };
            projectStore.getState().setSelectedConnections([data.connectionId]);
            return;
          }
          projectStore.getState().setSelectedComponents([node.id]);
        }}
        onEdgeClick={(event, edge) => {
          event.stopPropagation();
          projectStore.getState().setSelectedConnections([edge.id]);
        }}
      >
        <Background gap={mmToDisplay(MAJOR_GRID_MM)} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function chipBoundaryNode(
  project: NonNullable<ReturnType<typeof projectStore.getState>["project"]>,
): Node {
  return {
    id: "chip-boundary",
    type: "chipBoundary",
    position: { x: 0, y: 0 },
    data: {
      widthPx: mmToDisplay(project.chip.overallDimensions.width.value),
      heightPx: mmToDisplay(project.chip.overallDimensions.height.value),
      label: project.chip.name,
    },
    draggable: false,
    selectable: false,
    connectable: false,
  };
}

function ChipBoundaryNode(props: NodeProps) {
  const data = props.data as { widthPx: number; heightPx: number; label: string };
  return (
    <div
      className="chip-boundary-node"
      style={{ width: data.widthPx, height: data.heightPx }}
      aria-label={`${data.label} physical chip boundary`}
    />
  );
}

function selectedSerpentineCoreNodes(
  project: NonNullable<ReturnType<typeof projectStore.getState>["project"]>,
  selectedConnectionIds: readonly string[],
): Node[] {
  if (selectedConnectionIds.length !== 1) {
    return [];
  }
  const connectionId = selectedConnectionIds[0]!;
  const route = project.physicalRoutes.find(
    (candidate) => candidate.connectionId === connectionId,
  );
  if (
    !route ||
    route.pattern.kind !== "serpentine" ||
    route.pattern.placement.mode !== "manual"
  ) {
    return [];
  }
  const geometry = deriveRouteGeometry(project, route);
  if (!geometry.coreEnvelope) {
    return [];
  }
  const paddingPx = mmToDisplay(0.5);
  const widthPx = Math.max(
    mmToDisplay(1),
    mmToDisplay(geometry.coreEnvelope.maxX - geometry.coreEnvelope.minX) +
      paddingPx * 2,
  );
  const heightPx = Math.max(
    mmToDisplay(1),
    mmToDisplay(geometry.coreEnvelope.maxY - geometry.coreEnvelope.minY) +
      paddingPx * 2,
  );
  return [
    {
      id: `serpentine-core:${connectionId}`,
      type: "serpentineCore",
      position: {
        x: mmToDisplay(geometry.coreEnvelope.minX) - paddingPx,
        y: mmToDisplay(geometry.coreEnvelope.minY) - paddingPx,
      },
      data: {
        connectionId,
        widthPx,
        heightPx,
        label: "Serpentine core",
      },
      draggable: true,
      selectable: true,
      connectable: false,
    },
  ];
}

function SerpentineCoreNode(props: NodeProps) {
  const data = props.data as { widthPx: number; heightPx: number; label: string };
  return (
    <div
      className="serpentine-core-node"
      style={{ width: data.widthPx, height: data.heightPx }}
      aria-label={`${data.label} drag handle`}
      title={`${data.label} drag handle`}
    >
      <span>{data.label}</span>
    </div>
  );
}

function PhysicalRouteEdge(props: EdgeProps) {
  const data = props.data as EditorEdgeData | undefined;
  const points =
    data?.routePoints && data.routePoints.length >= 2
      ? data.routePoints
      : [
          { x: props.sourceX, y: props.sourceY },
          { x: props.targetX, y: props.targetY },
        ];
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  return (
    <BaseEdge
      path={data?.routePath || path}
      className={
        props.selected || data?.selected
          ? "physical-route-edge physical-route-edge-selected"
          : "physical-route-edge"
      }
      interactionWidth={props.interactionWidth ?? 24}
      style={{ strokeWidth: data?.routeWidthPx ?? 2 }}
    />
  );
}

function handleSelection(selection: OnSelectionChangeParams) {
  if (selection.nodes.length === 0 && selection.edges.length === 0) {
    return;
  }
  const componentNodes = selection.nodes.filter((node) => node.type === "microfluidic");
  const coreConnectionIds = selection.nodes
    .filter((node) => node.type === "serpentineCore")
    .map((node) => String((node.data as { connectionId: string }).connectionId));
  projectStore.getState().setEditorSelection({
    componentIds: componentNodes.map((node) => node.id),
    connectionIds: [...selection.edges.map((edge) => edge.id), ...coreConnectionIds],
  });
}

function connect(connection: ReactFlowConnection) {
  try {
    const decoded = decodeReactFlowConnection(connection);
    let createdConnectionId: string | null = null;
    let issues: ReturnType<typeof createProjectConnection>["issues"] = [];
    projectStore.getState().updateProject((currentProject) => {
      const result = createProjectConnection(
        currentProject,
        decoded.sourcePortId as never,
        decoded.targetPortId as never,
      );
      issues = result.issues;
      if (!result.connection) {
        return currentProject;
      }
      createdConnectionId = result.connection.id;
      return result.project;
    }, "Create connection");
    if (createdConnectionId) {
      projectStore.getState().setSelectedConnections([createdConnectionId]);
      projectStore.getState().setConnectionPreview(null);
      projectStore.getState().setEditorError(null);
      return;
    }
    projectStore.getState().setConnectionPreview({
      sourcePortId: decoded.sourcePortId,
      targetPortId: decoded.targetPortId,
      compatible: false,
      issues,
    });
  } catch (error) {
    projectStore.getState().setEditorError({
      code:
        error instanceof Error && "code" in error
          ? String(error.code)
          : "EDITOR_INVALID_HANDLE",
      message:
        error instanceof Error ? error.message : "Connection could not be created",
    });
  }
}

function previewConnection(
  project: NonNullable<ReturnType<typeof projectStore.getState>["project"]>,
  connection: { sourceHandle?: string | null; targetHandle?: string | null },
) {
  const source = parseHandleId(connection.sourceHandle);
  const target = parseHandleId(connection.targetHandle);
  if (!source || !target || source.mode !== "source" || target.mode !== "target") {
    return false;
  }
  const result = checkPortCompatibility({
    sourcePortId: source.portId,
    targetPortId: target.portId,
    context: project,
  });
  projectStore.getState().setConnectionPreview({
    sourcePortId: source.portId,
    targetPortId: target.portId,
    compatible: result.compatible,
    issues: result.issues,
  });
  return result.compatible;
}
