import type { IntegrityIssue } from "./errors";
import type { Project } from "./schema";

type Identified = { id: string };

function indexById<T extends Identified>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function requireReference(
  issues: IntegrityIssue[],
  ids: Set<string>,
  id: string | undefined,
  code: string,
  path: string,
  entityId?: string,
): void {
  if (id && !ids.has(id)) {
    issues.push({
      code,
      message: `Missing referenced id ${id}`,
      path,
      entityId,
    });
  }
}

export function validateProjectIntegrity(project: Project): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const allIds = new Map<string, string>();

  const track = (id: string, path: string) => {
    const existingPath = allIds.get(id);
    if (existingPath) {
      issues.push({
        code: "duplicate-id",
        message: `Duplicate id ${id}; first seen at ${existingPath}`,
        path,
        entityId: id,
      });
    } else {
      allIds.set(id, path);
    }
  };

  track(project.id, "id");
  track(project.chip.id, "chip.id");
  project.layers.forEach((layer, index) => track(layer.id, `layers.${index}.id`));
  project.lanes.forEach((lane, index) => track(lane.id, `lanes.${index}.id`));
  project.components.forEach((component, index) =>
    track(component.id, `components.${index}.id`),
  );
  project.ports.forEach((port, index) => track(port.id, `ports.${index}.id`));
  project.connections.forEach((connection, index) =>
    track(connection.id, `connections.${index}.id`),
  );
  project.physicalRoutes.forEach((route, index) =>
    track(route.id, `physicalRoutes.${index}.id`),
  );
  project.fluids.forEach((fluid, index) => track(fluid.id, `fluids.${index}.id`));
  project.materials.forEach((material, index) =>
    track(material.id, `materials.${index}.id`),
  );
  project.manufacturingProcesses.forEach((process, index) =>
    track(process.id, `manufacturingProcesses.${index}.id`),
  );
  project.validationResults.forEach((result, index) =>
    track(result.id, `validationResults.${index}.id`),
  );

  const layers = indexById(project.layers);
  const lanes = indexById(project.lanes);
  const components = indexById(project.components);
  const ports = indexById(project.ports);
  const connections = indexById(project.connections);
  const fluids = indexById(project.fluids);
  const materials = indexById(project.materials);

  const layerIds = new Set(layers.keys());
  const laneIds = new Set(lanes.keys());
  const componentIds = new Set(components.keys());
  const portIds = new Set(ports.keys());
  const connectionIds = new Set(connections.keys());
  const fluidIds = new Set(fluids.keys());
  const materialIds = new Set(materials.keys());

  project.chip.layerIds.forEach((layerId, index) =>
    requireReference(
      issues,
      layerIds,
      layerId,
      "missing-chip-layer-reference",
      `chip.layerIds.${index}`,
      project.chip.id,
    ),
  );
  requireReference(
    issues,
    materialIds,
    project.chip.materialId,
    "missing-material-reference",
    "chip.materialId",
    project.chip.id,
  );

  project.layers.forEach((layer, index) => {
    requireReference(
      issues,
      materialIds,
      layer.materialId,
      "missing-material-reference",
      `layers.${index}.materialId`,
      layer.id,
    );
  });

  project.lanes.forEach((lane, laneIndex) => {
    lane.componentIds.forEach((componentId, componentIndex) =>
      requireReference(
        issues,
        componentIds,
        componentId,
        "missing-lane-component-reference",
        `lanes.${laneIndex}.componentIds.${componentIndex}`,
        lane.id,
      ),
    );
  });

  project.components.forEach((component, componentIndex) => {
    requireReference(
      issues,
      layerIds,
      component.layerId,
      "missing-component-layer-reference",
      `components.${componentIndex}.layerId`,
      component.id,
    );
    requireReference(
      issues,
      laneIds,
      component.laneId,
      "missing-component-lane-reference",
      `components.${componentIndex}.laneId`,
      component.id,
    );
    component.portIds.forEach((portId, portIndex) =>
      requireReference(
        issues,
        portIds,
        portId,
        "missing-component-port-reference",
        `components.${componentIndex}.portIds.${portIndex}`,
        component.id,
      ),
    );
  });

  project.lanes.forEach((lane, laneIndex) => {
    lane.componentIds.forEach((componentId, componentIndex) => {
      const component = components.get(componentId);
      if (component && component.laneId !== lane.id) {
        issues.push({
          code: "lane-membership-index-mismatch",
          message: "Lane componentIds must mirror component.laneId",
          path: `lanes.${laneIndex}.componentIds.${componentIndex}`,
          entityId: lane.id,
        });
      }
    });
  });

  project.components.forEach((component, componentIndex) => {
    if (!component.laneId) {
      return;
    }
    const lane = lanes.get(component.laneId);
    if (lane && !lane.componentIds.includes(component.id)) {
      issues.push({
        code: "component-lane-index-mismatch",
        message: "Component laneId must be indexed by its Lane componentIds",
        path: `components.${componentIndex}.laneId`,
        entityId: component.id,
      });
    }
  });

  project.ports.forEach((port, portIndex) => {
    requireReference(
      issues,
      componentIds,
      port.componentId,
      "missing-port-component-reference",
      `ports.${portIndex}.componentId`,
      port.id,
    );
    requireReference(
      issues,
      fluidIds,
      port.fluidId,
      "missing-fluid-reference",
      `ports.${portIndex}.fluidId`,
      port.id,
    );
  });

  project.connections.forEach((connection, connectionIndex) => {
    if (connection.sourcePortId === connection.targetPortId) {
      issues.push({
        code: "invalid-self-reference",
        message: "Connection source and target ports must differ",
        path: `connections.${connectionIndex}`,
        entityId: connection.id,
      });
    }
    requireReference(
      issues,
      portIds,
      connection.sourcePortId,
      "missing-connection-source-port",
      `connections.${connectionIndex}.sourcePortId`,
      connection.id,
    );
    requireReference(
      issues,
      portIds,
      connection.targetPortId,
      "missing-connection-target-port",
      `connections.${connectionIndex}.targetPortId`,
      connection.id,
    );
  });

  project.physicalRoutes.forEach((route, routeIndex) => {
    requireReference(
      issues,
      connectionIds,
      route.connectionId,
      "missing-route-connection-reference",
      `physicalRoutes.${routeIndex}.connectionId`,
      route.id,
    );
    requireReference(
      issues,
      layerIds,
      route.layerId,
      "missing-route-layer-reference",
      `physicalRoutes.${routeIndex}.layerId`,
      route.id,
    );
  });

  return issues;
}
