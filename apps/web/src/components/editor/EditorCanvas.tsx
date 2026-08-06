import { useMemo, useRef } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  type Connection as ReactFlowConnection,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { checkPortCompatibility } from "microfluidic-components";

import { createProjectConnection, moveComponents } from "../../editor/editorActions";
import { decodeReactFlowConnection } from "../../editor/connectionAdapter";
import { deriveEditorProjection } from "../../editor/editorProjection";
import { parseHandleId } from "../../editor/handleIds";
import { projectStore } from "../../state/projectStore";
import { useProjectStore } from "../../state/projectStore.react";
import { MicrofluidicNode } from "./MicrofluidicNode";

const nodeTypes = { microfluidic: MicrofluidicNode };

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
        ? projection.nodes.map((node) => ({
            ...node,
            position: dragPreviewPositions[node.id] ?? node.position,
          }))
        : [],
    [projection, dragPreviewPositions],
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
        fitView
        minZoom={0.25}
        maxZoom={2}
        snapToGrid
        snapGrid={[1, 1]}
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
          const movedNodes = selectedNodes.length > 0 ? selectedNodes : [node];
          const positions = Object.fromEntries(
            movedNodes.map((candidate) => [candidate.id, candidate.position]),
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
          projectStore.getState().setSelectedComponents([node.id]);
        }}
        onEdgeClick={(_, edge) => {
          projectStore.getState().setSelectedConnections([edge.id]);
        }}
      >
        <Background gap={1} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function handleSelection(selection: OnSelectionChangeParams) {
  if (selection.nodes.length === 0 && selection.edges.length === 0) {
    return;
  }
  projectStore.getState().setEditorSelection({
    componentIds: selection.nodes.map((node) => node.id),
    connectionIds: selection.edges.map((edge) => edge.id),
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
