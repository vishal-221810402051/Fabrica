import { deriveRouteGeometry, type GeneratedRouteGeometry } from "geometry-core";
import type {
  Component,
  Connection,
  Lane,
  PhysicalRoute,
  Port,
  Project,
} from "project-model";

export type PhysicalRouteResolution =
  | { status: "missing"; route?: undefined }
  | { status: "unique"; route: PhysicalRoute }
  | { status: "duplicate"; routes: PhysicalRoute[] };

export type DerivedLaneContext =
  | { status: "same-lane"; lane: Lane }
  | { status: "cross-lane"; sourceLane: Lane | null; targetLane: Lane | null }
  | { status: "unassigned" };

export interface ConnectionRouteContext {
  connection: Connection | null;
  sourcePort: Port | null;
  sourceComponent: Component | null;
  targetPort: Port | null;
  targetComponent: Component | null;
  sourceLane: Lane | null;
  targetLane: Lane | null;
  laneContext: DerivedLaneContext;
  physicalRoute: PhysicalRouteResolution;
  geometry: GeneratedRouteGeometry | null;
  issues: string[];
}

export function resolveConnectionRouteContext(
  project: Project,
  connectionId: string,
): ConnectionRouteContext {
  const connection =
    project.connections.find((item) => item.id === connectionId) ?? null;
  const sourcePort = connection
    ? (project.ports.find((port) => port.id === connection.sourcePortId) ?? null)
    : null;
  const targetPort = connection
    ? (project.ports.find((port) => port.id === connection.targetPortId) ?? null)
    : null;
  const sourceComponent = sourcePort
    ? (project.components.find(
        (component) => component.id === sourcePort.componentId,
      ) ?? null)
    : null;
  const targetComponent = targetPort
    ? (project.components.find(
        (component) => component.id === targetPort.componentId,
      ) ?? null)
    : null;
  const sourceLane = sourceComponent?.laneId
    ? (project.lanes.find((lane) => lane.id === sourceComponent.laneId) ?? null)
    : null;
  const targetLane = targetComponent?.laneId
    ? (project.lanes.find((lane) => lane.id === targetComponent.laneId) ?? null)
    : null;
  const routes = project.physicalRoutes.filter(
    (route) => route.connectionId === connectionId,
  );
  const physicalRoute =
    routes.length === 0
      ? ({ status: "missing" } as const)
      : routes.length === 1
        ? ({ status: "unique", route: routes[0]! } as const)
        : ({ status: "duplicate", routes } as const);
  const issues: string[] = [];
  if (!connection) {
    issues.push("Connection is missing");
  }
  if (connection && !sourcePort) {
    issues.push("Source port is missing");
  }
  if (connection && !targetPort) {
    issues.push("Target port is missing");
  }
  if (sourcePort && !sourceComponent) {
    issues.push("Source component is missing");
  }
  if (targetPort && !targetComponent) {
    issues.push("Target component is missing");
  }
  if (physicalRoute.status === "duplicate") {
    issues.push("Multiple physical routes reference this connection");
  }
  let geometry: GeneratedRouteGeometry | null = null;
  if (physicalRoute.status === "unique") {
    try {
      geometry = deriveRouteGeometry(project, physicalRoute.route);
    } catch (error) {
      issues.push(
        `Route geometry could not be derived: ${
          error instanceof Error ? error.message : "unknown route geometry error"
        }`,
      );
    }
  }
  return {
    connection,
    sourcePort,
    sourceComponent,
    targetPort,
    targetComponent,
    sourceLane,
    targetLane,
    laneContext: deriveLaneContext(sourceLane, targetLane),
    physicalRoute,
    geometry,
    issues,
  };
}

function deriveLaneContext(
  sourceLane: Lane | null,
  targetLane: Lane | null,
): DerivedLaneContext {
  if (!sourceLane && !targetLane) {
    return { status: "unassigned" };
  }
  if (sourceLane && targetLane && sourceLane.id === targetLane.id) {
    return { status: "same-lane", lane: sourceLane };
  }
  return { status: "cross-lane", sourceLane, targetLane };
}
