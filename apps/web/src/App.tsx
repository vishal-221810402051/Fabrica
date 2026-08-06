import { useEffect, useMemo, useState } from "react";

import { createAutosaveController } from "./autosave/autosaveController";
import { EditorShell } from "./components/editor/EditorShell";
import { ProjectStatus } from "./components/project-management/ProjectStatus";
import { ProjectToolbar } from "./components/project-management/ProjectToolbar";
import { RecentProjects } from "./components/project-management/RecentProjects";
import { RecoveryNotice } from "./components/project-management/RecoveryNotice";
import { checkServiceHealth, type ServiceStatus } from "./health";
import { downloadProjectExport } from "./import-export/projectExport";
import { importProjectFile } from "./import-export/projectImport";
import { duplicateProject } from "./projects/duplicateProject";
import {
  createProjectRecord,
  maybeRecordFromState,
  recordMetadata,
  nowIso,
  recentProjectSummary,
} from "./projects/projectRecord";
import {
  deleteProjectRecord,
  duplicateProjectRecord,
  listProjectRecords,
  loadMostRecentValidProject,
  loadProjectRecord,
  markProjectOpened,
  saveProjectRecord,
} from "./persistence/projectStorage";
import { canRedo, canUndo } from "./state/projectStore.selectors";
import { projectStore } from "./state/projectStore";
import { useProjectStore } from "./state/projectStore.react";
import { createProjectChannel } from "./synchronization/projectChannel";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const cadBaseUrl = import.meta.env.VITE_CAD_BASE_URL ?? "http://127.0.0.1:8001";

const initialStatuses: ServiceStatus[] = [
  { name: "API", baseUrl: apiBaseUrl, state: "checking" },
  { name: "CAD service", baseUrl: cadBaseUrl, state: "checking" },
];

export function App() {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(initialStatuses);
  const project = useProjectStore((state) => state.project);
  const metadata = useProjectStore((state) => state.metadata);
  const recentProjects = useProjectStore((state) => state.recentProjects);
  const dialog = useProjectStore((state) => state.dialog);
  const undoAvailable = useProjectStore(canUndo);
  const redoAvailable = useProjectStore(canRedo);
  const hasProject = useProjectStore((state) => Boolean(state.project));
  const hasExternalWarning = useProjectStore((state) =>
    Boolean(state.externalRevisionWarning),
  );
  const channel = useMemo(
    () =>
      createProjectChannel((message) => {
        const state = projectStore.getState();
        if (
          state.metadata?.localProjectId === message.localProjectId &&
          message.revision > state.metadata.revision
        ) {
          state.setExternalRevisionWarning({
            localProjectId: message.localProjectId,
            revision: message.revision,
            savedAt: message.savedAt,
          });
        }
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function refreshHealth() {
      const results = await Promise.all([
        checkServiceHealth("API", apiBaseUrl),
        checkServiceHealth("CAD service", cadBaseUrl),
      ]);

      if (!cancelled) {
        setStatuses(results);
      }
    }

    void refreshHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function openInitialProject() {
      try {
        const record = await loadMostRecentValidProject();
        const records = await listProjectRecords();
        if (cancelled) {
          return;
        }

        projectStore
          .getState()
          .setRecentProjects(records.map(recentProjectSummary).slice(0, 20));
        if (record) {
          const opened = await markProjectOpened(record.localProjectId);
          if (!cancelled) {
            projectStore.getState().openProjectRecord({
              project: opened.project,
              metadata: recordMetadata(opened),
            });
          }
        } else {
          projectStore.getState().createNewProject();
        }
      } catch (error) {
        projectStore.getState().setError({
          code: "startup-failed",
          message:
            error instanceof Error
              ? error.message
              : "Local project storage could not be initialized",
        });
        projectStore.getState().createNewProject();
      }
    }

    void openInitialProject();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    channel.open();
    const controller = createAutosaveController({
      getRecord: () => maybeRecordFromState(projectStore.getState()),
      saveRecord: saveProjectRecord,
      onStatusChange: (status, revision) =>
        projectStore.getState().setAutosaveState(status, revision),
      onSaved: (record) => {
        projectStore
          .getState()
          .markSavedLocally(record.revision, record.locallySavedAt ?? undefined);
        channel.publish({
          localProjectId: record.localProjectId,
          revision: record.revision,
          savedAt: record.locallySavedAt ?? new Date().toISOString(),
          operation: "saved",
        });
      },
    });

    let previousRevision = projectStore.getState().metadata?.revision ?? null;
    const unsubscribe = projectStore.subscribe((state) => {
      const nextRevision = state.metadata?.revision ?? null;
      const shouldSchedule =
        state.project &&
        state.metadata &&
        previousRevision !== null &&
        nextRevision !== null &&
        nextRevision !== previousRevision;
      previousRevision = nextRevision;

      if (shouldSchedule) {
        controller.schedule();
      }
    });

    return () => {
      unsubscribe();
      controller.cleanup();
      channel.close();
    };
  }, [channel]);

  async function refreshRecentProjects() {
    const records = await listProjectRecords();
    projectStore
      .getState()
      .setRecentProjects(records.map(recentProjectSummary).slice(0, 20));
  }

  async function saveCurrentProject() {
    const record = maybeRecordFromState(projectStore.getState());
    if (!record) {
      return;
    }
    try {
      projectStore.setState({ localSaveStatus: "saving" });
      const savedAt = new Date().toISOString();
      const saved = await saveProjectRecord({
        ...record,
        savedRevision: record.revision,
        locallySavedAt: savedAt,
        autosaveState: "clean",
      });
      projectStore.getState().markSavedLocally(saved.revision, savedAt);
      channel.publish({
        localProjectId: saved.localProjectId,
        revision: saved.revision,
        savedAt,
        operation: "saved",
      });
      await refreshRecentProjects();
    } catch (error) {
      projectStore.setState({ localSaveStatus: "failed" });
      projectStore.getState().setError({
        code: "save-failed",
        message: error instanceof Error ? error.message : "Local save failed",
      });
    }
  }

  async function openRecord(localProjectId: string) {
    try {
      const record = await markProjectOpened(localProjectId);
      projectStore.getState().openProjectRecord({
        project: record.project,
        metadata: recordMetadata(record),
      });
      await refreshRecentProjects();
    } catch (error) {
      projectStore.getState().setError({
        code: "open-failed",
        message: error instanceof Error ? error.message : "Project could not be opened",
      });
    }
  }

  async function duplicateCurrentProject() {
    if (!project) {
      return;
    }
    const duplicated = duplicateProject(project);
    const record = createProjectRecord(duplicated, "duplicated");
    projectStore.getState().replaceProject(duplicated, recordMetadata(record));
  }

  async function duplicateStoredProject(localProjectId: string) {
    try {
      const record = await duplicateProjectRecord(localProjectId);
      projectStore.getState().openProjectRecord({
        project: record.project,
        metadata: recordMetadata(record),
      });
      await refreshRecentProjects();
    } catch (error) {
      projectStore.getState().setError({
        code: "duplicate-failed",
        message:
          error instanceof Error ? error.message : "Project could not be duplicated",
      });
    }
  }

  async function importProject(file: File) {
    try {
      projectStore.setState({ importStatus: "working" });
      const record = await importProjectFile(file);
      const savedAt = nowIso();
      const saved = await saveProjectRecord({
        ...record,
        savedRevision: record.revision,
        locallySavedAt: savedAt,
        autosaveState: "clean",
      });
      projectStore.getState().openProjectRecord({
        project: saved.project,
        metadata: recordMetadata(saved),
      });
      projectStore.setState({ importStatus: "success" });
      await refreshRecentProjects();
    } catch (error) {
      projectStore.setState({ importStatus: "failed" });
      projectStore.getState().setError({
        code: "import-failed",
        message: error instanceof Error ? error.message : "Project import failed",
      });
    }
  }

  function exportProject() {
    if (!project) {
      return;
    }
    try {
      downloadProjectExport(project);
      projectStore.getState().markExported();
    } catch (error) {
      projectStore.setState({ exportStatus: "failed" });
      projectStore.getState().setError({
        code: "export-failed",
        message: error instanceof Error ? error.message : "Project export failed",
      });
    }
  }

  async function deleteCurrentProject() {
    if (!metadata) {
      return;
    }
    const deleted = await deleteRecord(metadata.localProjectId);
    if (deleted) {
      projectStore.getState().createNewProject();
    }
  }

  async function deleteRecord(localProjectId: string): Promise<boolean> {
    if (
      !window.confirm(
        "Delete this local project record? Exported files are not changed.",
      )
    ) {
      return false;
    }
    try {
      await deleteProjectRecord(localProjectId);
      channel.publish({
        localProjectId,
        revision: Number.MAX_SAFE_INTEGER,
        savedAt: new Date().toISOString(),
        operation: "deleted",
      });
      await refreshRecentProjects();
      return true;
    } catch (error) {
      projectStore.getState().setError({
        code: "delete-failed",
        message:
          error instanceof Error ? error.message : "Project could not be deleted",
      });
      return false;
    }
  }

  async function reloadExternalRevision() {
    const warning = projectStore.getState().externalRevisionWarning;
    if (!warning) {
      return;
    }
    try {
      const record = await loadProjectRecord(warning.localProjectId);
      projectStore.getState().openProjectRecord({
        project: record.project,
        metadata: recordMetadata(record),
      });
    } catch (error) {
      projectStore.getState().setError({
        code: "reload-failed",
        message:
          error instanceof Error
            ? error.message
            : "External local revision could not be loaded",
      });
    }
  }

  return (
    <main className="app-shell">
      <section className="project-panel" aria-labelledby="project-title">
        <p className="eyebrow">Phase 3 local project management</p>
        <h1 id="project-title">Fabricgamma project state</h1>
        <p className="summary">
          Browser-local persistence, import/export, autosave, recovery, and undo/redo
          are active for the Phase 2 project model.
        </p>
        <ProjectToolbar
          hasProject={hasProject}
          canUndo={undoAvailable}
          canRedo={redoAvailable}
          hasExternalWarning={hasExternalWarning}
          onNew={() => projectStore.getState().createNewProject()}
          onSave={() => void saveCurrentProject()}
          onDuplicate={() => void duplicateCurrentProject()}
          onImport={(file) => void importProject(file)}
          onExport={exportProject}
          onUndo={() => projectStore.getState().undo()}
          onRedo={() => projectStore.getState().redo()}
          onOpenRecent={() => projectStore.getState().setDialog("recent-projects")}
          onDelete={() => void deleteCurrentProject()}
          onReloadExternal={() => void reloadExternalRevision()}
        />
        <ProjectStatus />
        <RecoveryNotice />
        {dialog === "recent-projects" ? (
          <RecentProjects
            records={recentProjects}
            onOpen={(id) => void openRecord(id)}
            onDuplicate={(id) => void duplicateStoredProject(id)}
            onDelete={(id) => void deleteRecord(id)}
          />
        ) : null}
      </section>
      <section className="status-panel" aria-labelledby="status-title">
        <p className="eyebrow">Phase 2 foundation</p>
        <h1 id="status-title">Fabricgamma development environment</h1>
        <p className="summary">
          The web foundation is operational. Product design tools, engineering
          calculations, GPT integration, and production CAD remain deferred.
        </p>

        <div className="service-grid" aria-label="Service health">
          {statuses.map((status) => (
            <article className="service-card" key={status.name}>
              <div>
                <h2>{status.name}</h2>
                <p>{status.baseUrl}</p>
              </div>
              <span className={`badge badge-${status.state}`}>{status.state}</span>
            </article>
          ))}
        </div>
      </section>
      <EditorShell />
    </main>
  );
}
