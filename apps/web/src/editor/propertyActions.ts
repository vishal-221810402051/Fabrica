import {
  ChipSchema,
  LayerSchema,
  LaneSchema,
  ManufacturingProcessSchema,
  MaterialSchema,
  PortSchema,
  parseProject,
  type LayerId,
  type ManufacturingProcess,
  type Material,
  type MaterialId,
  type PortId,
  type ProcessId,
  type Project,
} from "project-model";
import type { Unit } from "units";

import { editorError } from "./editorErrors";

type Quantity = { value: number; unit: Unit; provenance: { source: string } };

export function updateProjectName(
  project: Project,
  name: string,
  now = new Date().toISOString(),
): Project {
  const trimmed = requireName(name, "Project name");
  if (project.name === trimmed) {
    return project;
  }
  return parseProject({ ...project, name: trimmed, updatedAt: now });
}

export function updateChipProperties(
  project: Project,
  input: {
    name: string;
    width: Quantity;
    height: Quantity;
    depth: Quantity;
    materialId?: MaterialId | null;
  },
  now = new Date().toISOString(),
): Project {
  const chip = ChipSchema.parse({
    ...project.chip,
    name: requireName(input.name, "Chip name"),
    overallDimensions: {
      width: input.width,
      height: input.height,
      depth: input.depth,
    },
    ...(input.materialId
      ? { materialId: input.materialId }
      : { materialId: undefined }),
  });
  if (
    input.materialId &&
    !project.materials.some((item) => item.id === input.materialId)
  ) {
    throw editorError("EDITOR_PROJECT_INVALID", "Selected material does not exist");
  }
  return replaceIfChanged(project, { ...project, chip }, now);
}

export function updateLayerProperties(
  project: Project,
  layerId: LayerId,
  input: {
    name: string;
    order: number;
    thickness: Quantity;
    materialId?: MaterialId | null;
  },
  now = new Date().toISOString(),
): Project {
  if (!Number.isInteger(input.order) || input.order < 0) {
    throw editorError(
      "EDITOR_PARAMETER_INVALID",
      "Layer order must be a non-negative integer",
    );
  }
  if (
    input.materialId &&
    !project.materials.some((item) => item.id === input.materialId)
  ) {
    throw editorError("EDITOR_PROJECT_INVALID", "Selected material does not exist");
  }
  const layer = LayerSchema.parse({
    ...requireLayer(project, layerId),
    name: requireName(input.name, "Layer name"),
    order: input.order,
    thickness: input.thickness,
    ...(input.materialId
      ? { materialId: input.materialId }
      : { materialId: undefined }),
  });
  return replaceIfChanged(
    project,
    {
      ...project,
      layers: project.layers.map((item) => (item.id === layerId ? layer : item)),
    },
    now,
  );
}

export function updateLaneProperties(
  project: Project,
  laneId: string,
  input: { name: string },
  now = new Date().toISOString(),
): Project {
  const lane = LaneSchema.parse({
    ...requireLane(project, laneId),
    name: requireName(input.name, "Lane name"),
  });
  return replaceIfChanged(
    project,
    {
      ...project,
      lanes: project.lanes.map((item) => (item.id === laneId ? lane : item)),
    },
    now,
  );
}

export function updatePortProperties(
  project: Project,
  portId: PortId,
  input: { name: string; fluidId?: string | null },
  now = new Date().toISOString(),
): Project {
  if (input.fluidId && !project.fluids.some((item) => item.id === input.fluidId)) {
    throw editorError("EDITOR_PROJECT_INVALID", "Selected fluid does not exist");
  }
  const port = PortSchema.parse({
    ...requirePort(project, portId),
    name: requireName(input.name, "Port name"),
    ...(input.fluidId ? { fluidId: input.fluidId } : { fluidId: undefined }),
  });
  return replaceIfChanged(
    project,
    {
      ...project,
      ports: project.ports.map((item) => (item.id === portId ? port : item)),
    },
    now,
  );
}

export function updateMaterialProperties(
  project: Project,
  materialId: MaterialId,
  input: Pick<Material, "name" | "category"> & {
    manufacturer?: string;
    reference?: string;
  },
  now = new Date().toISOString(),
): Project {
  const material = MaterialSchema.parse({
    ...requireMaterial(project, materialId),
    name: requireName(input.name, "Material name"),
    category: input.category,
    ...(optionalText(input.manufacturer)
      ? { manufacturer: optionalText(input.manufacturer) }
      : { manufacturer: undefined }),
    ...(optionalText(input.reference)
      ? { reference: optionalText(input.reference) }
      : { reference: undefined }),
  });
  return replaceIfChanged(
    project,
    {
      ...project,
      materials: project.materials.map((item) =>
        item.id === materialId ? material : item,
      ),
    },
    now,
  );
}

export function updateManufacturingProcessProperties(
  project: Project,
  processId: ProcessId,
  input: Pick<ManufacturingProcess, "name" | "processType"> & {
    profileReference?: string;
  },
  now = new Date().toISOString(),
): Project {
  const process = ManufacturingProcessSchema.parse({
    ...requireProcess(project, processId),
    name: requireName(input.name, "Process name"),
    processType: input.processType,
    ...(optionalText(input.profileReference)
      ? { profileReference: optionalText(input.profileReference) }
      : { profileReference: undefined }),
  });
  return replaceIfChanged(
    project,
    {
      ...project,
      manufacturingProcesses: project.manufacturingProcesses.map((item) =>
        item.id === processId ? process : item,
      ),
    },
    now,
  );
}

function replaceIfChanged(project: Project, candidate: Project, now: string): Project {
  if (JSON.stringify(project) === JSON.stringify(candidate)) {
    return project;
  }
  return parseProject({ ...candidate, updatedAt: now });
}

function requireName(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw editorError("EDITOR_PARAMETER_INVALID", `${label} is required`);
  }
  return trimmed;
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : undefined;
}

function requireLayer(project: Project, layerId: LayerId) {
  const layer = project.layers.find((item) => item.id === layerId);
  if (!layer) {
    throw editorError("EDITOR_PROJECT_INVALID", "Layer does not exist");
  }
  return layer;
}

function requireLane(project: Project, laneId: string) {
  const lane = project.lanes.find((item) => item.id === laneId);
  if (!lane) {
    throw editorError("EDITOR_PROJECT_INVALID", "Lane does not exist");
  }
  return lane;
}

function requirePort(project: Project, portId: PortId) {
  const port = project.ports.find((item) => item.id === portId);
  if (!port) {
    throw editorError("EDITOR_PROJECT_INVALID", "Port does not exist");
  }
  return port;
}

function requireMaterial(project: Project, materialId: MaterialId) {
  const material = project.materials.find((item) => item.id === materialId);
  if (!material) {
    throw editorError("EDITOR_PROJECT_INVALID", "Material does not exist");
  }
  return material;
}

function requireProcess(project: Project, processId: ProcessId) {
  const process = project.manufacturingProcesses.find((item) => item.id === processId);
  if (!process) {
    throw editorError("EDITOR_PROJECT_INVALID", "Manufacturing process does not exist");
  }
  return process;
}
