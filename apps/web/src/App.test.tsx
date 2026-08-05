import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the Phase 2 status interface", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Fabricgamma development environment",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Phase 2 foundation")).toBeInTheDocument();
  });

  it("handles unavailable services without crashing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("service unavailable")));

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("unreachable")).toHaveLength(2);
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
});
