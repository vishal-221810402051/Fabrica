import type { ProjectStoreState } from "../state/projectStore.types";

export function selectedComponentIds(state: ProjectStoreState) {
  return state.selectedComponentIds;
}

export function selectedConnectionIds(state: ProjectStoreState) {
  return state.selectedConnectionIds;
}

export function activeLayerId(state: ProjectStoreState) {
  return state.activeLayerId;
}

export function activeLaneId(state: ProjectStoreState) {
  return state.activeLaneId;
}

export function hasSingleComponentSelection(state: ProjectStoreState): boolean {
  return state.selectedComponentIds.length === 1;
}
