import { describe, expect, it } from "vitest";
import * as projectModel from "project-model";

import {
  importProjectFile,
  importProjectText,
  MAX_IMPORT_BYTES,
  ProjectImportError,
} from "./projectImport";
import { makeProject } from "../test/factories";

describe("project import", () => {
  it("imports valid canonical JSON and preserves the engineering project ID", () => {
    const project = makeProject("Imported");
    const record = importProjectText(
      projectModel.stringifyProject(project),
      "../Imported.fabricgamma.json",
    );

    expect(record.project.id).toBe(project.id);
    expect(record.localProjectId).not.toBe(project.id);
    expect(record.importedFilename).not.toContain("..");
    expect(record.source).toBe("imported");
  });

  it("rejects invalid JSON, invalid schema, unsafe keys, and oversized files", async () => {
    expect(() => importProjectText("{")).toThrow(ProjectImportError);
    expect(() => importProjectText(JSON.stringify({ schemaVersion: "0.1.0" }))).toThrow(
      /invalid/i,
    );
    expect(() =>
      importProjectText('{"schemaVersion":"0.1.0","metadata":{"__proto__":true}}'),
    ).toThrow(/unsafe/i);

    const oversized = new File(["x".repeat(MAX_IMPORT_BYTES + 1)], "big.json", {
      type: "application/json",
    });
    await expect(importProjectFile(oversized)).rejects.toMatchObject({
      code: "file-too-large",
    });
  });

  it("rejects unsupported extensions", async () => {
    const file = new File(
      [projectModel.stringifyProject(makeProject())],
      "project.txt",
      {
        type: "text/plain",
      },
    );

    await expect(importProjectFile(file)).rejects.toMatchObject({
      code: "unsupported-extension",
    });
  });
});
