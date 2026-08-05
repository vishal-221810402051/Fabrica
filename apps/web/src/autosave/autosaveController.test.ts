import { describe, expect, it, vi } from "vitest";

import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_MAX_DELAY_MS,
  createAutosaveController,
} from "./autosaveController";
import { createProjectRecord } from "../projects/projectRecord";
import { makeProject } from "../test/factories";

describe("autosave controller", () => {
  it("debounces and saves the latest revision", async () => {
    vi.useFakeTimers();
    let record = createProjectRecord(makeProject(), "new");
    const saveRecord = vi.fn(async () => ({
      ...record,
      savedRevision: record.revision,
    }));
    const statuses: string[] = [];
    const controller = createAutosaveController({
      getRecord: () => record,
      saveRecord,
      onStatusChange: (status) => statuses.push(status),
      onSaved: () => undefined,
    });

    controller.schedule();
    record = { ...record, revision: 2 };
    controller.schedule();

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(saveRecord).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }));
    expect(statuses).toContain("pending");
    expect(statuses).toContain("saving");
    controller.cleanup();
  });

  it("flushes by maximum delay and reports failed saves", async () => {
    vi.useFakeTimers();
    const record = {
      ...createProjectRecord(makeProject(), "new"),
      revision: 1,
      autosaveState: "pending" as const,
    };
    const statuses: string[] = [];
    const controller = createAutosaveController({
      getRecord: () => record,
      saveRecord: vi.fn(async () => {
        throw new Error("quota");
      }),
      onStatusChange: (status) => statuses.push(status),
      onSaved: () => undefined,
      maxRetries: 0,
    });

    controller.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MAX_DELAY_MS);

    expect(statuses).toContain("failed");
    controller.cleanup();
  });

  it("flushes on browser events only when locally dirty and cleans listeners", async () => {
    vi.useFakeTimers();
    let record = {
      ...createProjectRecord(makeProject(), "new"),
      savedRevision: 0,
      locallySavedAt: "2026-08-05T00:00:00.000Z",
    };
    const saveRecord = vi.fn(async () => ({
      ...record,
      savedRevision: record.revision,
    }));
    const controller = createAutosaveController({
      getRecord: () => record,
      saveRecord,
      onStatusChange: () => undefined,
      onSaved: () => undefined,
    });

    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pagehide"));
    await vi.runAllTimersAsync();
    expect(saveRecord).not.toHaveBeenCalled();

    record = { ...record, revision: 1, autosaveState: "pending" };
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.runAllTimersAsync();
    expect(saveRecord).toHaveBeenCalledOnce();

    controller.cleanup();
    record = { ...record, revision: 2 };
    window.dispatchEvent(new Event("pagehide"));
    await vi.runAllTimersAsync();
    expect(saveRecord).toHaveBeenCalledOnce();
  });
});
