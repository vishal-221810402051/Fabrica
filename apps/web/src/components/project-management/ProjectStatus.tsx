import {
  canRedo,
  canUndo,
  exportLabel,
  localSaveLabel,
} from "../../state/projectStore.selectors";
import { useProjectStore } from "../../state/projectStore.react";

export function ProjectStatus() {
  const project = useProjectStore((state) => state.project);
  const metadata = useProjectStore((state) => state.metadata);
  const localStatus = useProjectStore(localSaveLabel);
  const exportedStatus = useProjectStore(exportLabel);
  const undoAvailable = useProjectStore(canUndo);
  const redoAvailable = useProjectStore(canRedo);
  const warning = useProjectStore((state) => state.externalRevisionWarning);

  if (!project || !metadata) {
    return (
      <section className="project-status" aria-label="Project status">
        <p>No project open</p>
      </section>
    );
  }

  return (
    <section className="project-status" aria-label="Project status">
      <div>
        <span className="label">Project</span>
        <strong>{project.name}</strong>
      </div>
      <div>
        <span className="label">Schema</span>
        <strong>{project.schemaVersion}</strong>
      </div>
      <div>
        <span className="label">Local save</span>
        <strong>{localStatus}</strong>
      </div>
      <div>
        <span className="label">Export</span>
        <strong>{exportedStatus}</strong>
      </div>
      <div>
        <span className="label">Recovery</span>
        <strong>{metadata.recoveryState}</strong>
      </div>
      <div>
        <span className="label">Undo / Redo</span>
        <strong>
          {undoAvailable ? "Undo available" : "Undo unavailable"} -{" "}
          {redoAvailable ? "Redo available" : "Redo unavailable"}
        </strong>
      </div>
      {warning ? (
        <p className="warning" role="status">
          A newer local revision was saved in another tab.
        </p>
      ) : null}
    </section>
  );
}
