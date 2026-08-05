import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { projectStore, resetProjectStoreForTests } from "./state/projectStore";

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
});
