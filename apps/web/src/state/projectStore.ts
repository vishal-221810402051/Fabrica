import { createStore } from "zustand/vanilla";
import * as projectModel from "project-model";

import {
  beginProjectTransaction,
  cancelProjectTransaction,
  commitProjectChange,
  createProjectHistory,
  redoProjectChange,
  resetProjectHistory,
  undoProjectChange,
} from "../history/projectHistory";
import { createProject } from "../projects/createProject";
import {
  createProjectRecord,
  nowIso,
  recordMetadata,
  type ProjectRecordMetadata,
} from "../projects/projectRecord";
import type { ProjectStore } from "./projectStore.types";

export function createProjectStore() {
  return createStore<ProjectStore>((set, get) => ({
    project: null,
    metadata: null,
    recentProjects: [],
    selectedEntityIds: [],
    activeView: "project-management",
    dialog: "none",
    error: null,
    importStatus: "idle",
    exportStatus: "idle",
    localSaveStatus: "idle",
    externalRevisionWarning: null,
    history: createProjectHistory(),
    selectedComponentIds: [],
    selectedConnectionIds: [],
    inspectorScope: "selection" as const,
    activeLayerId: null,
    activeLaneId: null,
    paletteCategory: "all",
    paletteSearch: "",
    dragPreviewPositions: {},
    connectionPreview: null,
    editorError: null,

    createNewProject: () => {
      const project = createProject();
      const record = createProjectRecord(project, "new");
      set({
        project,
        metadata: recordMetadata(record),
        selectedEntityIds: [],
        dialog: "none",
        error: null,
        exportStatus: "idle",
        localSaveStatus: "idle",
        externalRevisionWarning: null,
        history: createProjectHistory(),
        ...initialEditorState(project),
      });
    },

    openProjectRecord: (record) => {
      get().replaceProject(record.project, record.metadata, { resetHistory: true });
    },

    replaceProject: (project, metadata, options) => {
      set({
        project: projectModel.parseProject(project),
        metadata,
        selectedEntityIds: [],
        dialog: "none",
        error: null,
        externalRevisionWarning: null,
        history:
          options?.resetHistory === false ? get().history : createProjectHistory(),
        ...initialEditorState(projectModel.parseProject(project)),
      });
    },

    updateProject: (updater, label) => {
      const state = get();
      if (!state.project || !state.metadata) {
        return;
      }
      const nextProject = projectModel.parseProject(
        updater(structuredClone(state.project)),
      );
      if (state.history.transaction) {
        if (
          projectModel.stringifyProject(state.project) ===
          projectModel.stringifyProject(nextProject)
        ) {
          return;
        }
        set({ project: nextProject });
        return;
      }
      const result = commitProjectChange(
        state.history,
        state.project,
        nextProject,
        label,
      );
      if (!result.changed) {
        return;
      }
      set({
        project: result.project,
        metadata: nextDirtyMetadata(state.metadata),
        history: result.history,
      });
      get().reconcileEditorState();
    },

    beginTransaction: (label) => {
      const state = get();
      if (!state.project) {
        return;
      }
      set({ history: beginProjectTransaction(state.history, state.project, label) });
    },

    commitTransaction: (updater, label) => {
      const state = get();
      if (!state.project || !state.metadata || !state.history.transaction) {
        get().updateProject(updater, label);
        return;
      }
      const nextProject = projectModel.parseProject(
        updater(structuredClone(state.project)),
      );
      const result = commitProjectChange(
        state.history,
        state.history.transaction.baseProject,
        nextProject,
        label,
      );
      if (!result.changed) {
        set({ history: result.history });
        return;
      }
      set({
        project: result.project,
        metadata: nextDirtyMetadata(state.metadata),
        history: result.history,
      });
      get().reconcileEditorState();
    },

    cancelTransaction: () => {
      const state = get();
      set({
        project: state.history.transaction?.baseProject ?? state.project,
        history: cancelProjectTransaction(state.history),
      });
    },

    undo: () => {
      const state = get();
      if (!state.project || !state.metadata) {
        return;
      }
      const result = undoProjectChange(state.history, state.project);
      if (!result.changed) {
        return;
      }
      set({
        project: result.project,
        metadata: nextDirtyMetadata(state.metadata),
        history: result.history,
      });
      get().reconcileEditorState();
    },

    redo: () => {
      const state = get();
      if (!state.project || !state.metadata) {
        return;
      }
      const result = redoProjectChange(state.history, state.project);
      if (!result.changed) {
        return;
      }
      set({
        project: result.project,
        metadata: nextDirtyMetadata(state.metadata),
        history: result.history,
      });
      get().reconcileEditorState();
    },

    markSavedLocally: (revision, savedAt = nowIso()) => {
      const metadata = get().metadata;
      if (!metadata || revision !== metadata.revision) {
        return;
      }
      set({
        metadata: {
          ...metadata,
          savedRevision: revision,
          locallySavedAt: savedAt,
          autosaveState: "clean",
        },
        localSaveStatus: "saved",
      });
    },

    markExported: (exportedAt = nowIso()) => {
      const metadata = get().metadata;
      if (!metadata) {
        return;
      }
      set({
        metadata: {
          ...metadata,
          lastExportedAt: exportedAt,
          lastExportedRevision: metadata.revision,
        },
        exportStatus: "success",
      });
    },

    setAutosaveState: (autosaveState, revision) => {
      const metadata = get().metadata;
      if (!metadata) {
        return;
      }
      if (revision !== undefined && revision < metadata.revision) {
        return;
      }
      set({ metadata: { ...metadata, autosaveState } });
    },

    setRecoveryState: (recoveryState) => {
      const metadata = get().metadata;
      if (metadata) {
        set({ metadata: { ...metadata, recoveryState } });
      }
    },

    setSelection: (selectedEntityIds) => set({ selectedEntityIds }),
    setDialog: (dialog) => set({ dialog }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
    setRecentProjects: (projects) => set({ recentProjects: projects }),
    setExternalRevisionWarning: (warning) => set({ externalRevisionWarning: warning }),
    setSelectedComponents: (componentIds) => {
      const next = unique(componentIds);
      const state = get();
      if (
        sameStrings(state.selectedComponentIds, next) &&
        state.selectedConnectionIds.length === 0 &&
        state.inspectorScope === "selection"
      ) {
        return;
      }
      set({
        selectedComponentIds: next,
        selectedConnectionIds: [],
        inspectorScope: "selection" as const,
      });
    },
    setSelectedConnections: (connectionIds) => {
      const next = unique(connectionIds);
      if (next.length === 1) {
        get().selectConnectionForInspection(next[0]!);
        return;
      }
      const state = get();
      if (
        sameStrings(state.selectedConnectionIds, next) &&
        state.selectedComponentIds.length === 0 &&
        state.inspectorScope === "selection"
      ) {
        return;
      }
      set({
        selectedConnectionIds: next,
        selectedComponentIds: [],
        inspectorScope: "selection" as const,
      });
    },
    selectConnectionForInspection: (connectionId) => {
      const state = get();
      if (
        sameStrings(state.selectedConnectionIds, [connectionId]) &&
        state.selectedComponentIds.length === 0 &&
        state.inspectorScope === "selection"
      ) {
        return;
      }
      set({
        selectedConnectionIds: [connectionId],
        selectedComponentIds: [],
        inspectorScope: "selection" as const,
      });
    },
    setInspectorScope: (scope) => {
      if (get().inspectorScope === scope) {
        return;
      }
      set({ inspectorScope: scope });
    },
    setEditorSelection: (selection) => {
      const nextConnections = unique(selection.connectionIds ?? []);
      const nextComponents =
        nextConnections.length === 1 ? [] : unique(selection.componentIds ?? []);
      const state = get();
      const nextInspectorScope =
        nextComponents.length > 0 || nextConnections.length > 0
          ? "selection"
          : state.inspectorScope;
      if (
        sameStrings(state.selectedComponentIds, nextComponents) &&
        sameStrings(state.selectedConnectionIds, nextConnections) &&
        state.inspectorScope === nextInspectorScope
      ) {
        return;
      }
      set({
        selectedComponentIds: nextComponents,
        selectedConnectionIds: nextConnections,
        inspectorScope: nextInspectorScope,
      });
    },
    clearEditorSelection: () => {
      const state = get();
      if (
        state.selectedComponentIds.length === 0 &&
        state.selectedConnectionIds.length === 0 &&
        state.inspectorScope === "selection" &&
        state.connectionPreview === null &&
        state.editorError === null
      ) {
        return;
      }
      set({
        selectedComponentIds: [],
        selectedConnectionIds: [],
        inspectorScope: "selection" as const,
        connectionPreview: null,
        editorError: null,
      });
    },
    setActiveLayerId: (layerId) => set({ activeLayerId: layerId }),
    setActiveLaneId: (laneId) => set({ activeLaneId: laneId }),
    setPaletteFilter: (filter) =>
      set((state) => ({
        paletteCategory: filter.category ?? state.paletteCategory,
        paletteSearch: filter.search ?? state.paletteSearch,
      })),
    setDragPreviewPositions: (positions) => set({ dragPreviewPositions: positions }),
    clearDragPreviewPositions: () => {
      if (isEmptyRecord(get().dragPreviewPositions)) {
        return;
      }
      set({ dragPreviewPositions: {} });
    },
    setConnectionPreview: (preview) => set({ connectionPreview: preview }),
    setEditorError: (error) => set({ editorError: error }),
    reconcileEditorState: () => {
      const state = get();
      if (!state.project) {
        set(initialEditorState(null));
        return;
      }
      const componentIds = new Set(state.project.components.map((item) => item.id));
      const connectionIds = new Set(state.project.connections.map((item) => item.id));
      const layerIds = new Set(state.project.layers.map((item) => item.id));
      const laneIds = new Set(state.project.lanes.map((item) => item.id));
      const nextSelectedComponentIds = state.selectedComponentIds.filter((id) =>
        componentIds.has(id),
      );
      const nextSelectedConnectionIds = state.selectedConnectionIds.filter((id) =>
        connectionIds.has(id),
      );
      const nextActiveLayerId = layerIds.has(state.activeLayerId ?? "")
        ? state.activeLayerId
        : (state.project.layers[0]?.id ?? null);
      const nextActiveLaneId = laneIds.has(state.activeLaneId ?? "")
        ? state.activeLaneId
        : null;
      const shouldClearDragPreview = !isEmptyRecord(state.dragPreviewPositions);
      const shouldClearConnectionPreview = state.connectionPreview !== null;
      if (
        sameStrings(state.selectedComponentIds, nextSelectedComponentIds) &&
        sameStrings(state.selectedConnectionIds, nextSelectedConnectionIds) &&
        state.activeLayerId === nextActiveLayerId &&
        state.activeLaneId === nextActiveLaneId &&
        !shouldClearDragPreview &&
        !shouldClearConnectionPreview
      ) {
        return;
      }
      set({
        selectedComponentIds: nextSelectedComponentIds,
        selectedConnectionIds: nextSelectedConnectionIds,
        activeLayerId: nextActiveLayerId,
        activeLaneId: nextActiveLaneId,
        ...(shouldClearDragPreview ? { dragPreviewPositions: {} } : {}),
        ...(shouldClearConnectionPreview ? { connectionPreview: null } : {}),
      });
    },
  }));
}

export const projectStore = createProjectStore();

function nextDirtyMetadata(metadata: ProjectRecordMetadata): ProjectRecordMetadata {
  return {
    ...metadata,
    revision: metadata.revision + 1,
    autosaveState: "pending",
  };
}

export function resetProjectStoreForTests(): void {
  projectStore.setState({
    project: null,
    metadata: null,
    recentProjects: [],
    selectedEntityIds: [],
    activeView: "project-management",
    dialog: "none",
    error: null,
    importStatus: "idle",
    exportStatus: "idle",
    localSaveStatus: "idle",
    externalRevisionWarning: null,
    history: resetProjectHistory(createProjectHistory()),
    selectedComponentIds: [],
    selectedConnectionIds: [],
    inspectorScope: "selection" as const,
    activeLayerId: null,
    activeLaneId: null,
    paletteCategory: "all",
    paletteSearch: "",
    dragPreviewPositions: {},
    connectionPreview: null,
    editorError: null,
  });
}

function initialEditorState(project: projectModel.Project | null) {
  return {
    selectedComponentIds: [],
    selectedConnectionIds: [],
    inspectorScope: "selection" as const,
    activeLayerId: project?.layers[0]?.id ?? null,
    activeLaneId: null,
    dragPreviewPositions: {},
    connectionPreview: null,
    editorError: null,
  };
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length && left.every((value, index) => value === right[index])
  );
}

function isEmptyRecord(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0;
}
