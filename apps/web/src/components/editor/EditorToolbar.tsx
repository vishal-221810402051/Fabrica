export function EditorToolbar(props: {
  onFit: () => void;
  onReset: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="editor-toolbar" aria-label="Editor tools">
      <button type="button" onClick={props.onFit}>
        Fit
      </button>
      <button type="button" onClick={props.onReset}>
        Reset
      </button>
      <button type="button" onClick={props.onDuplicate}>
        Duplicate
      </button>
      <button type="button" onClick={props.onDelete}>
        Delete
      </button>
    </div>
  );
}
