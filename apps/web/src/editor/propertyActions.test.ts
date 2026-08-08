import { describe, expect, it } from "vitest";

import { parseProject, type FluidId } from "project-model";

import { createProjectExport } from "../import-export/projectExport";
import { projectStore, resetProjectStoreForTests } from "../state/projectStore";
import { makeProject } from "../test/factories";
import {
  insertComponentFromDefinition,
  updateComponentParameterValues,
} from "./editorActions";
import {
  updateChipProperties,
  updateLaneProperties,
  updateLayerProperties,
  updateManufacturingProcessProperties,
  updateMaterialProperties,
  updatePortProperties,
  updateProjectName,
} from "./propertyActions";
import { parseQuantityDraft } from "./unitDrafts";

describe("property edit actions", () => {
  it("edits the project name and rejects invalid or no-op edits", () => {
    const project = makeProject();
    const renamed = updateProjectName(
      project,
      " Renamed project ",
      "2026-08-06T00:00:00.000Z",
    );

    expect(renamed.name).toBe("Renamed project");
    expect(renamed.updatedAt).toBe("2026-08-06T00:00:00.000Z");
    expect(updateProjectName(renamed, "Renamed project")).toBe(renamed);
    expect(() => updateProjectName(project, " ")).toThrow("Project name is required");
  });

  it("edits chip quantities canonically with user-entered provenance", () => {
    const project = makeProject();
    const updated = updateChipProperties(
      project,
      {
        name: "Assay chip",
        width: parseQuantityDraft({ text: "25000", displayUnit: "um" }, "length", {
          required: true,
          positive: true,
        })!,
        height: { value: 12.5, unit: "mm", provenance: { source: "user-entered" } },
        depth: parseQuantityDraft({ text: "1000", displayUnit: "um" }, "length", {
          required: true,
          positive: true,
        })!,
        materialId: project.materials[0]!.id,
      },
      "2026-08-06T00:00:00.000Z",
    );

    expect(updated.chip.name).toBe("Assay chip");
    expect(updated.chip.overallDimensions.width).toEqual({
      value: 25,
      unit: "mm",
      provenance: { source: "user-entered" },
    });
    expect(updated.chip.materialId).toBe(project.materials[0]!.id);
  });

  it("edits layers and lanes while preserving atomic no-op behavior", () => {
    const project = makeProject();
    const layer = project.layers[0]!;
    const layerUpdated = updateLayerProperties(
      project,
      layer.id,
      {
        name: "Flow layer",
        order: 1,
        thickness: {
          value: 0.75,
          unit: "mm",
          provenance: { source: "user-entered" },
        },
        materialId: project.materials[0]!.id,
      },
      "2026-08-06T00:00:00.000Z",
    );
    const laneUpdated = updateLaneProperties(
      parseProject({
        ...layerUpdated,
        lanes: [{ id: "lane_sample", name: "Sample", componentIds: [], metadata: {} }],
      }),
      "lane_sample",
      { name: "Control lane" },
      "2026-08-06T00:00:01.000Z",
    );

    expect(layerUpdated.layers[0]!.name).toBe("Flow layer");
    expect(layerUpdated.layers[0]!.order).toBe(1);
    expect(laneUpdated.lanes[0]!.name).toBe("Control lane");
    expect(() =>
      updateLayerProperties(project, layer.id, {
        name: layer.name,
        order: -1,
        thickness: layer.thickness,
      }),
    ).toThrow("non-negative integer");
  });

  it("edits ports, materials, and injected manufacturing processes", () => {
    const base = makeProject();
    const inserted = insertComponentFromDefinition(base, {
      definitionKey: "channel.rectangular",
      layerId: base.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    const project = parseProject({
      ...inserted,
      fluids: [
        {
          id: "fluid_sample",
          name: "Sample",
          category: "sample",
          metadata: {},
        },
      ],
      manufacturingProcesses: [
        {
          id: "process_soft_lithography",
          name: "Soft lithography",
          processType: "soft-lithography",
          metadata: {},
        },
      ],
    });
    const portUpdated = updatePortProperties(
      project,
      project.ports[0]!.id,
      { name: "Sample inlet", fluidId: "fluid_sample" as FluidId },
      "2026-08-06T00:00:00.000Z",
    );
    const materialUpdated = updateMaterialProperties(
      portUpdated,
      portUpdated.materials[0]!.id,
      {
        name: "Glass substrate",
        category: "glass",
        manufacturer: " ",
        reference: "GL-01",
      },
      "2026-08-06T00:00:01.000Z",
    );
    const processUpdated = updateManufacturingProcessProperties(
      materialUpdated,
      "process_soft_lithography",
      {
        name: "SU-8 lithography",
        processType: "soft-lithography",
        profileReference: "profile.su8",
      },
      "2026-08-06T00:00:02.000Z",
    );

    expect(processUpdated.ports[0]!.name).toBe("Sample inlet");
    expect(processUpdated.ports[0]!.fluidId).toBe("fluid_sample");
    expect(processUpdated.materials[0]!.name).toBe("Glass substrate");
    expect(processUpdated.materials[0]!.manufacturer).toBeUndefined();
    expect(processUpdated.manufacturingProcesses[0]!.profileReference).toBe(
      "profile.su8",
    );
  });

  it("keeps invalid/no-op applies out of history, persistence drafts, and exports", () => {
    resetProjectStoreForTests();
    projectStore.getState().createNewProject();
    const project = projectStore.getState().project!;
    const revision = projectStore.getState().metadata!.revision;

    expect(() => updateProjectName(project, "")).toThrow();
    expect(projectStore.getState().metadata!.revision).toBe(revision);

    projectStore
      .getState()
      .updateProject(
        (current) => updateProjectName(current, current.name),
        "No-op project edit",
      );
    expect(projectStore.getState().history.past).toHaveLength(0);
    expect(projectStore.getState().metadata!.revision).toBe(revision);

    projectStore
      .getState()
      .updateProject(
        (current) =>
          updateProjectName(current, "Exported project", "2026-08-06T00:00:00.000Z"),
        "Update project",
      );
    expect(projectStore.getState().history.past).toHaveLength(1);

    const exported = JSON.parse(
      createProjectExport(projectStore.getState().project!).content,
    );
    expect(exported.name).toBe("Exported project");
    expect(JSON.stringify(exported)).not.toContain("displayUnit");
    expect(JSON.stringify(exported)).not.toContain("draft");
  });

  it("edits, rejects, resets, and clears registry parameters", () => {
    const base = makeProject();
    const inserted = insertComponentFromDefinition(base, {
      definitionKey: "chamber.reaction",
      layerId: base.layers[0]!.id,
      position: { x: 0, y: 0 },
    }).project;
    const componentId = inserted.components[0]!.id;
    const edited = updateComponentParameterValues(inserted, {
      componentId,
      updates: {
        width: { value: 1000, unit: "um", provenance: { source: "imported" } },
        "declared-volume": {
          value: 5,
          unit: "mm3",
          provenance: { source: "user-entered" },
        },
      },
    });
    const reset = updateComponentParameterValues(edited, {
      componentId,
      updates: {
        width: { value: 2, unit: "mm", provenance: { source: "system-default" } },
      },
      provenanceOverrides: { width: "system-default" },
    });
    const cleared = updateComponentParameterValues(reset, {
      componentId,
      updates: { "declared-volume": null },
    });

    expect(edited.components[0]!.kind).toBe("chamber");
    if (edited.components[0]!.kind === "chamber") {
      expect(edited.components[0]!.chamber.dimensions.width).toEqual({
        value: 1,
        unit: "mm",
        provenance: { source: "user-entered" },
      });
    }
    if (reset.components[0]!.kind === "chamber") {
      expect(reset.components[0]!.chamber.dimensions.width.provenance.source).toBe(
        "system-default",
      );
    }
    if (cleared.components[0]!.kind === "chamber") {
      expect(cleared.components[0]!.chamber.declaredVolume).toBeUndefined();
    }
    expect(() =>
      updateComponentParameterValues(inserted, {
        componentId,
        updates: { width: { value: -1, unit: "mm" } },
      }),
    ).toThrow();
  });
});
