import { useProjectStore } from "../../state/projectStore.react";

export function ConnectionFeedback() {
  const preview = useProjectStore((state) => state.connectionPreview);
  const error = useProjectStore((state) => state.editorError);
  if (!preview && !error) {
    return <p className="muted">Connections are checked locally before creation.</p>;
  }
  if (error) {
    return (
      <div className="editor-feedback editor-feedback-error" role="status">
        <strong>{error.message}</strong>
        {error.details?.length ? <p>{error.details.join(", ")}</p> : null}
      </div>
    );
  }
  return (
    <div
      className={
        preview?.compatible
          ? "editor-feedback editor-feedback-ok"
          : "editor-feedback editor-feedback-error"
      }
      role="status"
    >
      <strong>
        {preview?.compatible ? "Compatible connection" : "Connection blocked"}
      </strong>
      {preview?.issues?.length ? (
        <p>{preview.issues.map((issue) => issue.code).join(", ")}</p>
      ) : null}
    </div>
  );
}
