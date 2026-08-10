import { describe, expect, it, vi } from "vitest";
import * as projectModel from "project-model";

import { createProjectExport, downloadProjectExport } from "./projectExport";
import {
  createProjectConnection,
  insertComponentFromDefinition,
} from "../editor/editorActions";
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

  it("exports explicit splitter topology without React Flow state", () => {
    const base = makeProject("Split Topology");
    const withSource = insertComponentFromDefinition(base, {
      definitionKey: "reservoir.sample-inlet",
      layerId: base.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    const withSplitter = insertComponentFromDefinition(withSource, {
      definitionKey: "junction.splitter",
      layerId: base.layers[0]!.id,
      position: { x: 2, y: 0 },
    }).project;
    const source = withSplitter.ports.find(
      (port) => port.id === withSplitter.components[0]!.portIds[0],
    )!;
    const splitterInput = withSplitter.ports.find(
      (port) =>
        port.componentId === withSplitter.components[1]!.id &&
        port.direction === "input",
    )!;
    const connected = createProjectConnection(
      withSplitter,
      source.id,
      splitterInput.id,
    ).project;
    const exported = JSON.parse(createProjectExport(connected).content);

    expect(exported.connections).toHaveLength(1);
    expect(exported.connections[0].sourcePortId).toBe(
      connected.connections[0]!.sourcePortId,
    );
    expect(JSON.stringify(exported)).not.toContain("reactFlow");
    expect(JSON.stringify(exported)).not.toContain("viewport");
    expect(JSON.stringify(exported)).not.toContain("sourceHandle");
    expect(JSON.stringify(exported)).not.toContain("selectedConnectionIds");
    expect(JSON.stringify(exported)).not.toContain("selectedComponentIds");
    expect(JSON.stringify(exported)).not.toContain("inspectorScope");
    expect(JSON.stringify(exported)).not.toContain("editPoint");
    expect(JSON.stringify(exported)).not.toContain("editPointPosition");
    expect(JSON.stringify(exported)).not.toContain("editPointColor");
    expect(JSON.stringify(exported)).not.toContain("editPointSize");
    expect(JSON.stringify(exported)).not.toContain("selectedEditPoint");
    expect(JSON.stringify(exported)).not.toContain("channelEditHandle");
    expect(projectModel.parseProject(exported).connections).toHaveLength(1);
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
