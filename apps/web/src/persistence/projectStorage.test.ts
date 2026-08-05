import { describe, expect, it } from "vitest";

import {
  deleteProjectRecord,
  detectCorruptRecord,
  duplicateProjectRecord,
  listProjectRecords,
  loadMostRecentValidProject,
  loadProjectRecord,
  replaceRawProjectRecordForTests,
  saveProjectRecord,
} from "./projectStorage";
import { classifyStorageError } from "./storageErrors";
import { createProjectRecord } from "../projects/projectRecord";
import { makeProject } from "../test/factories";

describe("project storage", () => {
  it("saves, loads, lists, sorts, and deletes project records", async () => {
    const older = createProjectRecord(makeProject("Older"), "new", {
      localProjectId: "local_older",
      now: "2026-08-05T00:00:00.000Z",
    });
    const newer = {
      ...createProjectRecord(makeProject("Newer"), "new", {
        localProjectId: "local_newer",
        now: "2026-08-05T00:00:01.000Z",
      }),
      openedAt: "2026-08-05T00:00:02.000Z",
    };

    await saveProjectRecord(older);
    await saveProjectRecord(newer);

    await expect(loadProjectRecord("local_older")).resolves.toMatchObject({
      localProjectId: "local_older",
    });
    expect((await listProjectRecords()).map((record) => record.localProjectId)).toEqual(
      ["local_newer", "local_older"],
    );

    await deleteProjectRecord("local_older");
    expect(await listProjectRecords()).toHaveLength(1);
  });

  it("duplicates records with a new local and engineering project ID", async () => {
    const source = createProjectRecord(makeProject("Source"), "new", {
      localProjectId: "local_source",
    });
    await saveProjectRecord(source);

    const duplicate = await duplicateProjectRecord("local_source");

    expect(duplicate.localProjectId).not.toBe(source.localProjectId);
    expect(duplicate.project.id).not.toBe(source.project.id);
    expect(duplicate.source).toBe("duplicated");
  });

  it("blocks corrupt project bodies without deleting them", async () => {
    const record = createProjectRecord(makeProject(), "new", {
      localProjectId: "local_corrupt",
    });
    await saveProjectRecord(record);
    await replaceRawProjectRecordForTests("local_corrupt", {
      ...record,
      project: { ...record.project, unknown: true },
    });

    await expect(loadProjectRecord("local_corrupt")).rejects.toThrow(/unknown/);
    await expect(detectCorruptRecord("local_corrupt")).resolves.toBe(true);
    await expect(loadMostRecentValidProject()).resolves.toBeNull();
  });

  it("rejects unsupported storage versions", async () => {
    const record = createProjectRecord(makeProject(), "new", {
      localProjectId: "local_future",
    });
    await replaceRawProjectRecordForTests("local_future", {
      ...record,
      storageVersion: 99,
    });

    await expect(loadProjectRecord("local_future")).rejects.toThrow(
      /Unsupported browser storage version/,
    );
  });

  it("marks interrupted autosave records as recovered on startup", async () => {
    const record = {
      ...createProjectRecord(makeProject("Recovered"), "new", {
        localProjectId: "local_recovered",
      }),
      autosaveState: "saving" as const,
    };
    await saveProjectRecord(record);

    await expect(loadMostRecentValidProject()).resolves.toMatchObject({
      recoveryState: "recovered",
    });
  });

  it("classifies quota errors without discarding in-memory callers", () => {
    expect(
      classifyStorageError(new DOMException("quota", "QuotaExceededError")).code,
    ).toBe("quota-exceeded");
  });

  it("rejects stale writes and preserves the last valid record", async () => {
    const record = createProjectRecord(makeProject("Original"), "new", {
      localProjectId: "local_race",
    });
    await saveProjectRecord(record);
    await saveProjectRecord({
      ...record,
      project: makeProject("Newer"),
      revision: 1,
      savedRevision: 1,
      locallySavedAt: "2026-08-05T00:00:01.000Z",
    });

    await expect(
      saveProjectRecord({
        ...record,
        project: makeProject("Stale"),
        revision: 1,
        savedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: "revision-conflict" });

    await expect(loadProjectRecord("local_race")).resolves.toMatchObject({
      project: expect.objectContaining({ name: "Newer" }),
    });
  });
});
