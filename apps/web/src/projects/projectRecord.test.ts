import { describe, expect, it } from "vitest";

import {
  assertSafeJsonInput,
  createProjectRecord,
  recentProjectSummary,
  validateProjectRecord,
} from "./projectRecord";
import { makeProject } from "../test/factories";

describe("project records", () => {
  it("wraps a validated Phase 2 project without duplicating engineering fields", () => {
    const project = makeProject();
    const record = createProjectRecord(project, "new", {
      localProjectId: "local_test",
      now: "2026-08-05T00:00:00.000Z",
    });

    expect(record.storageVersion).toBe(1);
    expect(record.project.id).toBe(project.id);
    expect(record.localProjectId).not.toBe(project.id);
    expect(Object.keys(record)).not.toContain("name");
    expect(recentProjectSummary(record)).toMatchObject({
      projectId: project.id,
      projectName: project.name,
      schemaVersion: project.schemaVersion,
    });
  });

  it("rejects unknown wrapper fields and unsafe import keys", () => {
    const record = createProjectRecord(makeProject(), "new");

    expect(() => validateProjectRecord({ ...record, duplicateName: "bad" })).toThrow(
      /unknown field/,
    );
    expect(() => validateProjectRecord({ ...record, savedRevision: 2 })).toThrow(
      /savedRevision/,
    );
    expect(() => validateProjectRecord(Object.assign(new Date(), record))).toThrow(
      /plain object/,
    );
    expect(() =>
      assertSafeJsonInput(JSON.parse('{"nested":{"__proto__":{"bad":true}}}')),
    ).toThrow(/unsafe key/);
    expect(() => assertSafeJsonInput(["a", "b", "c"], 80, 2)).toThrow(
      /too many values/,
    );
  });
});
