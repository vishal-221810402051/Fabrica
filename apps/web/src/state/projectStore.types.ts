import type { Project } from "project-model";
import type { ComponentCategory } from "microfluidic-components";

import type {
  ConnectionPreviewState,
  EditorStructuredError,
  Point,
} from "../editor/editor.types";
import type { ProjectHistory } from "../history/projectHistory.types";
import type {
  AutosaveState,
  ProjectRecordMetadata,
  RecentProjectSummary,
  RecoveryState,
} from "../projects/projectRecord";

export type ProjectDialog =
  "none" | "import" | "recent-projects" | "delete-confirmation";

export interface ProjectOperationError {
  code: string;
  message: string;
}

export interface ExternalRevisionWarning {
  localProjectId: string;
  revision: number;
  savedAt: string;
}

export interface ProjectStoreState {
  project: Project | null;
  metadata: ProjectRecordMetadata | null;
  recentProjects: RecentProjectSummary[];
  selectedEntityIds: string[];
  activeView: "project-management";
  dialog: ProjectDialog;
  error: ProjectOperationError | null;
  importStatus: "idle" | "working" | "success" | "failed";
  exportStatus: "idle" | "success" | "failed";
  localSaveStatus: "idle" | "saving" | "saved" | "failed";
  externalRevisionWarning: ExternalRevisionWarning | null;
  history: ProjectHistory;
  selectedComponentIds: string[];
  selectedConnectionIds: string[];
  activeLayerId: string | null;
  activeLaneId: string | null;
  paletteCategory: ComponentCategory | "all";
  paletteSearch: string;
  dragPreviewPositions: Record<string, Point>;
  connectionPreview: ConnectionPreviewState | null;
  editorError: EditorStructuredError | null;
}

export interface ProjectStoreActions {
  createNewProject: () => void;
  openProjectRecord: (record: {
    project: Project;
    metadata: ProjectRecordMetadata;
  }) => void;
  replaceProject: (
    project: Project,
    metadata: ProjectRecordMetadata,
    options?: { resetHistory?: boolean },
  ) => void;
  updateProject: (updater: (project: Project) => Project, label: string) => void;
  beginTransaction: (label: string) => void;
  commitTransaction: (updater: (project: Project) => Project, label: string) => void;
  cancelTransaction: () => void;
  undo: () => void;
  redo: () => void;
  markSavedLocally: (revision: number, savedAt?: string) => void;
  markExported: (exportedAt?: string) => void;
  setAutosaveState: (state: AutosaveState, revision?: number) => void;
  setRecoveryState: (state: RecoveryState) => void;
  setSelection: (selectedEntityIds: string[]) => void;
  setDialog: (dialog: ProjectDialog) => void;
  setError: (error: ProjectOperationError | null) => void;
  clearError: () => void;
  setRecentProjects: (projects: RecentProjectSummary[]) => void;
  setExternalRevisionWarning: (warning: ExternalRevisionWarning | null) => void;
  setSelectedComponents: (componentIds: string[]) => void;
  setSelectedConnections: (connectionIds: string[]) => void;
  setEditorSelection: (selection: {
    componentIds?: string[];
    connectionIds?: string[];
  }) => void;
  clearEditorSelection: () => void;
  setActiveLayerId: (layerId: string | null) => void;
  setActiveLaneId: (laneId: string | null) => void;
  setPaletteFilter: (filter: {
    category?: ComponentCategory | "all";
    search?: string;
  }) => void;
  setDragPreviewPositions: (positions: Record<string, Point>) => void;
  clearDragPreviewPositions: () => void;
  setConnectionPreview: (preview: ConnectionPreviewState | null) => void;
  setEditorError: (error: EditorStructuredError | null) => void;
  reconcileEditorState: () => void;
}

export type ProjectStore = ProjectStoreState & ProjectStoreActions;
