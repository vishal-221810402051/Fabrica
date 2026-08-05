import { useRef } from "react";

interface ProjectToolbarProps {
  onNew: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenRecent: () => void;
  onDelete: () => void;
  onReloadExternal: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasProject: boolean;
  hasExternalWarning: boolean;
}

export function ProjectToolbar(props: ProjectToolbarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="project-toolbar" aria-label="Project controls">
      <button type="button" onClick={props.onNew}>
        New project
      </button>
      <button type="button" disabled={!props.hasProject} onClick={props.onSave}>
        Save locally
      </button>
      <button type="button" disabled={!props.hasProject} onClick={props.onDuplicate}>
        Duplicate
      </button>
      <button type="button" onClick={() => inputRef.current?.click()}>
        Import JSON
      </button>
      <button type="button" disabled={!props.hasProject} onClick={props.onExport}>
        Export JSON
      </button>
      <button type="button" disabled={!props.canUndo} onClick={props.onUndo}>
        Undo
      </button>
      <button type="button" disabled={!props.canRedo} onClick={props.onRedo}>
        Redo
      </button>
      <button type="button" onClick={props.onOpenRecent}>
        Recent projects
      </button>
      <button type="button" disabled={!props.hasProject} onClick={props.onDelete}>
        Delete local
      </button>
      <button
        type="button"
        disabled={!props.hasExternalWarning}
        onClick={props.onReloadExternal}
      >
        Reload local revision
      </button>
      <input
        ref={inputRef}
        aria-label="Import project JSON"
        className="visually-hidden"
        type="file"
        accept=".fabricgamma.json,.json,application/json"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) {
            props.onImport(file);
          }
        }}
      />
    </div>
  );
}
