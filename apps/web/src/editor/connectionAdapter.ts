import type { Project } from "project-model";

import { editorError } from "./editorErrors";
import { parseHandleId } from "./handleIds";

export function decodeReactFlowConnection(connection: {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): {
  sourcePortId: string;
  targetPortId: string;
} {
  const source = parseHandleId(connection.sourceHandle);
  const target = parseHandleId(connection.targetHandle);
  if (!source || !target || source.mode !== "source" || target.mode !== "target") {
    throw editorError("EDITOR_INVALID_HANDLE", "Connection handles are invalid");
  }
  return {
    sourcePortId: source.portId,
    targetPortId: target.portId,
  };
}

export function hasConnection(
  project: Project,
  sourcePortId: string,
  targetPortId: string,
): boolean {
  return project.connections.some(
    (connection) =>
      (connection.sourcePortId === sourcePortId &&
        connection.targetPortId === targetPortId) ||
      (connection.sourcePortId === targetPortId &&
        connection.targetPortId === sourcePortId),
  );
}
