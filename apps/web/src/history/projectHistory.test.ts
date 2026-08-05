import { describe, expect, it } from "vitest";

import {
  beginProjectTransaction,
  commitProjectChange,
  createProjectHistory,
  redoProjectChange,
  undoProjectChange,
} from "./projectHistory";
import { makeProject } from "../test/factories";

describe("project history", () => {
  it("undoes, redoes, and clears redo after a new edit", () => {
    const project = makeProject("A");
    const renamed = { ...project, name: "B", updatedAt: "2026-08-05T00:00:01.000Z" };
    const result = commitProjectChange(
      createProjectHistory(),
      project,
      renamed,
      "Rename",
    );

    const undone = undoProjectChange(result.history, result.project);
    expect(undone.project.name).toBe("A");

    const redone = redoProjectChange(undone.history, undone.project);
    expect(redone.project.name).toBe("B");

    const edited = commitProjectChange(
      undone.history,
      undone.project,
      { ...undone.project, name: "C", updatedAt: "2026-08-05T00:00:02.000Z" },
      "Rename again",
    );
    expect(edited.history.future).toHaveLength(0);
  });

  it("excludes no-op edits and caps history at 50 entries", () => {
    const project = makeProject("Base");
    const noOp = commitProjectChange(createProjectHistory(), project, project, "No-op");
    expect(noOp.changed).toBe(false);
    expect(noOp.history.past).toHaveLength(0);

    let current = project;
    let history = createProjectHistory();
    for (let index = 0; index < 60; index += 1) {
      const next = {
        ...current,
        name: `Project ${index}`,
        updatedAt: `2026-08-05T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
      };
      const result = commitProjectChange(history, current, next, "Rename");
      history = result.history;
      current = result.project;
    }
    expect(history.past).toHaveLength(50);
  });

  it("groups a transaction into one history entry", () => {
    const project = makeProject("A");
    const history = beginProjectTransaction(createProjectHistory(), project, "Batch");
    const result = commitProjectChange(
      history,
      { ...project, name: "Ignored intermediate" },
      { ...project, name: "Final", updatedAt: "2026-08-05T00:00:01.000Z" },
      "Final",
    );

    expect(result.history.past).toHaveLength(1);
    expect(result.history.past[0]?.label).toBe("Batch");
  });
});
