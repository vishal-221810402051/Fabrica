import { describe, expect, it } from "vitest";
import * as projectModel from "project-model";

import { createProject } from "./createProject";
import { duplicateProject } from "./duplicateProject";

describe("project creation", () => {
  it("creates a valid current-schema project", () => {
    const project = createProject({
      name: "Untitled Project",
      now: "2026-08-05T00:00:00.000Z",
    });

    expect(projectModel.parseProject(project)).toEqual(project);
    expect(project.schemaVersion).toBe("0.2.0");
    expect(project.components).toHaveLength(0);
    expect(project.physicalRoutes).toEqual([]);
  });

  it("duplicates as a distinct project and rewrites contained entity references", () => {
    const project = createProject({ name: "Source" });
    const duplicate = duplicateProject(project, {
      now: "2026-08-05T00:00:01.000Z",
    });

    expect(duplicate.id).not.toBe(project.id);
    expect(duplicate.chip.id).not.toBe(project.chip.id);
    expect(duplicate.layers[0]?.id).not.toBe(project.layers[0]?.id);
    expect(duplicate.chip.layerIds).toEqual([duplicate.layers[0]?.id]);
    expect(duplicate.chip.materialId).toBe(duplicate.materials[0]?.id);
    expect(duplicate.name).toBe("Copy of Source");
  });
});
