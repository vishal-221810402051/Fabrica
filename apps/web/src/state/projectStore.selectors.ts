import type { ProjectStoreState } from "./projectStore.types";

export function isLocallyDirty(state: ProjectStoreState): boolean {
  return Boolean(
    state.metadata &&
    state.project &&
    state.metadata.revision !== state.metadata.savedRevision,
  );
}

export function isLocallySaved(state: ProjectStoreState): boolean {
  return Boolean(
    state.metadata &&
    state.metadata.locallySavedAt &&
    state.metadata.revision === state.metadata.savedRevision,
  );
}

export function hasEverBeenExported(state: ProjectStoreState): boolean {
  return Boolean(state.metadata?.lastExportedAt);
}

export function hasChangesSinceExport(state: ProjectStoreState): boolean {
  if (!state.metadata?.lastExportedAt || state.metadata.lastExportedRevision === null) {
    return Boolean(state.project);
  }
  return state.metadata.revision !== state.metadata.lastExportedRevision;
}

export function canUndo(state: ProjectStoreState): boolean {
  return state.history.past.length > 0;
}

export function canRedo(state: ProjectStoreState): boolean {
  return state.history.future.length > 0;
}

export function localSaveLabel(state: ProjectStoreState): string {
  if (!state.project || !state.metadata) {
    return "No project open";
  }
  if (state.metadata.autosaveState === "saving" || state.localSaveStatus === "saving") {
    return "Saving locally";
  }
  if (state.metadata.autosaveState === "failed" || state.localSaveStatus === "failed") {
    return "Local save failed";
  }
  if (isLocallySaved(state)) {
    return "Saved locally";
  }
  if (isLocallyDirty(state)) {
    return "Unsaved local changes";
  }
  return "Unsaved locally";
}

export function exportLabel(state: ProjectStoreState): string {
  if (!state.project) {
    return "Not exported";
  }
  if (!hasEverBeenExported(state)) {
    return "Not exported";
  }
  return hasChangesSinceExport(state) ? "Changes since export" : "Exported";
}
