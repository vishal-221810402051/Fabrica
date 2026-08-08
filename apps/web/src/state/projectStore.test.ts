import { describe, expect, it } from "vitest";

import { createProjectStore } from "./projectStore";
import {
  canRedo,
  canUndo,
  hasChangesSinceExport,
  isLocallyDirty,
  isLocallySaved,
} from "./projectStore.selectors";

describe("project store", () => {
  it("creates, updates, saves, exports, and separates UI selection", () => {
    const store = createProjectStore();
    store.getState().createNewProject();
    const initial = store.getState();

    expect(initial.project?.schemaVersion).toBe("0.2.0");
    expect(isLocallySaved(initial)).toBe(false);

    store.getState().setSelection(["component_one"]);
    expect(isLocallyDirty(store.getState())).toBe(false);

    store.getState().updateProject(
      (project) => ({
        ...project,
        name: "Renamed",
        updatedAt: "2026-08-05T00:00:01.000Z",
      }),
      "Rename",
    );
    expect(store.getState().project?.name).toBe("Renamed");
    expect(isLocallyDirty(store.getState())).toBe(true);
    expect(canUndo(store.getState())).toBe(true);

    const revision = store.getState().metadata?.revision ?? -1;
    store.getState().markSavedLocally(revision, "2026-08-05T00:00:02.000Z");
    expect(isLocallySaved(store.getState())).toBe(true);

    store.getState().updateProject(
      (project) => ({
        ...project,
        name: "Newer than stale save",
        updatedAt: "2026-08-05T00:00:04.000Z",
      }),
      "Rename",
    );
    const currentRevision = store.getState().metadata?.revision ?? -1;
    store.getState().markSavedLocally(currentRevision - 1, "2026-08-05T00:00:05.000Z");
    expect(store.getState().metadata?.savedRevision).toBe(revision);

    store.getState().markSavedLocally(currentRevision + 1, "2026-08-05T00:00:06.000Z");
    expect(store.getState().metadata?.savedRevision).toBe(revision);

    store.getState().markExported("2026-08-05T00:00:03.000Z");
    expect(hasChangesSinceExport(store.getState())).toBe(false);
  });

  it("rejects invalid project updates and supports undo/redo", () => {
    const store = createProjectStore();
    store.getState().createNewProject();
    expect(() =>
      store
        .getState()
        .updateProject(
          (project) => ({ ...project, schemaVersion: "9.0.0" }) as never,
          "Invalid",
        ),
    ).toThrow();

    store.getState().updateProject(
      (project) => ({
        ...project,
        name: "Changed",
        updatedAt: "2026-08-05T00:00:01.000Z",
      }),
      "Rename",
    );
    store.getState().undo();
    expect(store.getState().project?.name).toBe("Untitled Project");
    expect(canRedo(store.getState())).toBe(true);
    store.getState().redo();
    expect(store.getState().project?.name).toBe("Changed");
  });

  it("groups multiple transaction mutations into one history entry and can cancel", () => {
    const store = createProjectStore();
    store.getState().createNewProject();

    store.getState().beginTransaction("Batch rename");
    store.getState().updateProject(
      (project) => ({
        ...project,
        name: "First",
        updatedAt: "2026-08-05T00:00:01.000Z",
      }),
      "First",
    );
    store.getState().updateProject(
      (project) => ({
        ...project,
        name: "Second",
        updatedAt: "2026-08-05T00:00:02.000Z",
      }),
      "Second",
    );
    expect(store.getState().history.past).toHaveLength(0);

    store.getState().commitTransaction((project) => project, "Commit");
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().history.past[0]?.label).toBe("Batch rename");

    store.getState().beginTransaction("Cancel");
    store.getState().updateProject(
      (project) => ({
        ...project,
        name: "Cancelled",
        updatedAt: "2026-08-05T00:00:03.000Z",
      }),
      "Cancel",
    );
    store.getState().cancelTransaction();
    expect(store.getState().project?.name).toBe("Second");
  });

  it("ignores stale autosave status updates from older revisions", () => {
    const store = createProjectStore();
    store.getState().createNewProject();
    store.getState().updateProject(
      (project) => ({
        ...project,
        name: "Current",
        updatedAt: "2026-08-05T00:00:01.000Z",
      }),
      "Rename",
    );

    store.getState().setAutosaveState("failed", 0);

    expect(store.getState().metadata?.autosaveState).toBe("pending");
  });
});
