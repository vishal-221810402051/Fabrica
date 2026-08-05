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
  });
}
