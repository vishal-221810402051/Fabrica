import { useEffect, useRef } from "react";

import {
  deleteSelection,
  duplicateSelectedComponent,
} from "../../editor/editorActions";
import { handleEditorKeyDown } from "../../editor/keyboard";
import { projectStore } from "../../state/projectStore";
import { useProjectStore } from "../../state/projectStore.react";
import { ComponentPalette } from "./ComponentPalette";
import { ConnectionFeedback } from "./ConnectionFeedback";
import { EditorCanvas } from "./EditorCanvas";
import { EditorToolbar } from "./EditorToolbar";
import { LayerLaneControls } from "./LayerLaneControls";
import { PropertiesPanel } from "./PropertiesPanel";

export function EditorShell() {
  const project = useProjectStore((state) => state.project);
  const selectedComponentIds = useProjectStore((state) => state.selectedComponentIds);
  const selectedConnectionIds = useProjectStore((state) => state.selectedConnectionIds);
  const fitRef = useRef<() => void>(() => undefined);
  const resetRef = useRef<() => void>(() => undefined);

  const deleteCurrentSelection = () => {
    const state = projectStore.getState();
    if (!state.project) {
      return;
    }
    const nextProject = deleteSelection(state.project, {
      componentIds: state.selectedComponentIds as never,
      connectionIds: state.selectedConnectionIds as never,
    });
    state.updateProject(() => nextProject, "Delete editor selection");
    state.clearEditorSelection();
  };

  const duplicateCurrentSelection = () => {
    const state = projectStore.getState();
    if (!state.project || state.selectedComponentIds.length !== 1) {
      return;
    }
    try {
      const result = duplicateSelectedComponent(
        state.project,
        state.selectedComponentIds[0] as never,
      );
      state.updateProject(() => result.project, "Duplicate component");
      state.setSelectedComponents([result.duplicatedComponentId]);
    } catch (error) {
      state.setEditorError({
        code:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "EDITOR_DUPLICATION_FAILED",
        message:
          error instanceof Error ? error.message : "Component could not be duplicated",
      });
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) =>
      handleEditorKeyDown(event, {
        undo: () => projectStore.getState().undo(),
        redo: () => projectStore.getState().redo(),
        deleteSelection: deleteCurrentSelection,
        duplicateSelection: duplicateCurrentSelection,
        selectAllComponents: () =>
          projectStore
            .getState()
            .setSelectedComponents(
              projectStore
                .getState()
                .project?.components.map((component) => component.id) ?? [],
            ),
        clearSelection: () => projectStore.getState().clearEditorSelection(),
      });
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  return (
    <section className="editor-shell" aria-labelledby="editor-title">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">Phase 5 visual editor</p>
          <h1 id="editor-title">Microfluidic design editor</h1>
        </div>
        <LayerLaneControls />
      </div>
      <div className="editor-grid-layout">
        <ComponentPalette />
        <section className="editor-workspace" aria-label="Editor canvas and status">
          <EditorToolbar
            onFit={() => fitRef.current()}
            onReset={() => resetRef.current()}
            onDuplicate={duplicateCurrentSelection}
            onDelete={deleteCurrentSelection}
          />
          <ConnectionFeedback />
          <EditorCanvas
            onFitReady={(fit) => {
              fitRef.current = fit;
            }}
            onResetReady={(reset) => {
              resetRef.current = reset;
            }}
          />
          <p className="muted">
            {project?.components.length ?? 0} components,{" "}
            {project?.connections.length ?? 0} connections. Selected:{" "}
            {selectedComponentIds.length + selectedConnectionIds.length}
          </p>
        </section>
        <PropertiesPanel />
      </div>
    </section>
  );
}
