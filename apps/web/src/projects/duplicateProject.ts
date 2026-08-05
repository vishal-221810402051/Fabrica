import * as projectModel from "project-model";
import type { Project } from "project-model";

export function duplicateProject(
  project: Project,
  options: { now?: string; namePrefix?: string } = {},
): Project {
  const timestamp = options.now ?? new Date().toISOString();
  const duplicate = structuredClone(project);
  const idMap = new Map<string, string>();
  const mapId = <TPrefix extends projectModel.IdPrefix>(
    currentId: string,
    prefix: TPrefix,
  ) => {
    const replacement = projectModel.createStableId(prefix);
    idMap.set(currentId, replacement);
    return replacement;
  };
  const rewrite = (id: string | undefined) => (id ? (idMap.get(id) ?? id) : id);
  const rewriteRequired = (id: string) => idMap.get(id) ?? id;

  duplicate.id = mapId(project.id, "project");
  duplicate.name = `${options.namePrefix ?? "Copy of"} ${project.name}`;
  duplicate.createdAt = timestamp;
  duplicate.updatedAt = timestamp;

  duplicate.chip.id = mapId(project.chip.id, "chip");
  project.layers.forEach((layer) => mapId(layer.id, "layer"));
  project.lanes.forEach((lane) => mapId(lane.id, "lane"));
  project.components.forEach((component) => mapId(component.id, "component"));
  project.ports.forEach((port) => mapId(port.id, "port"));
  project.connections.forEach((connection) => mapId(connection.id, "connection"));
  project.fluids.forEach((fluid) => mapId(fluid.id, "fluid"));
  project.materials.forEach((material) => mapId(material.id, "material"));
  project.manufacturingProcesses.forEach((process) => mapId(process.id, "process"));
  project.validationResults.forEach((result) => mapId(result.id, "result"));

  duplicate.chip.layerIds = project.chip.layerIds.map((id) => rewriteRequired(id));
  duplicate.chip.materialId = rewrite(project.chip.materialId);
  duplicate.layers = duplicate.layers.map((layer, index) => ({
    ...layer,
    id: rewrite(project.layers[index]?.id) as typeof layer.id,
    materialId: rewrite(layer.materialId),
  }));
  duplicate.lanes = duplicate.lanes.map((lane, index) => ({
    ...lane,
    id: rewrite(project.lanes[index]?.id) as typeof lane.id,
    componentIds: lane.componentIds.map((id) => rewriteRequired(id)),
  }));
  duplicate.components = duplicate.components.map((component, index) => ({
    ...component,
    id: rewrite(project.components[index]?.id) as typeof component.id,
    laneId: rewrite(component.laneId) as typeof component.laneId,
    layerId: rewrite(component.layerId) as typeof component.layerId,
    portIds: component.portIds.map((id) => rewriteRequired(id)),
  }));
  duplicate.ports = duplicate.ports.map((port, index) => ({
    ...port,
    id: rewrite(project.ports[index]?.id) as typeof port.id,
    componentId: rewrite(port.componentId) as typeof port.componentId,
    fluidId: rewrite(port.fluidId) as typeof port.fluidId,
  }));
  duplicate.connections = duplicate.connections.map((connection, index) => ({
    ...connection,
    id: rewrite(project.connections[index]?.id) as typeof connection.id,
    sourcePortId: rewrite(connection.sourcePortId) as typeof connection.sourcePortId,
    targetPortId: rewrite(connection.targetPortId) as typeof connection.targetPortId,
  }));
  duplicate.fluids = duplicate.fluids.map((fluid, index) => ({
    ...fluid,
    id: rewrite(project.fluids[index]?.id) as typeof fluid.id,
  }));
  duplicate.materials = duplicate.materials.map((material, index) => ({
    ...material,
    id: rewrite(project.materials[index]?.id) as typeof material.id,
  }));
  duplicate.manufacturingProcesses = duplicate.manufacturingProcesses.map(
    (process, index) => ({
      ...process,
      id: rewrite(project.manufacturingProcesses[index]?.id) as typeof process.id,
    }),
  );
  duplicate.validationResults = duplicate.validationResults.map((result, index) => ({
    ...result,
    id: rewrite(project.validationResults[index]?.id) as typeof result.id,
    entityReferences: result.entityReferences.map((reference) => ({
      ...reference,
      entityId: rewrite(reference.entityId) as typeof reference.entityId,
    })),
  }));

  return projectModel.parseProject(duplicate);
}
