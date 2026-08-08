import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { insertComponentFromDefinition } from "./editor/editorActions";
import { loadProjectRecord } from "./persistence/projectStorage";
import { projectStore, resetProjectStoreForTests } from "./state/projectStore";

class ThrowingBroadcastChannel {
  readonly name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessages = 0;
  closed = false;

  constructor(name: string) {
    this.name = name;
  }

  postMessage() {
    this.postMessages += 1;
    throw new DOMException("Channel is closed", "InvalidStateError");
  }

  close() {
    this.closed = true;
  }
}

describe("App", () => {
  afterEach(() => {
    resetProjectStoreForTests();
  });

  it("renders the Phase 2 status interface", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Fabricgamma development environment",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Phase 2 foundation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export JSON" })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Save locally" })).toBeEnabled();
  });

  it("handles unavailable services without crashing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("service unavailable")));

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("unreachable")).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });
  });

  it("shows healthy states and uses configured default service URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", version: "0.1.0" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("healthy")).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });

    expect(screen.getByText("http://127.0.0.1:8000")).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:8001")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/health",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/health",
      expect.any(Object),
    );
  });

  it("requires confirmation before deleting the current local project", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });

    act(() => {
      projectStore.getState().updateProject(
        (project) => ({
          ...project,
          name: "Keep me",
          updatedAt: "2026-08-05T00:00:01.000Z",
        }),
        "Rename",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete local" }));

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(screen.getByText("Keep me")).toBeInTheDocument();
  });

  it("renders the Phase 5 editor and adds a component through the palette", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });
    const projectId = projectStore.getState().project?.id;
    const revision = projectStore.getState().metadata?.revision;

    expect(screen.getByText("Microfluidic design editor")).toBeInTheDocument();
    expect(screen.getByText("Component palette")).toBeInTheDocument();
    expect(screen.getByText("Properties")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Rectangular channelchannel.rectangular",
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "control" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Normally closed valvevalve.normally-closed",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(projectStore.getState().project?.id).toBe(projectId);
    expect(projectStore.getState().project?.components).toHaveLength(1);
    expect(projectStore.getState().project?.ports).toHaveLength(3);
    expect(projectStore.getState().metadata?.revision).toBe((revision ?? 0) + 1);
  });

  it("selects an editor component and shows its properties", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Rectangular channelchannel.rectangular",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const node = await screen.findByLabelText(
      "Rectangular channel Rectangular channel",
    );
    fireEvent.click(node);

    expect(projectStore.getState().selectedComponentIds).toHaveLength(1);
    expect(screen.getByLabelText(/X mm/i)).toHaveValue("4");
    expect(screen.getByLabelText(/Y mm/i)).toHaveValue("4");
  });

  it("renders semantic red input and blue output handles with accessible labels", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "routing" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Splitterjunction.splitter",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const input = await screen.findByLabelText(/^Input Input:/);
    const outputA = screen.getByLabelText(/^Output Output A:/);
    const outputB = screen.getByLabelText(/^Output Output B:/);

    expect(input).toHaveClass("port-input");
    expect(outputA).toHaveClass("port-output");
    expect(outputB).toHaveClass("port-output");
  });

  it("hides the legacy manifold from palette insertion but still renders imported projects", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "routing" },
    });
    expect(
      screen.queryByRole("button", { name: "Manifoldjunction.manifold" }),
    ).not.toBeInTheDocument();

    act(() => {
      projectStore.getState().updateProject((project) => {
        const result = insertComponentFromDefinition(project, {
          definitionKey: "junction.manifold",
          layerId: project.layers[0]!.id,
          position: { x: 2, y: 2 },
        });
        return result.project;
      }, "Import legacy manifold fixture");
    });

    expect(await screen.findByLabelText("Manifold Manifold")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Input Shared manifold port:/)).toHaveClass(
      "port-input",
    );
    expect(screen.getByLabelText(/^Output Shared manifold port:/)).toHaveClass(
      "port-output",
    );
  });

  it("applies project inspector drafts explicitly and supports undo/redo", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });
    const initialRevision = projectStore.getState().metadata?.revision;

    fireEvent.change(screen.getByLabelText("Inspector scope"), {
      target: { value: "project" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Manual edit project" },
    });

    expect(projectStore.getState().project?.name).toBe("Untitled Project");
    expect(projectStore.getState().metadata?.revision).toBe(initialRevision);

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(projectStore.getState().project?.name).toBe("Manual edit project");
    expect(projectStore.getState().history.past).toHaveLength(1);

    act(() => {
      projectStore.getState().undo();
    });
    expect(projectStore.getState().project?.name).toBe("Untitled Project");
    act(() => {
      projectStore.getState().redo();
    });
    expect(projectStore.getState().project?.name).toBe("Manual edit project");
  });

  it("keeps multi-component selection read-only in the properties inspector", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Rectangular channelchannel.rectangular",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Rectangular channelchannel.rectangular",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    act(() => {
      projectStore
        .getState()
        .setSelectedComponents(
          projectStore.getState().project!.components.map((component) => component.id),
        );
    });

    expect(screen.getByText("Multi-selection")).toBeInTheDocument();
    expect(screen.getByText(/read-only in Phase 6/i)).toBeInTheDocument();
  });

  it("saves locally when broadcast publication fails", async () => {
    vi.stubGlobal("BroadcastChannel", ThrowingBroadcastChannel);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });

    act(() => {
      projectStore.getState().updateProject(
        (currentProject) => ({
          ...currentProject,
          name: "Broadcast resilient project",
          updatedAt: "2026-08-05T00:00:01.000Z",
        }),
        "Rename",
      );
    });
    const revision = projectStore.getState().metadata?.revision;

    fireEvent.click(screen.getByRole("button", { name: "Save locally" }));

    await waitFor(() => {
      expect(screen.getByText("Saved locally")).toBeInTheDocument();
    });
    expect(projectStore.getState().metadata?.savedRevision).toBe(revision);
    expect(projectStore.getState().localSaveStatus).toBe("saved");

    const localProjectId = projectStore.getState().metadata?.localProjectId;
    expect(localProjectId).toBeDefined();
    const stored = await loadProjectRecord(localProjectId!);
    expect(stored.project.name).toBe("Broadcast resilient project");
    expect(stored.savedRevision).toBe(revision);
  });

  it("keeps IndexedDB failures as local-save failures", async () => {
    vi.stubGlobal("indexedDB", undefined);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save locally" }));

    await waitFor(() => {
      expect(screen.getByText("Local save failed")).toBeInTheDocument();
    });
    expect(projectStore.getState().metadata?.locallySavedAt).toBeNull();
  });
});
