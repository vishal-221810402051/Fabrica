import { describe, expect, it, vi } from "vitest";
import * as projectModel from "project-model";

import { createProjectExport, downloadProjectExport } from "./projectExport";
import { makeProject } from "../test/factories";

describe("project export", () => {
  it("creates canonical project JSON without browser-local wrapper state", () => {
    const project = makeProject("Export Me");
    const payload = createProjectExport(project);

    expect(payload.filename).toBe("export-me.fabricgamma.json");
    expect(payload.mimeType).toBe("application/json");
    expect(JSON.parse(payload.content)).not.toHaveProperty("localProjectId");
    expect(projectModel.parseProject(JSON.parse(payload.content)).id).toBe(project.id);
  });

  it("falls back from reserved export filenames", () => {
    expect(createProjectExport(makeProject("CON")).filename).toBe(
      "untitled-project.fabricgamma.json",
    );
  });

  it("creates and revokes object URLs during browser download", () => {
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      click,
      set href(_value: string) {},
      set download(_value: string) {},
      set rel(_value: string) {},
    } as unknown as HTMLAnchorElement);

    downloadProjectExport(makeProject());

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
