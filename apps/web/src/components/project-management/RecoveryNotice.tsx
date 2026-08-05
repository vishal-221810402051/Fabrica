import { useProjectStore } from "../../state/projectStore.react";

export function RecoveryNotice() {
  const metadata = useProjectStore((state) => state.metadata);
  const error = useProjectStore((state) => state.error);

  return (
    <>
      {metadata?.recoveryState === "recovered" ? (
        <p className="notice" role="status">
          Recovered local draft
        </p>
      ) : null}
      {metadata?.autosaveState === "failed" ? (
        <p className="error" role="alert">
          Autosave failed. The in-memory project is still open.
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error.message}
        </p>
      ) : null}
    </>
  );
}
