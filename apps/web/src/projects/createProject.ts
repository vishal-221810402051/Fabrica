import * as projectModel from "project-model";
import type { Project } from "project-model";

export function createProject(options: { name?: string; now?: string } = {}): Project {
  const timestamp = options.now ?? new Date().toISOString();
  const materialId = projectModel.createStableId("material");
  const layerId = projectModel.createStableId("layer");
  const project = {
    schemaVersion: projectModel.CURRENT_SCHEMA_VERSION,
    id: projectModel.createStableId("project"),
    name: options.name ?? "Untitled Project",
    createdAt: timestamp,
    updatedAt: timestamp,
    chip: {
      id: projectModel.createStableId("chip"),
      name: "Untitled chip",
      overallDimensions: {
        width: quantity(25),
        height: quantity(10),
        depth: quantity(1.5),
      },
      layerIds: [layerId],
      materialId,
      metadata: {},
    },
    layers: [
      {
        id: layerId,
        name: "Control layer",
        order: 0,
        thickness: quantity(1.5),
        materialId,
        metadata: {},
      },
    ],
    lanes: [],
    components: [],
    ports: [],
    connections: [],
    physicalRoutes: [],
    fluids: [],
    materials: [
      {
        id: materialId,
        name: "PDMS",
        category: "pdms",
        reference: "Fabricgamma local default",
        metadata: {},
      },
    ],
    manufacturingProcesses: [],
    validationResults: [],
    exportConfiguration: {
      requestedFormats: ["json"],
      includeValidationResults: true,
      metadata: {},
    },
    metadata: {},
    extensions: {},
  };

  return projectModel.parseProject(project);
}

function quantity(value: number) {
  return {
    value,
    unit: "mm" as const,
    provenance: { source: "user-entered" as const },
  };
}
