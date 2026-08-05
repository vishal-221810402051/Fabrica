import { describe, expect, it, vi } from "vitest";

import { checkServiceHealth } from "./health";

describe("checkServiceHealth", () => {
  it("returns healthy for an ok API health payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok", version: "0.1.0" }),
      }),
    );

    await expect(checkServiceHealth("API", "http://127.0.0.1:8000")).resolves.toEqual({
      name: "API",
      baseUrl: "http://127.0.0.1:8000",
      state: "healthy",
      version: "0.1.0",
    });

    vi.unstubAllGlobals();
  });

  it("returns healthy for an ok CAD health payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok", version: "0.1.0" }),
      }),
    );

    await expect(
      checkServiceHealth("CAD service", "http://127.0.0.1:8001"),
    ).resolves.toEqual({
      name: "CAD service",
      baseUrl: "http://127.0.0.1:8001",
      state: "healthy",
      version: "0.1.0",
    });

    vi.unstubAllGlobals();
  });

  it("returns unreachable for a failed API health request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));

    await expect(checkServiceHealth("API", "http://127.0.0.1:8000")).resolves.toEqual({
      name: "API",
      baseUrl: "http://127.0.0.1:8000",
      state: "unreachable",
    });

    vi.unstubAllGlobals();
  });

  it("returns unreachable for a failed CAD health request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(
      checkServiceHealth("CAD service", "http://127.0.0.1:8001"),
    ).resolves.toEqual({
      name: "CAD service",
      baseUrl: "http://127.0.0.1:8001",
      state: "unreachable",
    });

    vi.unstubAllGlobals();
  });
});
