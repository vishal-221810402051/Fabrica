import { deriveRouteGeometry } from "geometry-core";
import type { Component, PhysicalRoute, Project } from "project-model";

export interface LanePhysicalRouteSummary {
  route: PhysicalRoute;
  sourceComponent: Component;
  targetComponent: Component;
  actualLength: number;
  physicalReady: boolean;
  issueCount: number;
}

export interface LaneInspectionSummary {
  components: Component[];
  chambers: Component[];
  routes: LanePhysicalRouteSummary[];
  crossLaneRoutes: PhysicalRoute[];
  totalActualLength: number;
  readyRouteCount: number;
}

export function inspectLane(project: Project, laneId: string): LaneInspectionSummary {
  const components = project.components.filter(
    (component) => component.laneId === laneId,
  );
  const componentByPort = new Map(
    project.ports.flatMap((port) => {
      const component = project.components.find((item) => item.id === port.componentId);
      return component ? [[port.id, component] as const] : [];
    }),
  );
  const routes = project.physicalRoutes.flatMap((route): LanePhysicalRouteSummary[] => {
    const connection = project.connections.find(
      (item) => item.id === route.connectionId,
    );
    const sourceComponent = connection
      ? componentByPort.get(connection.sourcePortId)
      : undefined;
    const targetComponent = connection
      ? componentByPort.get(connection.targetPortId)
      : undefined;
    if (
      !sourceComponent ||
      !targetComponent ||
      sourceComponent.laneId !== laneId ||
      targetComponent.laneId !== laneId
    ) {
      return [];
    }
    let actualLength = 0;
    let physicalReady = false;
    let issueCount = 1;
    try {
      const generated = deriveRouteGeometry(project, route);
      actualLength = generated.actualLength;
      physicalReady = generated.physicalReady;
      issueCount = generated.issues.length;
    } catch {
      issueCount = 1;
    }
    return [
      {
        route,
        sourceComponent,
        targetComponent,
        actualLength,
        physicalReady,
        issueCount,
      },
    ];
  });
  const associatedRouteIds = new Set(routes.map((summary) => summary.route.id));
  const crossLaneRoutes = project.physicalRoutes.filter((route) => {
    if (associatedRouteIds.has(route.id)) {
      return false;
    }
    const connection = project.connections.find(
      (item) => item.id === route.connectionId,
    );
    const sourceComponent = connection
      ? componentByPort.get(connection.sourcePortId)
      : undefined;
    const targetComponent = connection
      ? componentByPort.get(connection.targetPortId)
      : undefined;
    return sourceComponent?.laneId === laneId || targetComponent?.laneId === laneId;
  });
  return {
    components,
    chambers: components.filter((component) => component.kind === "chamber"),
    routes,
    crossLaneRoutes,
    totalActualLength: routes.reduce((sum, route) => sum + route.actualLength, 0),
    readyRouteCount: routes.filter((route) => route.physicalReady).length,
  };
}
