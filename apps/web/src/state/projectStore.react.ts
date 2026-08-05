import { useStore } from "zustand";

import { projectStore } from "./projectStore";
import type { ProjectStore } from "./projectStore.types";

export function useProjectStore<T>(selector: (state: ProjectStore) => T): T {
  return useStore(projectStore, selector);
}
