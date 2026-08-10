import type { OnSelectionChangeParams } from "@xyflow/react";

import { projectStore } from "../../state/projectStore";

export function handleReactFlowEditorSelection(
  selection: OnSelectionChangeParams,
): void {
  if (selection.nodes.length === 0 && selection.edges.length === 0) {
    return;
  }
  const componentNodes = selection.nodes.filter((node) => node.type === "microfluidic");
  if (componentNodes.length === 0) {
    return;
  }
  projectStore.getState().setEditorSelection({
    componentIds: componentNodes.map((node) => node.id),
    connectionIds: [],
  });
}
